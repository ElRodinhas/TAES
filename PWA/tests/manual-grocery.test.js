const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// 1. Mock do localStorage para o Node.js
let store = {};
const localStorageMock = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key) => { delete store[key]; }
};
global.localStorage = localStorageMock;
global.alert = () => {}; // Ignora os alertas durante os testes

function addItem(name, quantity) {
    const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
    list.push({ name: name, quantity: quantity, unit: "un", checked: false });
    localStorage.setItem("smartPantry.shoppingList", JSON.stringify(list));
}

function removeItem(index) {
    const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
    list.splice(index, 1);
    localStorage.setItem("smartPantry.shoppingList", JSON.stringify(list));
}

function saveEdit(index, newName, newQty) {
    if (newName && newQty > 0) {
        const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
        list[index].name = newName;
        list[index].quantity = newQty;
        localStorage.setItem("smartPantry.shoppingList", JSON.stringify(list));
    } else {
        throw new Error('Nome ou quantidade inválidos.');
    }
}

function toggleItem(index, checked) {
    const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
    list[index].checked = checked;
    localStorage.setItem("smartPantry.shoppingList", JSON.stringify(list));
}

// 3. Os Testes
describe('US-22: Manual Grocery Management', () => {
    
    beforeEach(() => {
        localStorage.clear();
    });

    test('deve adicionar um novo item à lista', () => {
        addItem("Pão", 2);
        const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList"));
        
        assert.strictEqual(list.length, 1);
        assert.strictEqual(list[0].name, "Pão");
        assert.strictEqual(list[0].quantity, 2);
    });

    test('deve editar o nome e a quantidade de um item existente', () => {
        addItem("Pão", 2);
        saveEdit(0, "Pão de Forma", 1);
        
        const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList"));
        assert.strictEqual(list[0].name, "Pão de Forma");
        assert.strictEqual(list[0].quantity, 1);
    });

    test('deve remover um item da lista', () => {
        addItem("Pão", 2);
        addItem("Leite", 1);
        removeItem(0); // Remove o Pão
        
        const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList"));
        assert.strictEqual(list.length, 1);
        assert.strictEqual(list[0].name, "Leite");
    });

    test('deve marcar um item como comprado', () => {
        addItem("Pão", 2);
        toggleItem(0, true);
        
        const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList"));
        assert.strictEqual(list[0].checked, true);
    });
});