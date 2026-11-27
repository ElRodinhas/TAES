const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'recipes.js'), 'utf8');
const PANTRY_KEY = 'smartPantry_inventory';
const SHOPPING_KEY = 'smartPantry.shoppingList';
const missing = [
  { name: 'Onion', amount: 2, unit: 'un' },
  { name: 'Rice', amount: 200, unit: 'g' }
];
const expectedItems = [
  { name: 'Onion', quantity: 2, unit: 'un', checked: false },
  { name: 'Rice', quantity: 200, unit: 'g', checked: false }
];

// Execute production code in an isolated browser-like environment per test.
// No implementation is copied and no global Node state is modified.
function boot({ pantry = [], shopping = [], recipes = [], failReads = false, failWrites = false } = {}) {
  const storage = new Map([
    [PANTRY_KEY, JSON.stringify(pantry)],
    [SHOPPING_KEY, JSON.stringify(shopping)]
  ]);
  const writes = [];
  const alerts = [];
  const fields = new Map();
  function element() {
    return {
      style: {}, children: [], innerHTML: '', textContent: '',
      appendChild(child) { this.children.push(child); },
      addEventListener() {}
    };
  }
  function get(id) {
    if (!fields.has(id)) fields.set(id, element());
    return fields.get(id);
  }
  const context = vm.createContext({
    URLSearchParams,
    document: { addEventListener() {}, getElementById: get, createElement: element },
    localStorage: {
      getItem(key) {
        if (failReads) throw new Error('Storage unavailable');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (failWrites) throw new Error('Storage quota exceeded');
        storage.set(key, value);
        writes.push(key);
      }
    },
    alert(message) { alerts.push(message); },
    estaQuaseAExpirar: () => false,
    fetch: async () => ({ ok: true, json: async () => ({ results: recipes }) })
  });
  vm.runInContext(source, context, { filename: 'recipes.js' });
  return {
    storage, writes, alerts, get,
    add: (ingredients) => context.addMissingIngredientsToShoppingList(ingredients),
    search: () => context.procurarReceitas(),
    select: (index) => context.handleAddMissingIngredients(index),
    list: () => JSON.parse(storage.get(SHOPPING_KEY))
  };
}

test('US-23: transfers missing ingredients with their quantities, units and unchecked state', () => {
  const app = boot();
  assert.equal(app.add(missing), 2);
  assert.deepEqual(app.list(), expectedItems);
  assert.deepEqual(app.writes, [SHOPPING_KEY]);
  assert.match(app.alerts[0], /^2 missing ingredient/);
});

test('US-23: excludes pantry ingredients and preserves unrelated device data', () => {
  const app = boot({ pantry: [{ name: ' TOMATO ', quantity: 3 }] });
  app.storage.set('unrelated-key', 'preserve me');
  const before = new Map(app.storage);
  assert.equal(app.add([{ name: 'tomato', amount: 1 }, ...missing]), 2);
  assert.deepEqual(app.list(), expectedItems);
  for (const [key, value] of before) {
    if (key !== SHOPPING_KEY) assert.equal(app.storage.get(key), value);
  }
  assert.deepEqual(app.writes, [SHOPPING_KEY]);
});

for (const [name, checked] of [['Onion', false], ['ONION', false], [' onion ', true]]) {
  test(`US-23: preserves existing duplicate ${JSON.stringify(name)} (checked=${checked})`, () => {
    const existing = [
      { name, quantity: 5, unit: 'un', checked },
      { name: 'Bread', quantity: 1, unit: 'un', checked: false }
    ];
    const app = boot({ shopping: existing });
    assert.equal(app.add(missing), 1);
    assert.deepEqual(app.list(), [...existing, expectedItems[1]]);
  });
}

test('US-23: repeated transfers do not add duplicates or rewrite the list', () => {
  const app = boot();
  assert.equal(app.add(missing), 2);
  assert.equal(app.add(missing), 0);
  assert.deepEqual(app.list(), expectedItems);
  assert.deepEqual(app.writes, [SHOPPING_KEY]);
});

test('US-23: duplicate ingredients within one response are added only once', () => {
  const app = boot();
  assert.equal(app.add([...missing, { name: ' ONION ', amount: 7, unit: 'un' }]), 2);
  assert.deepEqual(app.list(), expectedItems);
});

test('US-23: nothing missing leaves existing shopping data unchanged', () => {
  const app = boot({ shopping: expectedItems });
  const before = app.storage.get(SHOPPING_KEY);
  assert.equal(app.add([]), 0);
  assert.equal(app.storage.get(SHOPPING_KEY), before);
  assert.deepEqual(app.writes, []);
});

test('US-23: initializes absent storage keys without changing the pantry', () => {
  const app = boot();
  app.storage.clear();
  assert.equal(app.add(missing), 2);
  assert.deepEqual(app.list(), expectedItems);
  assert.equal(app.storage.has(PANTRY_KEY), false);
});

test('US-23: re-reads shopping and pantry changes made since the previous transfer', () => {
  const app = boot();
  app.add(missing);
  app.storage.set(SHOPPING_KEY, JSON.stringify([expectedItems[0]]));
  app.storage.set(PANTRY_KEY, JSON.stringify([{ name: 'Rice', quantity: 1 }]));
  assert.equal(app.add(missing), 0);
  assert.deepEqual(app.list(), [expectedItems[0]]);
  assert.deepEqual(app.writes, [SHOPPING_KEY]);
});

test('US-23: ignores nameless ingredients and supplies defaults for missing quantities and units', () => {
  const app = boot();
  assert.equal(app.add([null, {}, { name: 42 }, { name: '   ' }, { name: ' Carrot ' }]), 1);
  assert.deepEqual(app.list(), [{ name: 'Carrot', quantity: 1, unit: 'un', checked: false }]);
});

for (const key of [PANTRY_KEY, SHOPPING_KEY]) {
  for (const invalid of ['invalid JSON', '{}', 'null']) {
    test(`US-23: invalid stored ${key} (${invalid}) reports failure without overwriting data`, () => {
      const app = boot({ shopping: expectedItems });
      app.storage.set(key, invalid);
      const before = new Map(app.storage);
      assert.equal(app.add(missing), null);
      assert.deepEqual(app.storage, before);
      assert.deepEqual(app.writes, []);
      assert.equal(app.alerts.length, 1);
      assert.match(app.alerts[0], /Não foi possível/);
    });
  }
}

for (const option of ['failReads', 'failWrites']) {
  test(`US-23: ${option} reports failure and preserves saved shopping items`, () => {
    const app = boot({ shopping: [expectedItems[0]], [option]: true });
    const before = new Map(app.storage);
    assert.equal(app.add(missing), null);
    assert.deepEqual(app.storage, before);
    assert.deepEqual(app.writes, []);
    assert.equal(app.alerts.length, 1);
    assert.match(app.alerts[0], /Não foi possível/);
  });
}

test('US-23: discovery renders missing indicators and selecting a card transfers only its ingredients', async () => {
  const app = boot({
    pantry: [{ name: 'Tomato', quantity: 3 }],
    recipes: [
      { title: 'Tomato rice', usedIngredients: [{ name: 'Tomato' }], missedIngredients: missing },
      { title: 'Tomato soup', usedIngredients: [{ name: 'Tomato' }], missedIngredients: [{ name: 'Carrot', amount: 1, unit: 'un' }] },
      { title: 'Fresh tomato', usedIngredients: [{ name: 'Tomato' }], missedIngredients: [] }
    ]
  });
  await app.search();
  const cards = app.get('recipes-list').children;
  assert.equal(cards.length, 3);
  for (const [index, names] of ['Onion, Rice', 'Carrot', 'Nada!'].entries()) {
    assert.ok(cards[index].innerHTML.includes(`<strong>❌ Falta:</strong> ${names}`));
    assert.equal((cards[index].innerHTML.match(/data-testid="add-missing-ingredients"/g) || []).length, 1);
    assert.ok(cards[index].innerHTML.includes(`onclick="handleAddMissingIngredients(${index})"`));
  }
  assert.deepEqual(app.writes, []);
  assert.equal(app.select(1), 1);
  assert.deepEqual(app.list(), [{ name: 'Carrot', quantity: 1, unit: 'un', checked: false }]);
  assert.equal(app.select(2), 0);
  assert.deepEqual(app.writes, [SHOPPING_KEY]);
});
