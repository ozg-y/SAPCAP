namespace sap.capai;

using { cuid, managed } from '@sap/cds/common';

/**
 * Müşteriler
 */
entity Customers : cuid, managed {
  name    : String(100) @title: 'Müşteri Adı';
  city    : String(60)  @title: 'Şehir';
  country : String(60)  @title: 'Ülke';
  orders  : Composition of many Orders on orders.customer = $self;
}

/**
 * Ürünler
 */
entity Products : cuid, managed {
  name     : String(100)      @title: 'Ürün Adı';
  category : String(60)       @title: 'Kategori';
  price    : Decimal(11, 2)   @title: 'Fiyat';
  currency : String(3) default 'TRY' @title: 'Para Birimi';
  stock    : Integer          @title: 'Stok';
}

/**
 * Siparişler
 */
entity Orders : cuid, managed {
  orderNo   : String(20)            @title: 'Sipariş No';
  orderDate : Date                  @title: 'Sipariş Tarihi';
  status    : String(20)            @title: 'Durum'; // NEW, SHIPPED, DELIVERED, CANCELLED
  customer  : Association to Customers;
  items     : Composition of many OrderItems on items.order = $self;
  total     : Decimal(13, 2)        @title: 'Toplam Tutar';
  currency  : String(3) default 'TRY';
}

/**
 * Sipariş kalemleri
 */
entity OrderItems : cuid {
  order    : Association to Orders;
  product  : Association to Products;
  quantity : Integer        @title: 'Adet';
  price    : Decimal(11, 2) @title: 'Birim Fiyat';
}
