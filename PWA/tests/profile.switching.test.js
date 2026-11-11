const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const profileSource = fs.readFileSync(path.join(__dirname, '..', 'profiles.js'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const KEY = 'smartPantry.households.v1';
const profiles = [
  { id: 'family', name: 'Family', servings: 4, lifestyle: 'omnivore', allergies: [], excludedIngredients: [] },
  { id: 'guests', name: 'Guests', servings: 2, lifestyle: 'vegan', allergies: ['Peanuts'], excludedIngredients: ['mushrooms'] }
];

// Run the real app handlers with a minimal DOM, like the barcode validation tests.
function boot(storage = new Map(), failWrites = false, page = 'index.html') {
  function element() {
    return {
      value: '', hidden: false, textContent: '', dataset: {}, children: [], listeners: {},
      appendChild(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      setAttribute() {}, reset() {}, focus() {}, querySelectorAll() { return []; }
    };
  }
  const fields = new Map();
  const get = (id) => {
    if (page !== 'index.html' && id === 'household-form') return null;
    if (!fields.has(id)) fields.set(id, element());
    return fields.get(id);
  };
  const writes = [];
  const context = vm.createContext({
    document: { getElementById: get, createElement: element },
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem(key, value) {
          if (failWrites) throw new Error('Storage blocked');
          writes.push(key);
          storage.set(key, value);
        }
      },
      scrollTo() {}
    },
    navigator: {}
  });
  vm.runInContext(profileSource, context, { filename: 'profiles.js' });
  if (page === 'index.html') vm.runInContext(source, context, { filename: 'app.js' });
  return {
    get, writes, storage,
    choose(id) {
      const selector = get('active-profile');
      selector.value = id;
      selector.listeners.change({ target: selector });
    }
  };
}

function seeded(households = profiles, activeHouseholdId = 'family') {
  return new Map([
    [KEY, JSON.stringify({ version: 1, households, activeHouseholdId })],
    ['smartPantry_inventory', '[{"name":"Rice","quantity":2}]'],
    ['test.shared-data', 'future shared data must survive unchanged']
  ]);
}

test('header switching persists the active profile and preserves all other data', () => {
  const storage = seeded();
  const before = new Map(storage);
  const app = boot(storage);
  assert.equal(app.get('profile-switcher').hidden, false);
  assert.deepEqual(app.get('active-profile').children.map((o) => o.textContent), ['Family', 'Guests']);
  app.choose('guests');
  assert.equal(app.get('active-title').textContent, 'Guests');
  assert.equal(app.get('active-description').textContent, '2 servings · Vegan');
  assert.equal(app.get('active-profile').value, 'guests');
  assert.equal(JSON.parse(storage.get(KEY)).activeHouseholdId, 'guests');
  assert.deepEqual(JSON.parse(storage.get(KEY)).households, profiles);
  for (const [key, value] of before) {
    if (key !== KEY) assert.equal(storage.get(key), value);
  }
  assert.deepEqual(app.writes, [KEY]);
  const reloaded = boot(storage);
  assert.equal(reloaded.get('active-profile').value, 'guests');
  assert.equal(reloaded.get('setup-screen').hidden, true);
  reloaded.choose('family');
  assert.equal(reloaded.get('active-title').textContent, 'Family');
  assert.equal(storage.get(KEY), before.get(KEY));
});

test('failed storage writes restore selection and leave active profile and data unchanged', () => {
  const storage = seeded();
  const before = new Map(storage);
  const app = boot(storage, true);
  app.choose('guests');
  assert.equal(app.get('active-profile').value, 'family');
  assert.equal(app.get('active-title').textContent, 'Family');
  assert.equal(app.get('profile-switch-error').hidden, false);
  assert.match(app.get('profile-switch-error').textContent, /Could not switch/);
  assert.deepEqual(storage, before);
});

test('an unknown profile cannot become active', () => {
  const app = boot(seeded());
  app.choose('missing');
  assert.equal(app.get('active-profile').value, 'family');
  assert.equal(JSON.parse(app.storage.get(KEY)).activeHouseholdId, 'family');
  assert.equal(app.get('profile-switch-error').hidden, false);
  assert.deepEqual(app.writes, []);
});

test('first launch hides the switcher and one saved profile is shown without a redundant write', () => {
  const firstLaunch = boot();
  assert.equal(firstLaunch.get('profile-switcher').hidden, true);
  assert.equal(firstLaunch.get('setup-screen').hidden, false);
  const app = boot(seeded([profiles[0]]));
  assert.equal(app.get('active-profile').children.length, 1);
  app.choose('family');
  assert.deepEqual(app.writes, []);
});

test('management activation and deletion keep the header in sync', () => {
  const app = boot(seeded());
  function click(action, householdId) {
    app.get('household-list').listeners.click({
      target: { closest: () => ({ dataset: { action, householdId } }) }
    });
  }
  click('activate', 'guests');
  assert.equal(app.get('active-profile').value, 'guests');
  click('confirm-delete', 'guests');
  assert.equal(app.get('active-profile').value, 'family');
  assert.equal(app.get('active-profile').children.length, 1);
  click('confirm-delete', 'family');
  assert.equal(app.get('profile-switcher').hidden, true);
  assert.equal(app.get('setup-screen').hidden, false);
});

for (const page of ['pantry.html', 'scan.html']) {
  test(`${page}: switching persists across navigation without changing page contents or shared data`, () => {
    const storage = seeded();
    const before = new Map(storage);
    const app = boot(storage, false, page);
    app.get('pantry-list').innerHTML = 'Existing pantry items';
    app.get('productName').value = 'Unsaved product';
    app.choose('guests');
    assert.equal(app.get('active-profile').value, 'guests');
    assert.equal(app.get('pantry-list').innerHTML, 'Existing pantry items');
    assert.equal(app.get('productName').value, 'Unsaved product');
    assert.deepEqual(app.writes, [KEY]);
    assert.deepEqual(JSON.parse(storage.get(KEY)).households, profiles);
    for (const [key, value] of before) {
      if (key !== KEY) assert.equal(storage.get(key), value);
    }
    for (const nextPage of ['index.html', 'pantry.html', 'scan.html']) {
      assert.equal(boot(storage, false, nextPage).get('active-profile').value, 'guests');
    }
  });

  test(`${page}: failed writes and missing profiles are handled safely`, () => {
    const storage = seeded();
    const before = new Map(storage);
    const app = boot(storage, true, page);
    app.choose('guests');
    assert.equal(app.get('active-profile').value, 'family');
    assert.equal(app.get('profile-switch-error').hidden, false);
    assert.deepEqual(storage, before);
    assert.equal(boot(new Map(), false, page).get('profile-switcher').hidden, true);
  });
}

test('switching uses current saved preferences instead of overwriting newer changes', () => {
  const app = boot(seeded(), false, 'pantry.html');
  const newer = JSON.parse(app.storage.get(KEY));
  newer.households[1].servings = 6;
  app.storage.set(KEY, JSON.stringify(newer));
  app.choose('guests');
  assert.equal(JSON.parse(app.storage.get(KEY)).households[1].servings, 6);
});
