'use strict';

const { chat } = require('./ai');

/**
 * Launchpad seviyesinde, ERİŞİM-FARKINDA copilot beyni.
 *
 * Shell Plugin (client) kullanıcının `sap.ushell` üzerinden gerçekten
 * erişebildiği uygulamaların listesini (katalog) gönderir. Bu modül o
 * kataloğu + kullanıcı mesajını alıp Gen AI Hub'a sorar ve bir "intent"
 * JSON kontratı döndürür.
 *
 * Kritik kural: AI yalnızca verilen katalogtaki uygulamalara yönlendirebilir.
 * Katalogda olmayan bir uygulama istenirse `no_access` döner — server bunu
 * ayrıca doğrular (modele güvenmeyiz, kontrolü kod tarafında da yaparız).
 */

/** Katalog girişlerini prompt için kısa, deterministik metne çevirir. */
function describeCatalog(apps) {
  if (!apps || !apps.length) return '(Kullanıcının erişebildiği uygulama yok.)';
  return apps
    .map((a, i) => {
      const id = a.id || `${a.semanticObject}-${a.action}`;
      const tags = a.keywords && a.keywords.length ? ` | anahtar: ${a.keywords.join(', ')}` : '';
      return `${i + 1}. id="${id}" | başlık: ${a.title || a.text || id}${
        a.subtitle ? ` (${a.subtitle})` : ''
      }${tags}`;
    })
    .join('\n');
}

function routingPrompt(message, apps) {
  return `Sen bir SAP Fiori Launchpad copilot'usun. Görevin: kullanıcının doğal
dildeki isteğini, AŞAĞIDA verilen ve kullanıcının ERİŞEBİLDİĞİ uygulamalar
listesine göre doğru uygulamaya yönlendirmek.

# Kullanıcının erişebildiği uygulamalar (KATALOG)
${describeCatalog(apps)}

# Kurallar
- SADECE yukarıdaki katalogda bulunan id'lere yönlendirebilirsin.
- Katalogda istenen işe uygun uygulama YOKSA, asla uygulama uydurma:
  intent="no_access" döndür ve kibarca erişimi olmadığını belirt.
- İstek birden fazla uygulamaya uyabiliyorsa ya da belirsizse: intent="clarify"
  döndür ve "followup" alanında tek, kısa bir netleştirme sorusu sor.
- İstek bir uygulamaya açıkça uyuyorsa: intent="navigate", appIds=["o id"].
- Genel/bilgi amaçlı, yönlendirme gerektirmeyen sorularda: intent="answer".
- "message" alanı her zaman kısa, doğal bir TÜRKÇE yanıt olsun.

# Yanıt SADECE şu JSON şemasında olsun (başka metin yazma):
{
  "intent": "navigate" | "clarify" | "answer" | "no_access",
  "message": "kısa Türkçe yanıt",
  "appIds": ["katalogdaki id", ...],
  "followup": "yalnızca clarify ise netleştirme sorusu, değilse boş string"
}

# Kullanıcı mesajı
${message}

# Yanıt (yalnızca JSON):`;
}

/** AI bağlı değilken çalışan basit anahtar-kelime eşleştirici (demo bozulmasın). */
function fallbackRoute(message, apps) {
  const q = (message || '').toLowerCase();
  const tokens = q.split(/[\s,.;!?]+/).filter(Boolean);

  const scored = (apps || [])
    .map((a) => {
      const hay = [a.title, a.text, a.subtitle, ...(a.keywords || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const score = tokens.reduce((s, t) => (t.length > 2 && hay.includes(t) ? s + 1 : s), 0);
      return { app: a, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      intent: 'no_access',
      message:
        'Bu işe uygun ve erişebildiğin bir uygulama bulamadım. (AI Core bağlı değil — basit eşleştirme kullanıldı.)',
      appIds: [],
      followup: ''
    };
  }

  const best = scored[0];
  const id = best.app.id || `${best.app.semanticObject}-${best.app.action}`;
  return {
    intent: 'navigate',
    message: `Seni "${best.app.title || best.app.text || id}" uygulamasına yönlendiriyorum. (basit eşleştirme)`,
    appIds: [id],
    followup: ''
  };
}

/** Modelin döndürdüğü intent'i şema + KATALOG sınırına göre doğrular. */
function sanitize(intent, apps) {
  const valid = ['navigate', 'clarify', 'answer', 'no_access'];
  const out = {
    intent: valid.includes(intent && intent.intent) ? intent.intent : 'answer',
    message: typeof (intent && intent.message) === 'string' ? intent.message : '',
    appIds: Array.isArray(intent && intent.appIds) ? intent.appIds : [],
    followup: typeof (intent && intent.followup) === 'string' ? intent.followup : ''
  };

  // Katalog dışı id'leri at — model uydurmuş olabilir.
  const known = new Set((apps || []).map((a) => a.id || `${a.semanticObject}-${a.action}`));
  out.appIds = out.appIds.filter((id) => known.has(id));

  // navigate dedi ama geçerli app kalmadıysa → erişim yok.
  if (out.intent === 'navigate' && out.appIds.length === 0) {
    out.intent = 'no_access';
    if (!out.message) out.message = 'Bu işe uygun, erişebildiğin bir uygulama bulamadım.';
  }
  return out;
}

/**
 * Ana giriş: mesaj + katalog → doğrulanmış intent JSON.
 * AI Core bağlı değilse veya hata olursa fallback eşleştiriciye düşer.
 */
async function route(message, apps) {
  let text;
  try {
    text = await chat(routingPrompt(message, apps));
  } catch (e) {
    text = null;
    if (process.env.DEBUG) console.error('Copilot routing hatası:', e.message);
  }

  if (!text) return fallbackRoute(message, apps);

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallbackRoute(message, apps);

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return fallbackRoute(message, apps);
  }
  return sanitize(parsed, apps);
}

module.exports = { route, sanitize, fallbackRoute };
