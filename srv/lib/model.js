'use strict';

/**
 * Veri modelinin LLM'e tanıtımı + sorgu doğrulaması için whitelist.
 * Buradaki alan listesi, LLM'in üretebileceği sorgu planını kısıtlamak
 * (injection / hatalı alan) için tek kaynak olarak kullanılır.
 */
const ENTITIES = {
  Customers: {
    description: 'Müşteriler. Her müşterinin birden çok siparişi olabilir.',
    fields: {
      ID: 'UUID',
      name: 'Müşteri adı (String)',
      city: 'Şehir (String)',
      country: 'Ülke (String)'
    }
  },
  Products: {
    description: 'Ürünler ve fiyat/stok bilgileri.',
    fields: {
      ID: 'UUID',
      name: 'Ürün adı (String)',
      category: 'Kategori (String)',
      price: 'Birim fiyat (Decimal)',
      currency: 'Para birimi (String)',
      stock: 'Stok adedi (Integer)'
    }
  },
  Orders: {
    description: 'Siparişler. customer alanı Customers ile, items ise OrderItems ile ilişkilidir.',
    fields: {
      ID: 'UUID',
      orderNo: 'Sipariş numarası (String)',
      orderDate: 'Sipariş tarihi (Date, YYYY-MM-DD)',
      status: 'Durum: NEW, SHIPPED, DELIVERED, CANCELLED (String)',
      customer_ID: 'İlişkili müşteri UUID',
      total: 'Toplam tutar (Decimal)',
      currency: 'Para birimi (String)'
    }
  },
  OrderItems: {
    description: 'Sipariş kalemleri. order ve product ile ilişkilidir.',
    fields: {
      ID: 'UUID',
      order_ID: 'İlişkili sipariş UUID',
      product_ID: 'İlişkili ürün UUID',
      quantity: 'Adet (Integer)',
      price: 'Birim fiyat (Decimal)'
    }
  }
};

const ALLOWED_OPS = ['=', '!=', '>', '>=', '<', '<=', 'like', 'in'];
const ALLOWED_AGG = ['count', 'sum', 'avg', 'min', 'max'];

/** LLM sistem promptu için modeli okunabilir metne çevirir. */
function describeModel() {
  return Object.entries(ENTITIES)
    .map(([name, def]) => {
      const fields = Object.entries(def.fields)
        .map(([f, d]) => `    - ${f}: ${d}`)
        .join('\n');
      return `Entity ${name} — ${def.description}\n${fields}`;
    })
    .join('\n\n');
}

module.exports = { ENTITIES, ALLOWED_OPS, ALLOWED_AGG, describeModel };
