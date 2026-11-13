const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const PROFILE_KEY = 'smartPantry.households.v1';
const PANTRY_KEY = 'smartPantry_inventory';
const profiles = { version: 1, activeHouseholdId: 'guests', households: [
  { id: 'family', name: 'Família 🥕', servings: 4, lifestyle: 'omnivore', allergies: [], excludedIngredients: [] },
  { id: 'guests', name: 'Guests', servings: 2, lifestyle: 'vegan', allergies: ['Soy'], excludedIngredients: ['garlic'], futureField: ['keep me'] }
] };
const pantry = [{ id: 'rice', name: 'Rice', quantity: '2', barcode: '012345678905', category: 'Grains', expiry: '2027-01-01', extra: { unit: 'kg' } }];
const backup = () => ({ application: 'SmartPantry', schemaVersion: 1, exportedAt: '2026-11-13T12:00:00.000Z', data: structuredClone({ profiles, pantryStock: pantry }) });
const saved = () => new Map([[PROFILE_KEY, '{"old":"profiles"}'], [PANTRY_KEY, '[]'], ['unrelated', 'keep me']]);

function boot(storage = saved(), options = {}) {
  const elements = new Map(), writes = [];
  let reloads = 0, confirmations = 0;
  function get(id) {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, textContent: '', value: '', files: [], disabled: false,
      addEventListener(type, handler) { this[type] = handler; }
    });
    return elements.get(id);
  }
  const localStorage = {
    getItem(key) {
      if (options.blockRead) throw new Error('Storage blocked');
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      if (key === options.failKey || (options.failRollback && writes.length > 0)) throw new Error('Quota exceeded');
      writes.push(key);
      storage.set(key, value);
    },
    removeItem(key) { storage.delete(key); }
  };
  const context = vm.createContext({
    window: { localStorage, confirm() { confirmations++; return options.confirm !== false; }, location: { reload() { reloads++; } } },
    document: { getElementById: get }, console
  });
  for (const name of ['profiles.js', 'barcode-validation.js', 'export.js']) vm.runInContext(read(name), context);
  return { context, storage, writes, get, api: context.window.SmartPantryExport,
    get reloads() { return reloads; }, get confirmations() { return confirmations; },
    async choose(content, rejectRead = false) {
      get('import-file').files = [{ async text() { if (rejectRead) throw new Error('Unreadable'); return content; } }];
      await get('import-file').change();
    }
  };
}

test('real export/import round trip preserves all fields, active profile and unrelated data', async () => {
  const original = new Map([[PROFILE_KEY, JSON.stringify(profiles)], [PANTRY_KEY, JSON.stringify(pantry)]]);
  const source = boot(original);
  const json = JSON.stringify(source.api.createSnapshot(source.context.window.localStorage));
  const app = boot();
  await app.choose(json);
  assert.deepEqual(JSON.parse(app.storage.get(PROFILE_KEY)), profiles);
  assert.deepEqual(JSON.parse(app.storage.get(PANTRY_KEY)), pantry);
  assert.equal(app.storage.get('unrelated'), 'keep me');
  assert.equal(app.context.window.SmartPantryProfiles.readStoredState().activeHouseholdId, 'guests');
  assert.equal(app.reloads, 1);
  assert.equal(app.confirmations, 1);
  assert.equal(app.get('import-file').value, '');
  assert.equal(app.get('import-data').disabled, false);
});

test('restore works on first launch, and an empty exported backup restores onboarding state', async () => {
  const app = boot(new Map());
  await app.choose(JSON.stringify(backup()));
  assert.deepEqual(JSON.parse(app.storage.get(PROFILE_KEY)), profiles);
  const empty = boot(new Map());
  await empty.choose(JSON.stringify(empty.api.createSnapshot(empty.context.window.localStorage)));
  assert.equal(empty.context.window.SmartPantryProfiles.readStoredState().households.length, 0);
  assert.equal(empty.reloads, 1, empty.get('import-error').textContent);
});

test('cancelling confirmation and cancelling the file picker leave storage untouched', async () => {
  const app = boot(saved(), { confirm: false }), before = new Map(app.storage);
  await app.get('import-file').change();
  assert.equal(app.confirmations, 0);
  await app.choose(JSON.stringify(backup()));
  assert.deepEqual(app.storage, before);
  assert.equal(app.writes.length, 0);
  assert.equal(app.reloads, 0);
  assert.match(app.get('import-status').textContent, /cancelled/);
});

const invalidCases = [
  ['wrong application', (s) => { s.application = 'Other'; }],
  ['new schema version', (s) => { s.schemaVersion = 2; }],
  ['missing timestamp', (s) => { delete s.exportedAt; }],
  ['missing section', (s) => { delete s.data.pantryStock; }],
  ['unknown section', (s) => { s.data.futureFeature = []; }],
  ['invalid profile servings', (s) => { s.data.profiles.households[0].servings = 0; }],
  ['unknown active profile', (s) => { s.data.profiles.activeHouseholdId = 'missing'; }],
  ['duplicate profile id', (s) => { s.data.profiles.households[1].id = 'family'; }],
  ['invalid pantry shape', (s) => { s.data.pantryStock = {}; }],
  ['missing pantry name', (s) => { delete s.data.pantryStock[0].name; }],
  ['invalid quantity', (s) => { s.data.pantryStock[0].quantity = '2"><img src=x>'; }],
  ['zero quantity', (s) => { s.data.pantryStock[0].quantity = 0; }],
  ['impossible date', (s) => { s.data.pantryStock[0].expiry = '2026-02-30'; }],
  ['bad barcode check digit', (s) => { s.data.pantryStock[0].barcode = '012345678906'; }],
  ['numeric barcode', (s) => { s.data.pantryStock[0].barcode = 12345678905; }],
  ['duplicate pantry id', (s) => { s.data.pantryStock.push(s.data.pantryStock[0]); }],
  ['barcode belongs to different product', (s) => { s.data.pantryStock.push({ ...s.data.pantryStock[0], id: 'other', name: 'Beans' }); }]
];
for (const [name, change] of invalidCases) {
  test(`rejects ${name} before confirmation or writes`, async () => {
    const app = boot(), before = new Map(app.storage), snapshot = backup();
    change(snapshot);
    await app.choose(JSON.stringify(snapshot));
    assert.deepEqual(app.storage, before);
    assert.equal(app.writes.length, 0);
    assert.equal(app.confirmations, 0);
    assert.equal(app.reloads, 0);
    assert.equal(app.get('import-error').hidden, false);
  });
}

test('malformed JSON, null and unreadable files report errors and allow another selection', async () => {
  const app = boot(), before = new Map(app.storage);
  for (const [content, failRead] of [['{bad', false], ['null', false], ['', true]]) {
    await app.choose(content, failRead);
    assert.equal(app.get('import-error').hidden, false);
    assert.equal(app.get('import-file').disabled, false);
    assert.deepEqual(app.storage, before);
  }
  await app.choose(JSON.stringify(backup()));
  assert.equal(app.get('import-error').hidden, true);
  assert.equal(app.reloads, 1);
});

for (const firstLaunch of [false, true]) {
  test(`second storage write failure restores previous data (first launch: ${firstLaunch})`, async () => {
    const app = boot(firstLaunch ? new Map() : saved(), { failKey: PANTRY_KEY });
    const before = new Map(app.storage);
    await app.choose(JSON.stringify(backup()));
    assert.deepEqual(app.storage, before);
    assert.match(app.get('import-error').textContent, /previous data was restored/);
    assert.equal(app.reloads, 0);
  });
}

test('blocked reads cause no writes, and rollback failure is reported explicitly', async () => {
  const blocked = boot(saved(), { blockRead: true }), before = new Map(blocked.storage);
  await blocked.choose(JSON.stringify(backup()));
  assert.deepEqual(blocked.storage, before);
  assert.equal(blocked.writes.length, 0);
  assert.equal(blocked.get('import-error').hidden, false);
  const failedRollback = boot(saved(), { failRollback: true });
  await failedRollback.choose(JSON.stringify(backup()));
  assert.match(failedRollback.get('import-error').textContent, /could not be fully restored/);
  assert.equal(failedRollback.reloads, 0);
});

test('imported markup is displayed as pantry text rather than inserted as HTML', async () => {
  const app = boot(), snapshot = backup();
  snapshot.data.pantryStock[0].name = '<img src=x onerror="alert(1)">';
  snapshot.data.pantryStock[0].category = '<b>Grains</b>';
  snapshot.data.pantryStock[0].id = 'rice" onclick="alert(1)';
  await app.choose(JSON.stringify(snapshot));
  app.context.localStorage = app.context.window.localStorage;
  app.context.obterEstadoValidade = () => null;
  app.context.document.addEventListener = () => {};
  vm.runInContext(read('pantry.js'), app.context);
  app.context.renderPantry();
  const html = app.get('pantry-list').innerHTML;
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
  assert.ok(html.includes('&lt;b&gt;Grains&lt;/b&gt;'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('data-id="rice" onclick='));
});
