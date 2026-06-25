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
