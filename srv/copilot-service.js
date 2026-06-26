'use strict';

const cds = require('@sap/cds');
const { route } = require('./lib/copilot');

module.exports = class CopilotService extends cds.ApplicationService {
  async init() {
    this.on('route', async (req) => {
      const { message, catalog } = req.data;

      if (!message || !message.trim()) {
        return req.error(400, 'Lütfen bir istek yazın.');
      }

      try {
        // Katalog client'tan gelir (kullanıcının gerçek erişimi). route()
        // hem AI'a bu sınırı dayatır hem de dönen sonucu katalogla doğrular.
        const intent = await route(message, Array.isArray(catalog) ? catalog : []);
        return intent;
      } catch (e) {
        if (process.env.DEBUG) console.error(e);
        return req.error(422, `İstek işlenemedi: ${e.message}`);
      }
    });

    return super.init();
  }
};
