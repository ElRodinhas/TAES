// Executar: node --test tests/recipes.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Lê o ficheiro recipes.js
const recipesSource = fs.readFileSync(path.join(__dirname, '..', 'recipes.js'), 'utf8');

// Cria um ambiente falso para o código do browser não rebentar
function criarAmbiente() {
    const context = {
        document: { 
            addEventListener: () => {}, 
            getElementById: () => ({ style: {}, innerHTML: '' }) 
        },
        window: { location: { href: '' } },
        localStorage: { getItem: () => null, setItem: () => {} },
        console,
        setTimeout: () => 1
    };

    vm.createContext(context);
    vm.runInContext(recipesSource, context, { filename: 'recipes.js' });
    return context;
}

// Puxamos a função analisarReceita do ambiente simulado
const context = criarAmbiente();
const analisarReceita = context.analisarReceita;

test('US-09: Deve calcular 100% se tivermos todos os ingredientes', () => {
    const receitaFalsa = {
        usedIngredients: [{ name: "Tomate" }, { name: "Cebola" }],
        missedIngredients: []
    };
    const resultado = analisarReceita([], receitaFalsa);
    
    assert.equal(resultado.percentagem, 100);
    assert.equal(resultado.falta.length, 0);
});

test('US-09: Deve calcular 50% se tivermos metade dos ingredientes', () => {
    const receitaFalsa = {
        usedIngredients: [{ name: "Tomate" }],
        missedIngredients: [{ name: "Alho" }]
    };
    const resultado = analisarReceita([], receitaFalsa);
    
    assert.equal(resultado.percentagem, 50);
    assert.deepEqual(resultado.tens, ["Tomate"]);
    assert.deepEqual(resultado.falta, ["Alho"]);
});

test('US-09: Deve calcular 0% se não tivermos nenhum ingrediente', () => {
    const receitaFalsa = {
        usedIngredients: [],
        missedIngredients: [{ name: "Alho" }, { name: "Azeite" }]
    };
    const resultado = analisarReceita([], receitaFalsa);
    
    assert.equal(resultado.percentagem, 0);
});

test('US-09: Deve lidar com uma receita vazia sem dar erro de divisão por zero', () => {
    const receitaVazia = {
        usedIngredients: [],
        missedIngredients: []
    };
    const resultado = analisarReceita([], receitaVazia);
    
    assert.equal(resultado.percentagem, 0); // E não NaN
});