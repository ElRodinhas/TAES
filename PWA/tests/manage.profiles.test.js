const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const profileSource = fs.readFileSync(path.join(__dirname, '..', 'profiles.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const KEY = 'smartPantry.households.v1';

const initialProfiles = [
  { id: 'family', name: 'Family', servings: 4, lifestyle: 'omnivore', allergies: [], excludedIngredients: [] },
  { id: 'guests', name: 'Guests', servings: 2, lifestyle: 'vegan', allergies: ['Peanuts'], excludedIngredients: ['mushrooms'] }
];

function boot(storage = new Map(), failWrites = false) {
  function element() {
    return {
      value: '',
      hidden: false,
      textContent: '',
      dataset: {},
      children: [],
      listeners: {},
      checkedAllergies: [],
      appendChild(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      setAttribute() {},
      reset() {},
      focus() {},
      querySelectorAll(selector) {
        if (selector === 'input[name="allergies"]') {
          return ['Milk', 'Eggs', 'Peanuts', 'Tree nuts', 'Wheat', 'Soy', 'Fish', 'Shellfish', 'Sesame']
            .map((val) => ({ value: val, checked: false }));
        }
        if (selector === 'input[name="allergies"]:checked') {
          return this.checkedAllergies.map((val) => ({ value: val }));
        }
        return [];
      }
    };
  }

  const fields = new Map();
  const get = (id) => {
    if (!fields.has(id)) fields.set(id, element());
    return fields.get(id);
  };

  const context = vm.createContext({
    document: { getElementById: get, createElement: element },
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem(key, value) {
          if (failWrites) throw new Error('Storage blocked');
          storage.set(key, value);
        }
      },
      scrollTo() {},
      crypto: { randomUUID: () => 'new-profile-id' }
    },
    navigator: {}
  });

  vm.runInContext(profileSource, context, { filename: 'profiles.js' });
  vm.runInContext(appSource, context, { filename: 'app.js' });

  return {
    get,
    storage,
    clickListAction(action, householdId) {
      get('household-list').listeners.click({
        target: { closest: () => ({ dataset: { action, householdId } }) }
      });
    },
    submitForm({ name, servings, lifestyle = 'omnivore', allergies = [], excluded = '' }) {
      get('household-name').value = name;
      get('serving-count').value = String(servings);
      get('dietary-lifestyle').value = lifestyle;
      get('household-form').checkedAllergies = allergies;
      get('excluded-ingredients').value = excluded;
      get('household-form').listeners.submit({ preventDefault() {} });
    }
  };
}

function seeded(households = initialProfiles, activeHouseholdId = 'family') {
  return new Map([
    [KEY, JSON.stringify({ version: 1, households, activeHouseholdId })]
  ]);
}

test('US-03: cria um novo perfil familiar e guarda-o no armazenamento local', () => {
  const storage = seeded();
  const app = boot(storage);

  app.get('add-household').listeners.click();
  assert.equal(app.get('setup-screen').hidden, false);

  app.submitForm({
    name: 'Vegan Guest',
    servings: 2,
    lifestyle: 'vegan',
    allergies: ['Peanuts', 'Soy'],
    excluded: 'Honey, Mushrooms'
  });

  const saved = JSON.parse(storage.get(KEY));
  assert.equal(saved.households.length, 3);
  const created = saved.households.find((h) => h.name === 'Vegan Guest');
  assert.ok(created);
  assert.equal(created.servings, 2);
  assert.equal(created.lifestyle, 'vegan');
  assert.deepEqual(created.allergies, ['Peanuts', 'Soy']);
  assert.deepEqual(created.excludedIngredients, ['Honey', 'Mushrooms']);
  assert.equal(app.get('households-screen').hidden, false);
});

test('US-03: edita um perfil existente e atualiza as restrições alimentares', () => {
  const storage = seeded();
  const app = boot(storage);

  app.clickListAction('edit', 'family');
  assert.equal(app.get('setup-screen').hidden, false);

  app.submitForm({
    name: 'Family Updated',
    servings: 5,
    lifestyle: 'vegetarian',
    allergies: ['Milk'],
    excluded: 'Garlic'
  });

  const saved = JSON.parse(storage.get(KEY));
  const updated = saved.households.find((h) => h.id === 'family');
  assert.equal(updated.name, 'Family Updated');
  assert.equal(updated.servings, 5);
  assert.equal(updated.lifestyle, 'vegetarian');
  assert.deepEqual(updated.allergies, ['Milk']);
  assert.deepEqual(updated.excludedIngredients, ['Garlic']);
});

test('US-03: elimina um perfil inativo após confirmação', () => {
  const storage = seeded();
  const app = boot(storage);

  app.clickListAction('delete', 'guests');
  app.clickListAction('confirm-delete', 'guests');

  const saved = JSON.parse(storage.get(KEY));
  assert.equal(saved.households.length, 1);
  assert.equal(saved.households[0].id, 'family');
  assert.equal(saved.activeHouseholdId, 'family');
});

test('US-03: impede a eliminação do perfil ativo e oculta o botão de apagar no cartão ativo', () => {
  const storage = seeded();
  const app = boot(storage);

  // Verifica que o cartão ativo ('family') não renderiza o botão de eliminar
  const cards = app.get('household-list').children;
  const activeCard = cards.find((c) => c.dataset.householdId === 'family');
  const activeActions = activeCard.children.find((el) => el.className === 'household-actions');
  const hasDeleteButton = activeActions.children.some((btn) => btn.dataset.action === 'delete');
  assert.equal(hasDeleteButton, false);

  // Tenta forçar a ação 'delete' no perfil ativo
  app.clickListAction('delete', 'family');
  assert.equal(app.get('manager-error').hidden, false);
  assert.match(app.get('manager-error').textContent, /Cannot delete the active profile/);

  // Tenta forçar diretamente 'confirm-delete' no perfil ativo
  app.clickListAction('confirm-delete', 'family');
  const saved = JSON.parse(storage.get(KEY));
  assert.equal(saved.households.length, 2);
  assert.equal(saved.activeHouseholdId, 'family');
});