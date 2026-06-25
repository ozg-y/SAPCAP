using { sap.capai as my } from '../db/schema';

/**
 * Doğal dilde veri sorgulama servisi.
 * Entity'ler salt-okunur olarak açılır; asıl yetenek `ask` action'ındadır.
 */
service ChatService @(path: '/chat') {

  @readonly entity Customers  as projection on my.Customers;
  @readonly entity Products   as projection on my.Products;
  @readonly entity Orders     as projection on my.Orders;
  @readonly entity OrderItems as projection on my.OrderItems;

  /**
   * Doğal dil sorusunu alır, Gen AI Hub yardımıyla yapılandırılmış bir
   * sorgu planına çevirir, veriyi getirir ve doğal dilde özet döner.
   */
  action ask(question : String) returns {
    answer : String;      // doğal dilde cevap/özet
    query  : String;      // çalıştırılan sorgu planı (şeffaflık için)
    data   : array of {}; // ham sonuç satırları
  };
}
