const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

let store = {};
const localStorageMock = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key) => { delete store[key]; }
};
global.localStorage = localStorageMock;
global.alert = () => {};

function addMissingIngredientsToShoppingList(missedIngredients) {
    const inventory = JSON.parse(localStorage.getItem("smartPantry.inventory")) || [];
    let shoppingList = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
    let addedCount = 0;

    missedIngredients.forEach(ingredient => {
        const ingredientName = ingredient.name;
        const isInStock = inventory.some(item =>
            item.name.toLowerCase().trim() === ingredientName.toLowerCase().trim()
        );

        if (!isInStock) {
            const alreadyInShoppingList = shoppingList.some(item =>
                item.name.toLowerCase().trim() === ingredientName.toLowerCase().trim()
            );

            if (!alreadyInShoppingList) {
                shoppingList.push({
                    name: ingredientName,
                    quantity: ingredient.amount || 1,
                    unit: ingredient.unit || "un",
                    checked: false
                });
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        localStorage.setItem("smartPantry.shoppingList", JSON.stringify(shoppingList));
    }
    return addedCount;
}

describe('US-11: Add Missing Ingredients to Shopping List', () => {
    
    beforeEach(() => {
        localStorage.clear();
    });

    test('deve adicionar ingredientes em falta à lista de compras', () => {
        localStorage.setItem("smartPantry.inventory", JSON.stringify([]));
        
        const missedIngredients = [
            { name: "black beans", amount: 1, unit: "can" },
            { name: "onion", amount: 2, unit: "un" }
        ];

        const added = addMissingIngredientsToShoppingList(missedIngredients);
        
        const shoppingList = JSON.parse(localStorage.getItem("smartPantry.shoppingList"));
        
        assert.strictEqual(added, 2);
        assert.strictEqual(shoppingList.length, 2);
        assert.strictEqual(shoppingList[0].name, "black beans");
    });

    test('NÃO deve adicionar ingredientes que já estão na despensa', () => {

        localStorage.setItem("smartPantry.inventory", JSON.stringify([{ name: "Tomato", quantity: 1 }]));
        
        const missedIngredients = [
            { name: "Tomato", amount: 1 },
            { name: "Onion", amount: 1 }
        ];

        const added = addMissingIngredientsToShoppingList(missedIngredients);
        
        const shoppingList = JSON.parse(localStorage.getItem("smartPantry.shoppingList"));
        
        assert.strictEqual(added, 1); 
        assert.strictEqual(shoppingList.length, 1);
        assert.strictEqual(shoppingList[0].name, "Onion");
    });

    test('NÃO deve duplicar ingredientes que já estão na lista de compras', () => {
        localStorage.setItem("smartPantry.inventory", JSON.stringify([]));
        localStorage.setItem("smartPantry.shoppingList", JSON.stringify([{ name: "Milk", quantity: 1 }]));
        
        const missedIngredients = [{ name: "Milk", amount: 1 }];

        const added = addMissingIngredientsToShoppingList(missedIngredients);
        
        const shoppingList = JSON.parse(localStorage.getItem("smartPantry.shoppingList"));
        
        assert.strictEqual(added, 0);
        assert.strictEqual(shoppingList.length, 1); 
    });
});