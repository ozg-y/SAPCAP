'use strict';

const cds = require('@sap/cds');
const { ENTITIES, ALLOWED_OPS, ALLOWED_AGG } = require('./model');

/**
 * LLM'den gelen JSON sorgu planını doğrular. Geçersiz entity/alan/operatör
 * varsa hata fırlatır — bu, modelin ürettiği planı güven sınırına sokar.
 *
 * Plan şekli:
 * {
 *   entity: 'Orders',
 *   columns?: ['orderNo','total'],
 *   where?: [{ field:'status', op:'=', value:'DELIVERED' }],
 *   groupBy?: ['status'],
 *   aggregate?: { func:'sum', field:'total', as:'totalSum' },
 *   orderBy?: [{ field:'total', desc:true }],
 *   limit?: 10
 * }
 */
function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('Geçersiz sorgu planı.');

  const entityDef = ENTITIES[plan.entity];
  if (!entityDef) throw new Error(`Bilinmeyen entity: ${plan.entity}`);
  const fields = entityDef.fields;

  const assertField = (f) => {
    if (!fields[f]) throw new Error(`Bilinmeyen alan: ${plan.entity}.${f}`);
  };

  (plan.columns || []).forEach(assertField);
  (plan.groupBy || []).forEach(assertField);

  (plan.where || []).forEach((w) => {
    assertField(w.field);
    if (!ALLOWED_OPS.includes(w.op)) throw new Error(`İzin verilmeyen operatör: ${w.op}`);
  });

  (plan.orderBy || []).forEach((o) => assertField(o.field));

  if (plan.aggregate) {
    if (!ALLOWED_AGG.includes(plan.aggregate.func)) {
      throw new Error(`İzin verilmeyen agregasyon: ${plan.aggregate.func}`);
    }
    if (plan.aggregate.func !== 'count') assertField(plan.aggregate.field);
  }

  const limit = Number.isInteger(plan.limit) ? Math.min(plan.limit, 100) : 50;
  return { ...plan, limit };
}

/** CQN kolon ifadesi üretir (string alan veya agregasyon fonksiyonu). */
function aggColumn(agg) {
  const alias = agg.as || `${agg.func}_${agg.field || 'all'}`;
  if (agg.func === 'count') return { func: 'count', args: [{ val: 1 }], as: alias };
  return { func: agg.func, args: [{ ref: [agg.field] }], as: alias };
}

/** Doğrulanmış planı CQN sorgusuna çevirip çalıştırır. */
async function runPlan(plan) {
  const entity = `ChatService.${plan.entity}`;
  const q = SELECT.from(entity);

  // Kolonlar / agregasyon
  if (plan.aggregate || (plan.groupBy && plan.groupBy.length)) {
    const cols = (plan.groupBy || []).map((f) => ({ ref: [f] }));
    if (plan.aggregate) cols.push(aggColumn(plan.aggregate));
    q.columns(...cols);
  } else if (plan.columns && plan.columns.length) {
    q.columns(...plan.columns.map((f) => ({ ref: [f] })));
  }

  // WHERE (AND'lenir)
  (plan.where || []).forEach((w) => {
    if (w.op === 'in' && Array.isArray(w.value)) {
      q.where(`${w.field} in`, w.value);
    } else {
      q.where(`${w.field} ${w.op}`, w.value);
    }
  });

  if (plan.groupBy && plan.groupBy.length) q.groupBy(...plan.groupBy);

  (plan.orderBy || []).forEach((o) => {
    q.orderBy(o.desc ? `${o.field} desc` : `${o.field} asc`);
  });

  q.limit(plan.limit);

  return cds.run(q);
}

module.exports = { validatePlan, runPlan };
