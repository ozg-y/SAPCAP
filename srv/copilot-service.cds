/**
 * Launchpad Copilot servisi.
 *
 * Shell Plugin (UI5, client), kullanıcının `sap.ushell` üzerinden gerçekten
 * erişebildiği uygulamaların listesini (catalog) gönderir. Servis bu kataloğu
 * + mesajı Gen AI Hub'a yollar ve bir "intent" döndürür. API anahtarı
 * client'a sızmaz; tüm AI çağrısı bu CAP servisinin arkasındadır.
 */
service CopilotService @(path: '/copilot') {

  type CatalogApp {
    id             : String;        // "SemanticObject-action" ya da benzersiz id
    title          : String;
    subtitle       : String;
    semanticObject : String;
    action         : String;
    keywords       : array of String;
  }

  /**
   * Doğal dil isteğini, kullanıcının erişebildiği uygulamalara göre
   * yönlendirme niyetine çevirir.
   */
  action route(
    message : String,
    catalog : array of CatalogApp
  ) returns {
    intent   : String;             // navigate | clarify | answer | no_access
    message  : String;             // kısa Türkçe yanıt
    appIds   : array of String;    // yönlendirilecek (katalogdaki) id'ler
    followup : String;             // yalnızca clarify ise netleştirme sorusu
  };
}
