# Verinle Konuş — SAP CAP + Generative AI Hub

SAP CAP (Node.js) üzerinde, **doğal dilde veri sorgulama** ("chat with your data")
yapay zeka uygulaması. Kullanıcı normal bir cümleyle soru sorar; uygulama bunu
**SAP Generative AI Hub** üzerinden bir LLM'e gönderip güvenli bir sorgu planına
çevirir, veriyi getirir ve sonucu doğal dilde özetler.

## Nasıl çalışır?

```
Kullanıcı sorusu
   │
   ▼
ChatService.ask(question)
   │  1) Şema + soru  → Gen AI Hub (orchestration)  → JSON sorgu planı
   │  2) Plan doğrulanır (entity/alan/operatör whitelist)  → CQN'e çevrilir → cds.run
   │  3) Sonuç tekrar LLM'e verilir  → doğal dilde özet
   ▼
{ answer, query, data }  →  chat UI (app/chat)
```

**Güvenlik notu:** LLM'e ham SQL/OData ürettirmek yerine kısıtlı bir JSON plan
ürettirip (`srv/lib/planner.js`) whitelist'e göre doğruluyoruz. Böylece injection
ve hatalı alan riskini kapatıyoruz.

## Proje yapısı

| Yol | Açıklama |
|-----|----------|
| `db/schema.cds` | Veri modeli: Customers, Products, Orders, OrderItems |
| `db/data/*.csv` | Örnek veriler (otomatik yüklenir) |
| `srv/chat-service.cds` | Servis tanımı + `ask` action |
| `srv/chat-service.js` | Action handler (planla → doğrula → çalıştır → özetle) |
| `srv/lib/model.js` | Modelin LLM'e tanıtımı + alan whitelist'i |
| `srv/lib/planner.js` | JSON plan doğrulama + CQN'e çevirme |
| `srv/lib/ai.js` | Gen AI Hub çağrısı (+ offline mock) |
| `app/chat/index.html` | Basit chat arayüzü |

## Çalıştırma (lokal)

```bash
npm install
npm run watch
```

Ardından tarayıcıdan: <http://localhost:4004/chat/index.html>

> **Mock mod:** AI Core bağlantısı yoksa uygulama yine çalışır; `srv/lib/ai.js`
> içindeki basit kural tabanlı planlayıcı devreye girer (yanıtlarda `MOCK:` notu
> görünür). Böylece bağlantı kurmadan da demo yapabilirsiniz.

## Gerçek SAP Generative AI Hub'a bağlanma

1. **SAP BTP** alt hesabınızda **SAP AI Core** servisini etkinleştirin ve bir
   service key oluşturun.
2. Gen AI Hub'da bir model deploy edin (örn. `anthropic--claude-3.5-sonnet`).
3. Yerelde çalışırken AI Core kimlik bilgilerini bağlayın:
   ```bash
   cds bind -2 <ai-core-service-instance>
   # veya bir destinationa/VCAP_SERVICES'e AI Core kimlik bilgilerini sağlayın
   ```
4. Kullanılacak modeli ortam değişkeniyle seçebilirsiniz:
   ```bash
   export GENAI_MODEL=anthropic--claude-3.5-sonnet
   ```

Detaylar: [SAP Cloud SDK for AI](https://sap.github.io/ai-sdk/) ·
[CAP Documentation](https://cap.cloud.sap/)

## Örnek sorular

- "En pahalı 5 ürün hangisi?"
- "Teslim edilen (DELIVERED) siparişleri göster"
- "Aksesuar kategorisindeki ürünler neler?"
- "Hangi müşterilerimiz var?"

## API

`POST /chat/ask` · gövde: `{ "question": "..." }` · yanıt: `{ answer, query, data }`

---

# Launchpad Copilot (FLP Shell Plugin)

Tek bir uygulamaya gömülü bot değil; **Fiori Launchpad'in tamamında** çalışan,
login olan kullanıcının **erişebildiği tüm uygulamaları gören** ve doğal dil
isteğini doğru uygulamaya yönlendiren **erişim-farkında** bir copilot.

> Kritik şart: kullanıcının kataloğunda/sayfasında olmayan bir uygulamaya asla
> yönlendirmez — "erişimin yok" (`no_access`) der.

## Mimari

```
UI5 Shell Plugin (app/copilot)                         CAP (srv)
─────────────────────────────                          ──────────
sap.ushell "SearchableContent".getApps()  ── katalog ──►  /copilot/route
   (kullanıcının eriştiği app'ler)            + mesaj      │  katalog + mesaj → Gen AI Hub
                                                           │  → intent JSON (katalogla doğrulanır)
sap.ushell "Navigation".navigate()  ◄── intent ───────────┘
   (doğru app'e yönlendirme)
```

- **Spaces & Pages uyumlu:** `SearchableContent.getApps()` içerik modelinden
  bağımsızdır — klasik group olsun, space/page olsun fark etmez. Eskiyen,
  group-bazlı `LaunchPage` servisinden kaçınılır.
- **Güvenlik:** AI çağrısı CAP'in arkasındadır; API anahtarı client'a sızmaz.
- **Erişim-farkındalık iki katmanlı:** (1) sistem promptu AI'a katalog sınırını
  dayatır, (2) `srv/lib/copilot.js` dönen `appIds`'i katalogla yeniden doğrular —
  uydurulan id'ler atılır, `navigate` → `no_access`'e düşer.

## Intent kontratı (JSON)

```json
{
  "intent": "navigate | clarify | answer | no_access",
  "message": "kısa Türkçe yanıt",
  "appIds": ["katalogdaki id"],
  "followup": "yalnızca clarify ise netleştirme sorusu"
}
```

## Proje yapısı (copilot)

| Yol | Açıklama |
|-----|----------|
| `srv/copilot-service.cds` | `/copilot` servisi + `route(message, catalog)` action |
| `srv/copilot-service.js` | Action handler |
| `srv/lib/copilot.js` | Routing beyni: prompt + katalog doğrulama + offline fallback |
| `app/copilot/Component.js` | FLP Shell Plugin: katalog çekme, panel, navigasyon |
| `app/copilot/manifest.json` | `sap.flp.type: plugin` descriptor |

## FLP'ye plugin olarak kaydetme

Shell Plugin, launchpad konfigürasyonuna eklenir (ayrı bir uygulama değildir).
SAP Build Work Zone / standalone FLP için plugin kaydı (örnek):

```json
{
  "borusan.copilot": {
    "component": "borusan.copilot",
    "url": "/copilot/webapp",
    "config": { "sap-plugin": "true" }
  }
}
```

> Gerçek ortamda `serviceUrl` (manifest `sap.copilot.serviceUrl`) CAP servisine
> bir BTP destination üzerinden işaret etmelidir.

## API (copilot)

`POST /copilot/route` · gövde: `{ "message": "...", "catalog": [{ "id":"SO-action", "title":"...", "keywords":[...] }] }`
· yanıt: `{ intent, message, appIds, followup }`
