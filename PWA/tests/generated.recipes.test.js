const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'generated-recipes.js'), 'utf8');
const bookSource = fs.readFileSync(path.join(__dirname, '..', 'recipe-book.js'), 'utf8');
const SAVED = 'smartPantry.generatedRecipes.v1';
const recipe = { title: 'Arroz de tomate', servings: 3, prepMinutes: 5, cookMinutes: 10, totalMinutes: 15,
  ingredients: [{ name: 'tomate', quantity: 100, unit: 'g', sourceIndex: 0 }], steps: ['Corta o tomate.', 'Junta o arroz.'] };
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Exercise real event handlers with the same minimal DOM approach as the profile tests.
function boot({ storage = new Map(), reply = () => ({ status: 'ready', recipe }), online = true, household = true, failWrites = false, failReads = false, page = 'discovery' } = {}) {
  function element(tag = '') {
    return {
      tag, open: false, value: '', hidden: false, disabled: false, checked: false, textContent: '', dataset: {}, children: [], listeners: {}, style: {}, attributes: {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      setAttribute(key, value) { this.attributes[key] = value; },
      querySelectorAll(selector) {
        const all = this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
        if (selector === 'input:checked') return all.filter((child) => child.tag === 'input' && child.checked);
        if (selector === 'input, button') return all.filter((child) => ['input', 'button'].includes(child.tag));
        return all;
      }
    };
  }
  const fields = new Map();
  const get = (id) => {
    if (page === 'discovery' && ['saved-recipes', 'saved-search', 'saved-status'].includes(id)) return null;
    if (page === 'saved' && id === 'saved-recipes-link') return null;
    if (!fields.has(id)) fields.set(id, element());
    return fields.get(id);
  };
  const active = household ? { id: 'home', name: 'Casa', servings: 2, lifestyle: 'vegan', allergies: ['Peanuts'], excludedIngredients: ['cogumelos'] } : null;
  const calls = [];
  const windowListeners = {};
  const localStorage = { getItem: (key) => { if (failReads) throw new Error('unavailable'); return storage.get(key) ?? null; }, setItem(key, value) { if (failWrites) throw new Error('full'); storage.set(key, value); } };
  const context = vm.createContext({
    document: { getElementById: get, createElement: element, createTextNode: (text) => Object.assign(element(), { textContent: text }) },
    window: { SmartPantryProfiles: { readStoredState: () => ({ households: active ? [active] : [], activeHouseholdId: active?.id }), renderSwitcher() {} },
      addEventListener: (type, handler) => { const previous = windowListeners[type]; windowListeners[type] = (event) => { previous?.(event); handler(event); }; } },
    localStorage, navigator: { onLine: online }, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      const data = JSON.parse(options.body);
      calls.push(data);
      const result = await reply(data);
      return { ok: !result.error, json: async () => result };
    }
  });
  vm.runInContext(bookSource, context);
  if (page === 'discovery') vm.runInContext(source, context);
  const app = {
    get, storage, calls, active, windowListeners,
    click(id) { get(id).listeners.click(); },
    add(name = 'arroz cozido', amount = '200 g') { get('leftover-name').value = name; get('leftover-amount').value = amount; app.click('add-leftover'); },
    async submit(servings = '3') { get('generation-servings').value = servings; get('generate-form').listeners.submit({ preventDefault() {} }); await tick(); },
    text(node) { return node.textContent + node.children.map((child) => app.text(child)).join(' '); }
  };
  return app;
}

test('defaults to active servings and sends combined ingredients and dietary constraints', async () => {
  const storage = new Map([['smartPantry_inventory', JSON.stringify([{ name: 'tomate', quantity: 300, unit: 'g' }])]]);
  const app = boot({ storage });
  assert.equal(app.get('generation-servings').value, 2);
  app.get('generation-pantry').children[0].children[0].checked = true;
  app.add();
  await app.submit();
  assert.deepEqual(app.calls[0], { ingredients: [{ name: 'tomate', available: '300 g' }, { name: 'arroz cozido', available: '200 g' }], servings: 3,
    lifestyle: 'vegan', allergies: ['Peanuts'], excludedIngredients: ['cogumelos'], allowMissing: false });
  assert.match(app.text(app.get('generated-recipe')), /Arroz de tomate/);
});

test('missing ingredients require an explicit second action; edited inputs invalidate consent', async () => {
  const app = boot({ reply: (data) => data.allowMissing ? { status: 'ready', recipe } : { status: 'no_recipe', recipe: null } });
  app.add();
  await app.submit();
  assert.equal(app.calls.length, 1);
  assert.equal(app.get('missing-consent').hidden, false);
  assert.equal(app.get('generated-recipe').children.length, 0);
  app.click('allow-missing');
  await tick();
  assert.equal(app.calls.length, 2);
  assert.equal(app.calls[1].allowMissing, true);
  await app.submit();
  app.add('cebola', '');
  assert.equal(app.get('missing-consent').hidden, true);
  app.click('allow-missing');
  await tick();
  assert.equal(app.calls.length, 3);
});

test('saved recipes survive reload offline without API requests or changing shared inventory', async () => {
  const app = boot();
  app.add();
  await app.submit();
  const card = app.get('generated-recipe').children[0];
  card.children.find((child) => child.dataset.testid === 'save-generated-recipe').listeners.click();
  assert.equal(JSON.parse(app.storage.get(SAVED)).length, 1);
  const reloaded = boot({ storage: app.storage, online: false, page: 'saved' });
  assert.match(reloaded.text(reloaded.get('saved-recipes')), /Arroz de tomate/);
  assert.equal(reloaded.calls.length, 0);
  assert.deepEqual([...app.storage.keys()], [SAVED]);
});

test('first launch, empty ingredients and offline generation never call the API', async () => {
  for (const options of [{ household: false }, {}, { online: false }]) {
    const app = boot(options);
    if (options.online === false || options.household === false) app.add();
    await app.submit();
    assert.equal(app.calls.length, 0);
    assert.notEqual(app.get('generation-message').textContent, '');
  }
});

test('service failures preserve entered ingredients and allow another request', async () => {
  for (const error of ['QUOTA', 'TIMEOUT', 'BLOCKED', 'INVALID_RECIPE', 'RESTRICTION', 'NOT_CONFIGURED']) {
    const app = boot({ reply: () => ({ error }) });
    app.add();
    await app.submit();
    assert.match(app.text(app.get('leftover-list')), /arroz cozido/);
    assert.equal(app.get('generated-recipe').children.length, 0);
    assert.notEqual(app.get('generation-message').textContent, '');
    await app.submit();
    assert.equal(app.calls.length, 2);
  }
});

test('storage failures retain generated result and report unsuccessful save', async () => {
  const app = boot({ failWrites: true });
  app.add();
  await app.submit();
  const save = app.get('generated-recipe').children[0].children.find((child) => child.dataset.testid === 'save-generated-recipe');
  save.listeners.click();
  assert.match(app.get('generation-message').textContent, /Não foi possível guardar/);
  assert.equal(app.storage.has(SAVED), false);
  assert.equal(app.get('generated-recipe').children.length, 1);
});

test('generated text is rendered as text, and a profile change invalidates an in-flight recipe', async () => {
  let release;
  const app = boot({ reply: () => new Promise((resolve) => { release = resolve; }) });
  app.add('<img src=x onerror=alert(1)>');
  await app.submit();
  assert.match(app.text(app.get('leftover-list')), /<img src=x/);
  app.active.id = 'other';
  release({ status: 'ready', recipe });
  await tick();
  assert.equal(app.get('generated-recipe').children.length, 0);
  assert.match(app.get('generation-message').textContent, /perfil válido/);
});

test('discovery shows a saved-recipe count, updated after saving without rendering the collection', async () => {
  const app = boot();
  assert.equal(app.get('saved-recipes-link').textContent, 'Receitas Guardadas (0)');
  app.add();
  await app.submit();
  const save = app.get('generated-recipe').children[0].children.find((child) => child.dataset.testid === 'save-generated-recipe');
  save.listeners.click();
  assert.equal(app.get('saved-recipes-link').textContent, 'Receitas Guardadas (1)');
  save.listeners.click();
  assert.equal(JSON.parse(app.storage.get(SAVED)).length, 1);
  assert.equal(app.get('saved-recipes'), null);
});

test('existing saved recipes open as collapsed cards with portions and total time, without storage changes', () => {
  const storage = new Map([[SAVED, JSON.stringify([recipe, { ...recipe, title: 'Sopa de legumes' }])], ['smartPantry_inventory', '[]']]);
  const before = new Map(storage);
  const app = boot({ storage, page: 'saved', online: false, household: false });
  const cards = app.get('saved-recipes').children;
  assert.equal(cards.length, 2);
  for (const card of cards) {
    assert.equal(card.tag, 'details');
    assert.equal(card.open, false);
    assert.equal(card.children[0].tag, 'summary');
    assert.match(app.text(card.children[0]), /3 porções · 15 min/);
    assert.match(app.text(card.children[1]), /100 g de tomate/);
    assert.ok(card.children[1].children.some((child) => child.tag === 'ol'));
  }
  assert.deepEqual(storage, before);
  assert.equal(app.calls.length, 0);
});

test('saved title search ignores case and accents and distinguishes empty and no-match states', () => {
  const storage = new Map([[SAVED, JSON.stringify([recipe, { ...recipe, title: 'Grão com legumes' }])]]);
  const app = boot({ storage, page: 'saved' });
  app.get('saved-search').value = ' GRAO ';
  app.get('saved-search').listeners.input();
  assert.equal(app.get('saved-recipes').children.length, 1);
  assert.match(app.text(app.get('saved-recipes')), /Grão com legumes/);
  assert.equal(app.get('saved-status').textContent, '1 de 2 receitas');
  app.get('saved-search').value = 'inexistente';
  app.get('saved-search').listeners.input();
  assert.match(app.text(app.get('saved-recipes')), /Não foram encontradas/);
  app.get('saved-search').value = '';
  app.get('saved-search').listeners.input();
  assert.equal(app.get('saved-recipes').children.length, 2);
  const empty = boot({ page: 'saved' });
  assert.match(empty.text(empty.get('saved-recipes')), /Ainda não guardaste/);
});

test('saved page reports malformed or inaccessible storage without overwriting it', () => {
  for (const raw of ['{', '{}', '[{"title":"Incomplete"}]']) {
    const storage = new Map([[SAVED, raw]]);
    const app = boot({ storage, page: 'saved' });
    assert.match(app.get('saved-status').textContent, /Não foi possível ler/);
    assert.equal(storage.get(SAVED), raw);
    assert.equal(app.get('saved-recipes').children.length, 0);
  }
  const app = boot({ page: 'saved', failReads: true });
  assert.match(app.get('saved-status').textContent, /Não foi possível ler/);
});

test('saved page and discovery count refresh on changes from another tab', () => {
  const storage = new Map();
  const saved = boot({ storage, page: 'saved' });
  const discovery = boot({ storage });
  storage.set(SAVED, JSON.stringify([recipe]));
  saved.windowListeners.storage({ key: SAVED });
  discovery.windowListeners.storage({ key: SAVED });
  assert.match(saved.text(saved.get('saved-recipes')), /Arroz de tomate/);
  assert.equal(discovery.get('saved-recipes-link').textContent, 'Receitas Guardadas (1)');
  storage.delete(SAVED);
  saved.windowListeners.storage({ key: null });
  discovery.windowListeners.storage({ key: null });
  assert.match(saved.text(saved.get('saved-recipes')), /Ainda não guardaste/);
  assert.equal(discovery.get('saved-recipes-link').textContent, 'Receitas Guardadas (0)');
});

test('saved titles and instructions remain literal text', () => {
  const title = '<img src=x onerror=alert(1)>';
  const storage = new Map([[SAVED, JSON.stringify([{ ...recipe, title, steps: ['<script>alert(1)</script>'] }])]]);
  const app = boot({ storage, page: 'saved' });
  const card = app.get('saved-recipes').children[0];
  assert.equal(card.children[0].children[0].textContent, title);
  assert.equal(card.children[0].children[0].children.length, 0);
  assert.match(app.text(card), /<script>alert\(1\)<\/script>/);
});
