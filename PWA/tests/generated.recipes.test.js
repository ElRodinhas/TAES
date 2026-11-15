const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'generated-recipes.js'), 'utf8');
const SAVED = 'smartPantry.generatedRecipes.v1';
const recipe = { title: 'Arroz de tomate', servings: 3, prepMinutes: 5, cookMinutes: 10, totalMinutes: 15,
  ingredients: [{ name: 'tomate', quantity: 100, unit: 'g', sourceIndex: 0 }], steps: ['Corta o tomate.', 'Junta o arroz.'] };
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Exercise real event handlers with the same minimal DOM approach as the profile tests.
function boot({ storage = new Map(), reply = () => ({ status: 'ready', recipe }), online = true, household = true, failWrites = false } = {}) {
  function element(tag = '') {
    return {
      tag, value: '', hidden: false, disabled: false, checked: false, textContent: '', dataset: {}, children: [], listeners: {}, style: {}, attributes: {},
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
  const get = (id) => { if (!fields.has(id)) fields.set(id, element()); return fields.get(id); };
  const active = household ? { id: 'home', name: 'Casa', servings: 2, lifestyle: 'vegan', allergies: ['Peanuts'], excludedIngredients: ['cogumelos'] } : null;
  const calls = [];
  const windowListeners = {};
  const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem(key, value) { if (failWrites) throw new Error('full'); storage.set(key, value); } };
  const context = vm.createContext({
    document: { getElementById: get, createElement: element, createTextNode: (text) => Object.assign(element(), { textContent: text }) },
    window: { SmartPantryProfiles: { readStoredState: () => ({ households: active ? [active] : [], activeHouseholdId: active?.id }), renderSwitcher() {} },
      addEventListener: (type, handler) => { windowListeners[type] = handler; } },
    localStorage, navigator: { onLine: online }, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      const data = JSON.parse(options.body);
      calls.push(data);
      const result = await reply(data);
      return { ok: !result.error, json: async () => result };
    }
  });
  vm.runInContext(source, context);
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
  const reloaded = boot({ storage: app.storage, online: false });
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
