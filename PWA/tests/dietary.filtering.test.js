const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  construirUrlReceitas,
  receitaAdequadaAoPerfil,
  filtrarReceitasPorPerfil
} = require('../recipes.js');

const recipesSource = fs.readFileSync(path.join(__dirname, '..', 'recipes.js'), 'utf8');

const receitasExemplo = [
  {
    id: 1,
    title: 'Pasta Margherita',
    image: 'margherita.jpg',
    vegan: false,
    vegetarian: true,
    usedIngredients: [{ name: 'linguine pasta' }, { name: 'mozzarella cheese' }, { name: 'tomatoes' }],
    missedIngredients: [{ name: 'basil' }]
  },
  {
    id: 2,
    title: 'Penne Arrabiata',
    image: 'arrabiata.jpg',
    vegan: true,
    vegetarian: true,
    usedIngredients: [{ name: 'penne' }, { name: 'tomato' }],
    missedIngredients: [{ name: 'garlic' }, { name: 'parsley' }]
  },
  {
    id: 3,
    title: 'Simple Tomato Basil Salad',
    image: 'salad.jpg',
    vegan: true,
    vegetarian: true,
    usedIngredients: [{ name: 'tomato' }],
    missedIngredients: [{ name: 'basil' }, { name: 'olive oil' }]
  }
];

test('US-10: constrói o URL do complexSearch com dieta, intolerâncias e ingredientes excluídos', () => {
  const perfil = {
    lifestyle: 'vegan',
    allergies: ['Milk', 'Peanuts'],
    excludedIngredients: ['garlic', 'mushrooms']
  };

  const url = new URL(construirUrlReceitas('tomato,pasta', perfil));
  assert.equal(url.pathname, '/recipes/complexSearch');
  assert.equal(url.searchParams.get('includeIngredients'), 'tomato,pasta');
  assert.equal(url.searchParams.get('diet'), 'vegan');
  assert.equal(url.searchParams.get('intolerances'), 'dairy,peanut');
  assert.equal(url.searchParams.get('excludeIngredients'), 'garlic,mushrooms');
  assert.equal(url.searchParams.get('fillIngredients'), 'true');
  assert.equal(url.searchParams.get('addRecipeInformation'), 'true');
});

test('US-10: omite o parâmetro diet quando o perfil é omnivore', () => {
  const url = new URL(construirUrlReceitas('chicken,rice', {
    lifestyle: 'omnivore',
    allergies: [],
    excludedIngredients: []
  }));
  assert.equal(url.searchParams.has('diet'), false);
  assert.equal(url.searchParams.has('intolerances'), false);
  assert.equal(url.searchParams.has('excludeIngredients'), false);
});

test('US-10: oculta receitas que contêm um alergénio do perfil ativo', () => {
  const perfilAlergiaLeite = { lifestyle: 'omnivore', allergies: ['Milk'], excludedIngredients: [] };
  const filtradas = filtrarReceitasPorPerfil(receitasExemplo, perfilAlergiaLeite);

  assert.deepEqual(filtradas.map((r) => r.title), ['Penne Arrabiata', 'Simple Tomato Basil Salad']);
});

test('US-10: oculta receitas não-vegan quando o perfil ativo tem dieta vegan', () => {
  const perfilVegan = { lifestyle: 'vegan', allergies: [], excludedIngredients: [] };
  const receitaComMel = {
    id: 4,
    title: 'Glazed Carrots',
    usedIngredients: [{ name: 'carrots' }],
    missedIngredients: [{ name: 'honey' }]
  };

  const filtradas = filtrarReceitasPorPerfil([...receitasExemplo, receitaComMel], perfilVegan);
  assert.deepEqual(filtradas.map((r) => r.title), ['Penne Arrabiata', 'Simple Tomato Basil Salad']);
});

test('US-10: oculta receitas que contêm um ingrediente excluído pelo utilizador', () => {
  const perfilSemAlho = { lifestyle: 'omnivore', allergies: [], excludedIngredients: ['Garlic'] };
  const filtradas = filtrarReceitasPorPerfil(receitasExemplo, perfilSemAlho);

  assert.deepEqual(filtradas.map((r) => r.title), ['Pasta Margherita', 'Simple Tomato Basil Salad']);
});

test('US-10: procura e renderiza apenas receitas seguras no DOM a partir do perfil guardado', async () => {
  const storage = new Map([
    ['smartPantry_inventory', JSON.stringify([{ name: 'tomato', quantity: 2, expiry: '2026-12-31' }])],
    ['smartPantry.households.v1', JSON.stringify({
      version: 1,
      activeHouseholdId: 'p1',
      households: [{
        id: 'p1',
        name: 'Perfil Vegan Sem Alho',
        servings: 2,
        lifestyle: 'vegan',
        allergies: ['Milk'],
        excludedIngredients: ['garlic']
      }]
    })]
  ]);

  const lista = { innerHTML: '', children: [], appendChild(el) { this.children.push(el); } };
  const countEl = { textContent: '0' };
  const msgEl = { textContent: '', className: '', hidden: true };
  const loadingEl = { style: { display: 'none' } };
  const btnEl = { disabled: false, addEventListener() {} };

  const fields = {
    'recipes-list': lista,
    'recipe-count': countEl,
    'recipe-msg': msgEl,
    'loading-recipes': loadingEl,
    'btn-fetch-recipes': btnEl
  };

  let requestedUrl = '';
  const context = vm.createContext({
    URLSearchParams,
    console,
    estaQuaseAExpirar: () => false,
    document: {
      getElementById: (id) => fields[id] || null,
      createElement: () => ({ style: {}, className: '', innerHTML: '' }),
      addEventListener() {}
    },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v)
    },
    window: {},
    fetch: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({ results: receitasExemplo })
      };
    }
  });

  vm.runInContext(recipesSource, context, { filename: 'recipes.js' });
  await context.procurarReceitas();

  assert.match(requestedUrl, /diet=vegan/);
  assert.match(requestedUrl, /intolerances=dairy/);
  assert.match(requestedUrl, /excludeIngredients=garlic/);
  assert.equal(countEl.textContent, 1);
  assert.equal(lista.children.length, 1);
  assert.match(lista.children[0].innerHTML, /Simple Tomato Basil Salad/);
});