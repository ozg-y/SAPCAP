'use strict';

const cds = require('@sap/cds');
const { planQuery, summarize } = require('./lib/ai');
const { validatePlan, runPlan } = require('./lib/planner');

module.exports = class ChatService extends cds.ApplicationService {
  async init() {
    this.on('ask', async (req) => {
      const { question } = req.data;
      if (!question || !question.trim()) {
        return req.error(400, 'Lütfen bir soru girin.');
      }

      try {
        // 1) Soru → sorgu planı (Gen AI Hub veya mock)
        const { plan, note } = await planQuery(question);

        // 2) Planı doğrula (güven sınırı) ve çalıştır
        const safePlan = validatePlan(plan);
        const rows = await runPlan(safePlan);

        // 3) Sonucu doğal dilde özetle
        let answer = await summarize(question, rows);
        if (note) answer = `${note}\n\n${answer}`;

        return {
          answer,
          query: JSON.stringify(safePlan),
          data: rows
        };
      } catch (e) {
        if (process.env.DEBUG) console.error(e);
        return req.error(422, `Soru işlenemedi: ${e.message}`);
      }
    });

    return super.init();
  }
};
