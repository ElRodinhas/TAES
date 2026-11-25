const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  obterItensMarcados,
  aplicarTransferenciaEmLote
} = require('../shopping-list.js');

const shoppingListSource = fs.readFileSync(path.join(__dirname, '..', 'shopping-list.js'), 'utf8');

test('US-24: filtra apenas os itens marcados da lista de compras preservando o índice original', () => {
  const lista = [
    { name: 'Leite', quantity: 2, unit: 'L', checked: true },
    { name: 'Maçãs', quantity: 4, unit: 'un', checked: false },
    { name: 'Arroz', quantity: 1, unit: 'kg', checked: true }
  ];

  const marcados = obterItensMarcados(lista);
  assert.equal(marcados.length, 2);
  assert.deepEqual(marcados.map((i) => ({ name: i.name, originalIndex: i.originalIndex })), [
    { name: 'Leite', originalIndex: 0 },
    { name: 'Arroz', originalIndex: 2 }
  ]);
});

test('US-24: transfere itens selecionados para a despensa com quantidade, categoria e validade personalizadas e remove-os da lista', () => {
  const shoppingList = [
    { name: 'Leite', quantity: 1, unit: 'L', checked: true },
    { name: 'Pão', quantity: 2, unit: 'un', checked: false },
    { name: 'Arroz', quantity: 1, unit: 'kg', checked: true }
  ];

  const { shoppingList: novaLista, inventory: novoInventario } = aplicarTransferenciaEmLote(
    shoppingList,
    [],
    [
      { originalIndex: 0, name: 'Leite', quantity: 3, category: 'Laticínios', expiry: '2026-12-15' },
      { originalIndex: 2, name: 'Arroz', quantity: 2, category: 'Mercearia', expiry: '2027-06-01' }
    ]
  );

  assert.equal(novoInventario.length, 2);
  assert.equal(novoInventario[0].name, 'Leite');
  assert.equal(novoInventario[0].quantity, 3);
  assert.equal(novoInventario[0].category, 'Laticínios');
  assert.equal(novoInventario[0].expiry, '2026-12-15');
  assert.ok(novoInventario[0].id);

  assert.equal(novoInventario[1].name, 'Arroz');
  assert.equal(novoInventario[1].quantity, 2);
  assert.equal(novoInventario[1].category, 'Mercearia');
  assert.equal(novoInventario[1].expiry, '2027-06-01');

  assert.equal(novaLista.length, 1);
  assert.equal(novaLista[0].name, 'Pão');
});

test('US-24: soma a quantidade se já existir um produto idêntico com a mesma categoria e validade na despensa', () => {
  const shoppingList = [{ name: 'Leite', quantity: 1, unit: 'L', checked: true }];
  const inventarioAtual = [
    { id: 'inv-1', name: 'leite', category: 'Laticínios', quantity: 2, expiry: '2026-12-15' }
  ];

  const { shoppingList: novaLista, inventory: novoInventario } = aplicarTransferenciaEmLote(
    shoppingList,
    inventarioAtual,
    [{ originalIndex: 0, name: 'Leite', quantity: 4, category: 'Laticínios', expiry: '2026-12-15' }]
  );

  assert.equal(novoInventario.length, 1);
  assert.equal(novoInventario[0].id, 'inv-1');
  assert.equal(novoInventario[0].quantity, 6);
  assert.equal(novaLista.length, 0);
});

test('US-24: rejeita quantidades inválidas durante a transferência em lote', () => {
  assert.throws(
    () => aplicarTransferenciaEmLote(
      [{ name: 'Leite', quantity: 1, checked: true }],
      [],
      [{ originalIndex: 0, name: 'Leite', quantity: 0, category: 'Laticínios', expiry: '' }]
    ),
    /Quantidade inválida/
  );
});

test('US-24: mostra alerta e não abre o painel quando não existem itens marcados no DOM', () => {
  const storage = new Map([
    ['smartPantry.shoppingList', JSON.stringify([{ name: 'Pão', quantity: 1, unit: 'un', checked: false }])]
  ]);

  const msgEl = { textContent: '', className: '', hidden: true };
  const sectionEl = { hidden: true };

  const fields = {
    'shopping-list-msg': msgEl,
    'batch-transfer-section': sectionEl
  };

  const context = vm.createContext({
    document: {
      getElementById: (id) => fields[id] || null,
      querySelectorAll: () => [],
      addEventListener() {}
    },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v)
    }
  });

  vm.runInContext(shoppingListSource, context, { filename: 'shopping-list.js' });
  context.abrirTransferenciaEmLote();

  assert.equal(sectionEl.hidden, true);
  assert.equal(msgEl.hidden, false);
  assert.match(msgEl.textContent, /Seleciona pelo menos um item/);
});