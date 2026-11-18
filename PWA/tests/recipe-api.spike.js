// Explicit live experiment: node --test PWA/tests/recipe-api.spike.js
// This filename is deliberately excluded from the normal *.test.js test run.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { loadConfig, generateRecipe, DEFAULT_MODEL, OUTPUT_SCHEMA } = require('../../server.js');

loadConfig();
const cases = [
  { id: 'omnivore', ingredients: [{ name: 'frango cozinhado', available: '300 g' }, { name: 'batata cozida', available: '400 g' }, { name: 'azeite', available: '20 ml' }],
    servings: 2, lifestyle: 'omnivore', allergies: [], excludedIngredients: [] },
  { id: 'vegan', ingredients: [{ name: 'grão-de-bico cozido', available: '500 g' }, { name: 'tomate', available: '400 g' }, { name: 'azeite', available: '20 ml' }],
    servings: 3, lifestyle: 'vegan', allergies: [], excludedIngredients: ['cogumelos'] },
  { id: 'allergies', ingredients: [{ name: 'arroz cozido', available: '200 g' }, { name: 'cenoura cozida', available: '150 g' }, { name: 'azeite', available: '10 ml' }],
    servings: 1, lifestyle: 'vegetarian', allergies: ['Peanuts', 'Milk', 'Eggs'], excludedIngredients: ['alho'] }
];
const records = [];
after(async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(__dirname, '../..', `.recipe-spike-evidence-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify({ schema: OUTPUT_SCHEMA, results: records }, null, 2) + '\n');
  console.log(`Evidence saved to ${path.basename(file)}. Manual review remains pending.`);
});
for (const { id, ...data } of cases) {
  test(`Live Gemini spike: ${id}`, { timeout: 60000 }, async () => {
    const input = { ...data, allowMissing: false };
    const record = { case: id, input, model: process.env.GEMINI_MODEL || DEFAULT_MODEL, timestamp: new Date().toISOString(), rawEnvelopes: [],
      manualReview: { ptPT: 'pending', restrictionsAndDerivatives: 'pending', measurementsAndQuantities: 'pending', instructionsAndTimes: 'pending' } };
    const start = performance.now();
    try {
      assert.ok(process.env.GEMINI_API_KEY, 'Set GEMINI_API_KEY in the root .env before running the live spike.');
      record.output = await generateRecipe(input, { fetchImpl: async (...args) => {
        const result = await fetch(...args);
        if (result.ok) {
          const raw = await result.clone().text();
          try { record.rawEnvelopes.push(JSON.parse(raw)); } catch { record.rawEnvelopes.push({ unparseableText: raw }); }
        }
        return result;
      } });
      record.automatedValidation = record.output.status === 'ready' ? 'passed' : 'no_recipe';
      assert.equal(record.output.status, 'ready', 'A no_recipe result does not satisfy the three-success spike criterion.');
    } catch (error) {
      record.automatedValidation ??= 'failed';
      record.error = error.code || 'SPIKE_FAILED';
      throw error;
    } finally {
      record.seconds = Math.round((performance.now() - start) / 10) / 100;
      records.push(record);
    }
  });
}
