const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'export.js'), 'utf8');
const PROFILE_KEY = 'smartPantry.households.v1';
const PANTRY_KEY = 'smartPantry_inventory';
const profiles = { version: 1, activeHouseholdId: 'guests', households: [
  { id: 'family', name: 'Família 🥕', servings: 4, lifestyle: 'omnivore', allergies: [], excludedIngredients: [] },
  { id: 'guests', name: 'Guests', servings: 2, lifestyle: 'vegan', allergies: ['Soy'], excludedIngredients: ['garlic'] }
] };
const pantry = [{ id: 'rice', name: 'Rice', quantity: 2, barcode: '0012345678905', category: 'Grains', expiry: '2027-01-01', futureField: { unit: 'kg' } }];
const seeded = () => new Map([[PROFILE_KEY, JSON.stringify(profiles)], [PANTRY_KEY, JSON.stringify(pantry)], ['unrelated', 'private value']]);

function boot(storage = seeded(), options = {}) {
  const elements = new Map(['export-data', 'export-error', 'export-status', 'import-data', 'import-file'].map((id) => [id, {
    hidden: true, textContent: '', addEventListener(type, handler) { this[type] = handler; }
  }]));
  const downloads = [], blobs = [], revoked = [], timers = [], links = [];
  const context = vm.createContext({
    window: { localStorage: { getItem(key) {
      if (options.blockRead) throw new Error('Storage blocked');
      return storage.get(key) ?? null;
    } } },
    document: {
      getElementById: (id) => elements.get(id), body: { appendChild() {} },
      createElement() {
        const link = { click() {
          if (options.blockDownload) throw new Error('Download blocked');
          downloads.push({ href: this.href, filename: this.download });
        }, remove() { this.removed = true; } };
        links.push(link);
        return link;
      }
    },
    Blob, URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:backup'; }, revokeObjectURL(url) { revoked.push(url); } },
    setTimeout(callback) { timers.push(callback); }
  });
  vm.runInContext(source, context);
  return { context, elements, downloads, blobs, revoked, timers, links,
    click() { elements.get('export-data').click(); } };
}

test('download preserves all saved fields, active selection, Unicode and barcode zeros', async () => {
  const storage = seeded(), before = new Map(storage), app = boot(storage);
  app.click();
  assert.equal(app.downloads.length, 1);
  assert.match(app.downloads[0].filename, /^smartpantry-backup-.*\.json$/);
  assert.equal(app.blobs[0].type, 'application/json');
  const result = JSON.parse(await app.blobs[0].text());
  assert.equal(result.application, 'SmartPantry');
  assert.equal(result.schemaVersion, 1);
  assert.equal(new Date(result.exportedAt).toISOString(), result.exportedAt);
  assert.deepEqual(result.data, { profiles, pantryStock: pantry });
  assert.deepEqual(storage, before);
  assert.equal(app.links[0].removed, true);
  assert.deepEqual(app.revoked, []);
  app.timers[0]();
  assert.deepEqual(app.revoked, ['blob:backup']);
  assert.equal(app.elements.get('export-error').hidden, true);
  assert.match(app.elements.get('export-status').textContent, /Check your browser downloads/);
});

test('first launch exports documented empty values without saving them', async () => {
  const storage = new Map(), app = boot(storage);
  app.click();
  const result = JSON.parse(await app.blobs[0].text());
  assert.deepEqual(result.data, { profiles: { version: 1, households: [], activeHouseholdId: null }, pantryStock: [] });
  assert.equal(storage.size, 0);
});

test('export reads fresh storage each time and includes new nested fields automatically', async () => {
  const storage = seeded(), app = boot(storage);
  app.click();
  storage.set(PANTRY_KEY, JSON.stringify([...pantry, { name: 'Beans', quantity: 5, extra: ['new'] }]));
  app.click();
  assert.deepEqual(JSON.parse(await app.blobs[1].text()).data.pantryStock, [...pantry, { name: 'Beans', quantity: 5, extra: ['new'] }]);
});

for (const key of [PROFILE_KEY, PANTRY_KEY]) {
  test(`invalid JSON in ${key} blocks the entire download and can be retried`, () => {
    const storage = seeded();
    storage.set(key, '{broken');
    const before = new Map(storage), app = boot(storage);
    app.click();
    assert.equal(app.downloads.length, 0);
    assert.equal(app.blobs.length, 0);
    assert.equal(app.elements.get('export-error').hidden, false);
    assert.equal(app.elements.get('export-status').textContent, '');
    assert.deepEqual(storage, before);
    storage.delete(key);
    app.click();
    assert.equal(app.downloads.length, 1);
    assert.equal(app.elements.get('export-error').hidden, true);
  });
}

for (const option of ['blockRead', 'blockDownload']) {
  test(`${option} shows an error and preserves saved data`, () => {
    const storage = seeded(), before = new Map(storage), app = boot(storage, { [option]: true });
    app.click();
    assert.equal(app.downloads.length, 0);
    assert.equal(app.elements.get('export-error').hidden, false);
    assert.deepEqual(storage, before);
    if (option === 'blockDownload') {
      assert.equal(app.links[0].removed, true);
      app.timers[0]();
      assert.deepEqual(app.revoked, ['blob:backup']);
    }
  });
}
