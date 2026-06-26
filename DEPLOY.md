# Deploy — Launchpad Copilot → SAP Build Work Zone (standard)

Hedef: **BTP Cloud Foundry + SAP Build Work Zone (standard edition)**.
Build/deploy **BAS** terminalinden `mbt` + `cf` ile yapılır.

```
mta.yaml
 ├─ sapcap-srv            (CAP: ChatService + CopilotService)  ──► AI Core binding
 ├─ sapcap-db-deployer    (HANA HDI: chat verileri)
 ├─ sapcap-copilot-ui     (UI5 Shell Plugin → HTML5 App Repo)
 ├─ sapcap-html5-deployer (plugin'i repo'ya yükler)
 └─ sapcap-destinations   (plugin → CAP servisi: copilot-srv-api)
```

## Ön koşullar (BTP tarafında, bir kez)

1. **AI Core / Gen AI Hub:** Alt hesapta `aicore` (plan: `extended`) servisini
   etkinleştir ve Gen AI Hub'da bir model deploy et
   (örn. `anthropic--claude-3.5-sonnet`). `mta.yaml`'daki `sapcap-aicore`
   kaynağı deploy sırasında bu instance'ı oluşturup CAP'e **bind** eder —
   `srv/lib/ai.js` kimliği bu binding'den (`VCAP_SERVICES`) okur.
2. **Work Zone (standard)** aboneliği aktif olmalı.
3. Entitlement'lar: `hana` (hdi-shared), `xsuaa`, `html5-apps-repo`,
   `destination`, `aicore`.

## BAS'tan build & deploy

```bash
# 1) Araçlar (BAS'ta genelde kurulu)
npm i -g mbt           # multi-target build tool
# cf CLI + MultiApps plugin BAS'ta hazır gelir

# 2) CF'e login
cf login -a <api-endpoint> -o <org> -s <space>

# 3) Build → tek archive
mbt build               # → mta_archives/sapcap-copilot_1.0.0.mtar

# 4) Deploy
cf deploy mta_archives/sapcap-copilot_1.0.0.mtar
```

Deploy sonunda: CAP servisi çalışır, `copilot-srv-api` destination'ı oluşur,
plugin HTML5 App Repo'ya yüklenir.

## Plugin'i launchpad'e ekleme (Work Zone Site Manager)

1. **Work Zone → Site Manager → Channel Manager**: HTML5 Apps kanalını
   güncelle (yeni `borusan.copilot` görünsün).
2. **Content Manager**: `borusan.copilot` öğesini bul. `manifest.json`'da
   `sap.flp.type: plugin` olduğu için Work Zone bunu **plugin** olarak tanır.
3. Plugin'i ilgili **Site/Space**'e ata. Artık o launchpad her açıldığında
   copilot başlık butonu yüklenir — kullanıcının erişebildiği app'lere göre.

> Plugin tüm launchpad'de çalıştığı için belirli bir Space/Page'e app olarak
> eklenmez; site düzeyinde plugin olarak aktive edilir.

## Lokal/hybrid test (binding ile)

Deploy etmeden gerçek Gen AI Hub'a vurmak için:

```bash
cf create-service-key <aicore-instance> default
cds bind -2 <aicore-instance>:default
cds watch --profile hybrid
```

Binding yoksa uygulama yine çalışır (fallback eşleştirici devreye girer).

## Diğer hedefler (varyasyonlar)

- **Standalone approuter FLP:** `mta.yaml`'a bir `approuter` (managed/standalone)
  modülü + sandbox FLP sayfası eklenir; plugin `sandbox` config'ine register
  edilir. Work Zone modülleri (`html5-deployer`, site manager adımı) yerine
  approuter'ın `xs-app.json`'ı ve sandbox `fioriSandboxConfig` kullanılır.
- **S/4HANA on-premise:** Plugin `ui5 build` sonrası BSP olarak Front-End
  Server'a deploy edilir (`abap` deploy). CAP servisine **Cloud Connector +
  BTP destination** üzerinden erişilir; `xs-app.json` yerine SICF/destination
  ayarı yapılır. Routing mantığı (`srv/lib/copilot.js`) aynen kalır.
