const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { RecipeError, validateInput, validateOutput, generateRecipe, createRequestHandler, loadConfig } = require('../../server.js');

function input() {
  return { ingredients: [{ name: 'tomate', available: '300 g' }, { name: 'arroz cozido', available: '200 g' }],
    servings: 2, lifestyle: 'vegan', allergies: ['Peanuts'], excludedIngredients: ['cogumelos'], allowMissing: false };
}
function output() {
  return { status: 'ready', recipe: { title: 'Arroz de tomate', servings: 2, prepMinutes: 5, cookMinutes: 10, totalMinutes: 15,
    ingredients: [{ name: 'tomate', quantity: 300, unit: 'g', sourceIndex: 0 }, { name: 'arroz cozido', quantity: 200, unit: 'g', sourceIndex: 1 }],
    steps: ['Corta o tomate.', 'Aquece o tomate e junta o arroz cozido.'] } };
}
const response = (value = output()) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
const errorCode = (code) => (error) => error instanceof RecipeError && error.code === code;
const options = (fetchImpl) => ({ key: 'fixture-key', fetchImpl, sleeper: async () => {} });

test('Gemini receives ingredients, restrictions, servings and JSON schema; key stays in the header', async () => {
  let request;
  const result = await generateRecipe({ ...input(), profileName: 'private household name' }, options(async (url, init) => {
    request = { url, init };
    return response();
  }));
  assert.deepEqual(result, output());
  const payload = JSON.parse(request.init.body);
  assert.deepEqual(JSON.parse(payload.contents[0].parts[0].text), input());
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
  assert.ok(payload.generationConfig.responseJsonSchema.properties.recipe);
  assert.equal(request.init.headers['x-goog-api-key'], 'fixture-key');
  assert.equal(request.url.includes('fixture-key'), false);
  assert.equal(request.init.body.includes('private household name'), false);
  assert.match(payload.systemInstruction.parts[0].text, /pt-PT/);
});

test('invalid ingredient lists, servings and restrictions fail before calling Gemini', async () => {
  const invalid = [null, [], { ...input(), ingredients: [] }, { ...input(), ingredients: [{ name: '' }] },
    { ...input(), ingredients: [{ name: 'tomate', available: null }] },
    ...[0, 31, 1.5, true, '2'].map((servings) => ({ ...input(), servings })),
    { ...input(), allergies: ['unknown'] }, { ...input(), allowMissing: 'yes' }, { ...input(), lifestyle: 'unknown' }];
  for (const data of invalid) {
    await assert.rejects(generateRecipe(data, options(() => assert.fail('Unexpected API request'))), errorCode('INPUT'));
  }
});

test('known incompatible input ingredients are rejected before an API request', async () => {
  for (const name of ['amendoim', 'cogumelos', 'frango', 'queijo']) {
    const data = input();
    data.ingredients[0].name = name;
    await assert.rejects(generateRecipe(data, options(() => assert.fail('Unexpected API request'))), errorCode('RESTRICTION'));
  }
});

test('a recipe may use only a subset of supplied ingredients', () => {
  const result = output();
  result.recipe.ingredients.pop();
  assert.deepEqual(validateOutput(result, input()), result);
});

test('missing ingredients need explicit permission and must still respect restrictions', () => {
  const result = output();
  result.recipe.ingredients.push({ name: 'azeite', quantity: 10, unit: 'ml', sourceIndex: null });
  assert.throws(() => validateOutput(result, input()), errorCode('INVALID_RECIPE'));
  const permitted = { ...input(), allowMissing: true };
  assert.deepEqual(validateOutput(result, permitted), result);
  result.recipe.ingredients.at(-1).name = 'amendoim';
  assert.throws(() => validateOutput(result, permitted), errorCode('RESTRICTION'));
});

test('forged ingredient references, repeated sources and forbidden instructions are rejected', () => {
  for (const value of [-1, 40, true, '0']) {
    const result = output();
    result.recipe.ingredients[0].sourceIndex = value;
    assert.throws(() => validateOutput(result, input()), errorCode('INVALID_RECIPE'));
  }
  const forged = output();
  forged.recipe.ingredients[0].name = 'azeite';
  assert.throws(() => validateOutput(forged, input()), errorCode('INVALID_RECIPE'));
  const duplicate = output();
  duplicate.recipe.ingredients.push({ ...duplicate.recipe.ingredients[0] });
  assert.throws(() => validateOutput(duplicate, input()), errorCode('INVALID_RECIPE'));
  const forbidden = output();
  forbidden.recipe.steps.push('Junta leite.');
  assert.throws(() => validateOutput(forbidden, input()), errorCode('RESTRICTION'));
});

test('incomplete recipes, incorrect portions, times and measurements are rejected', () => {
  for (const [key, value] of [['servings', 3], ['prepMinutes', -1], ['cookMinutes', true], ['totalMinutes', 0], ['steps', []], ['steps', ['']], ['title', '']]) {
    const result = output();
    result.recipe[key] = value;
    assert.throws(() => validateOutput(result, input()), errorCode('INVALID_RECIPE'));
  }
  for (const quantity of [0, -1, true, NaN, Infinity, '100']) {
    const result = output();
    result.recipe.ingredients[0].quantity = quantity;
    assert.throws(() => validateOutput(result, input()), errorCode('INVALID_RECIPE'));
  }
  assert.throws(() => validateOutput({}, input()), errorCode('INVALID_RECIPE'));
});

test('no_recipe is a valid response but cannot contain a recipe', () => {
  assert.deepEqual(validateOutput({ status: 'no_recipe', recipe: null }, input()), { status: 'no_recipe', recipe: null });
  assert.throws(() => validateOutput({ status: 'no_recipe', recipe: output().recipe }, input()), errorCode('INVALID_RECIPE'));
});

test('temporary HTTP failures retry once, and then return an error', async () => {
  for (const status of [500, 502, 503, 504]) {
    let calls = 0;
    await generateRecipe(input(), options(async () => ++calls === 1 ? new Response('', { status }) : response()));
    assert.equal(calls, 2);
    calls = 0;
    await assert.rejects(generateRecipe(input(), options(async () => { calls++; return new Response('', { status }); })), errorCode('UNAVAILABLE'));
    assert.equal(calls, 2);
  }
});

test('network failures and timeouts are bounded to two attempts', async () => {
  for (const [failure, code] of [[new TypeError('offline'), 'UNAVAILABLE'], [new DOMException('timeout', 'TimeoutError'), 'TIMEOUT']]) {
    let calls = 0;
    await assert.rejects(generateRecipe(input(), options(async () => { calls++; throw failure; })), errorCode(code));
    assert.equal(calls, 2);
  }
});

test('quota, credential and model failures are not retried or echoed to the caller', async () => {
  for (const [status, code] of [[429, 'QUOTA'], [400, 'NOT_CONFIGURED'], [401, 'NOT_CONFIGURED'], [403, 'NOT_CONFIGURED'], [404, 'NOT_CONFIGURED']]) {
    let calls = 0;
    await assert.rejects(generateRecipe(input(), options(async () => { calls++; return new Response('private provider body', { status }); })), errorCode(code));
    assert.equal(calls, 1);
  }
});

test('blocked, truncated, malformed and oversized output is never retried', async () => {
  const cases = [[JSON.stringify({ candidates: [] }), 'BLOCKED'], [JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), 'BLOCKED'],
    [JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), 'BLOCKED'],
    [JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), 'INVALID_RECIPE'],
    [JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [null] } }] }), 'INVALID_RECIPE'],
    ['{', 'INVALID_RECIPE'], [' '.repeat(1_000_001), 'INVALID_RECIPE']];
  for (const [raw, code] of cases) {
    let calls = 0;
    await assert.rejects(generateRecipe(input(), options(async () => { calls++; return new Response(raw); })), errorCode(code));
    assert.equal(calls, 1);
  }
});

test('missing key or invalid model fails without a network request', async () => {
  for (const config of [{ key: '' }, { key: 'fixture', model: '../invalid-model' }]) {
    await assert.rejects(generateRecipe(input(), { ...options(() => assert.fail('Unexpected API request')), ...config }), errorCode('NOT_CONFIGURED'));
  }
});

async function httpRequest({ method = 'POST', url = '/api/generate-recipe', headers = {}, body = JSON.stringify(input()), generate, root } = {}) {
  const request = Readable.from([Buffer.from(body)]);
  Object.assign(request, { method, url, headers: { host: 'localhost:8000', 'content-type': 'application/json', ...headers } });
  const result = { status: null, headers: {}, body: '' };
  const response = { writeHead(status, values) { result.status = status; result.headers = values; }, end(value) { result.body = value?.toString() || ''; } };
  await createRequestHandler({ generate, root })(request, response);
  return result;
}

test('HTTP endpoint forwards valid input and supports same-host HTTPS tunnels', async () => {
  for (const origin of ['http://localhost:8000', 'https://localhost:8000']) {
    const result = await httpRequest({ headers: { origin }, generate: async (data) => { assert.deepEqual(data, input()); return output(); } });
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), output());
    assert.equal(result.headers['Cache-Control'], 'no-store');
  }
});

test('HTTP endpoint rejects cross-origin, non-JSON, malformed and oversized requests', async () => {
  for (const [args, status] of [[{ headers: { origin: 'https://other.test' } }, 403], [{ headers: { 'content-type': 'text/plain' } }, 400],
    [{ body: '{' }, 400], [{ body: ' '.repeat(20001) }, 400], [{ headers: { 'content-length': '20001' } }, 400]]) {
    const result = await httpRequest({ ...args, generate: async () => assert.fail('Unexpected API request') });
    assert.equal(result.status, status);
  }
});

test('HTTP reports adapter errors without leaking private exception details', async () => {
  for (const [error, status, code] of [[new RecipeError('NOT_CONFIGURED', 503), 503, 'NOT_CONFIGURED'], [new Error('private-key-value'), 503, 'UNAVAILABLE']]) {
    const result = await httpRequest({ generate: async () => { throw error; } });
    assert.equal(result.status, status);
    assert.deepEqual(JSON.parse(result.body), { error: code });
  }
});

test('static GET/HEAD serve app files and deny hidden files, traversal, directories and escaping symlinks', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartpantry-http-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'PWA');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'index.html'), '<h1>SmartPantry</h1>');
  await fs.writeFile(path.join(directory, '.env'), 'private fixture');
  await fs.writeFile(path.join(root, '.env'), 'private fixture');
  await fs.symlink(path.join(directory, '.env'), path.join(root, 'leaked.txt'));
  await fs.mkdir(path.join(root, 'no-index'));
  for (const method of ['GET', 'HEAD']) {
    const valid = await httpRequest({ method, url: '/', root });
    assert.equal(valid.status, 200);
    assert.equal(valid.body, method === 'HEAD' ? '' : '<h1>SmartPantry</h1>');
    assert.equal(valid.headers['Content-Type'], 'text/html; charset=utf-8');
    for (const url of ['/.env', '/%2eenv', '/..%2f.env', '/leaked.txt', '/no-index/', '/missing.js', '/%zz']) {
      const result = await httpRequest({ method, url, root });
      assert.ok([400, 404].includes(result.status), url);
      assert.equal(result.body.includes('private fixture'), false);
    }
  }
});

test('root dotenv loader preserves terminal overrides and treats values as literal text', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'smartpantry-env-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const saved = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL };
  t.after(() => {
    for (const [key, value] of [['GEMINI_API_KEY', saved.key], ['GEMINI_MODEL', saved.model]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  const file = path.join(directory, '.env');
  await fs.writeFile(file, '# local fixture\nGEMINI_API_KEY="fixture#key"\nGEMINI_MODEL=$(literal-example)\n');
  loadConfig(file);
  assert.equal(process.env.GEMINI_API_KEY, 'fixture#key');
  assert.equal(process.env.GEMINI_MODEL, '$(literal-example)');
  process.env.GEMINI_API_KEY = 'terminal-override';
  loadConfig(file);
  assert.equal(process.env.GEMINI_API_KEY, 'terminal-override');
  assert.doesNotThrow(() => loadConfig(path.join(directory, 'missing.env')));
});
