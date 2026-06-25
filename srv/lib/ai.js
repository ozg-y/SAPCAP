'use strict';

const { describeModel } = require('./model');

const MODEL = process.env.GENAI_MODEL || 'anthropic--claude-3.5-sonnet';

/**
 * AI Core / Gen AI Hub bağlantısı yoksa (lokal geliştirme) basit kural
 * tabanlı bir plan üretir. Böylece uygulama bağlantı olmadan da çalışır.
 */
function mockPlan(question) {
  const q = (question || '').toLowerCase();
  if (/(ürün|product|stok|stock)/.test(q)) {
    return {
      plan: { entity: 'Products', orderBy: [{ field: 'price', desc: true }], limit: 5 },
      note: 'MOCK: AI Core bağlı değil — örnek plan (en pahalı 5 ürün) döndürüldü.'
    };
  }
  if (/(müşteri|customer)/.test(q)) {
    return {
      plan: { entity: 'Customers', limit: 10 },
      note: 'MOCK: AI Core bağlı değil — örnek plan (müşteriler) döndürüldü.'
    };
  }
  return {
    plan: {
      entity: 'Orders',
      where: /(teslim|deliver)/.test(q) ? [{ field: 'status', op: '=', value: 'DELIVERED' }] : [],
      orderBy: [{ field: 'total', desc: true }],
      limit: 5
    },
    note: 'MOCK: AI Core bağlı değil — örnek plan (en yüksek tutarlı siparişler) döndürüldü.'
  };
}

function planningPrompt(question) {
  return `Sen bir SAP CAP veri asistanısın. Kullanıcının doğal dildeki sorusunu,
aşağıdaki veri modeline göre SADECE geçerli bir JSON sorgu planına çevir.
Açıklama yazma, yalnızca JSON döndür.

# Veri Modeli
${describeModel()}

# JSON Plan Şeması
{
  "entity": "Customers | Products | Orders | OrderItems",
  "columns": ["alan", ...],                       // opsiyonel
  "where": [{ "field": "alan", "op": "= | != | > | >= | < | <= | like | in", "value": <deger> }],
  "groupBy": ["alan", ...],                        // opsiyonel
  "aggregate": { "func": "count|sum|avg|min|max", "field": "alan", "as": "takmaAd" }, // opsiyonel
  "orderBy": [{ "field": "alan", "desc": true|false }],
  "limit": <tamsayi, <=100>
}

# Soru
${question}

# Yanıt (yalnızca JSON):`;
}

function summaryPrompt(question, rows) {
  return `Kullanıcının sorusu: "${question}"
Sorgu sonucu (JSON): ${JSON.stringify(rows).slice(0, 4000)}

Bu sonucu kullanıcıya Türkçe, kısa ve net bir cümleyle özetle. Sayıları
sonuçtaki gerçek değerlerden al, uydurma. Veri boşsa kibarca belirt.`;
}

/** Lazy: SDK yoksa veya binding yoksa null döner. */
function getClientFactory() {
  try {
    return require('@sap-ai-sdk/orchestration').OrchestrationClient;
  } catch {
    return null;
  }
}

async function chat(prompt) {
  const OrchestrationClient = getClientFactory();
  if (!OrchestrationClient) return null;
  const client = new OrchestrationClient({
    llm: { model_name: MODEL, model_params: { temperature: 0 } },
    templating: { template: [{ role: 'user', content: '{{?input}}' }] }
  });
  const res = await client.chatCompletion({ inputParams: { input: prompt } });
  return res.getContent();
}

/** Soru → doğrulanmamış sorgu planı (JSON). */
async function planQuery(question) {
  let text;
  try {
    text = await chat(planningPrompt(question));
  } catch (e) {
    text = null;
    if (process.env.DEBUG) console.error('Gen AI Hub planlama hatası:', e.message);
  }
  if (!text) return mockPlan(question);

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model geçerli JSON plan döndürmedi.');
  return { plan: JSON.parse(match[0]), note: null };
}

/** Sonuçları doğal dilde özetler; AI yoksa basit bir özet üretir. */
async function summarize(question, rows) {
  let text;
  try {
    text = await chat(summaryPrompt(question, rows));
  } catch {
    text = null;
  }
  if (text) return text.trim();
  if (!rows || !rows.length) return 'Bu kritere uyan kayıt bulunamadı.';
  return `${rows.length} kayıt bulundu. (Doğal dil özeti için AI Core bağlantısı gerekir.)`;
}

module.exports = { planQuery, summarize, MODEL };
