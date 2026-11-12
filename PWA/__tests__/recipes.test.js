const { analisarReceita } = require('../recipes.js');

describe('Lógica de Receitas (US-09)', () => {

    test('Deve calcular 100% se tivermos todos os ingredientes', () => {
        const receitaFalsa = {
            usedIngredients: [{ name: "Tomate" }, { name: "Cebola" }],
            missedIngredients: []
        };
        const resultado = analisarReceita([], receitaFalsa);
        expect(resultado.percentagem).toBe(100);
        expect(resultado.falta.length).toBe(0);
    });

    test('Deve calcular 50% se tivermos metade dos ingredientes', () => {
        const receitaFalsa = {
            usedIngredients: [{ name: "Tomate" }],
            missedIngredients: [{ name: "Alho" }]
        };
        const resultado = analisarReceita([], receitaFalsa);
        expect(resultado.percentagem).toBe(50);
        expect(resultado.tens).toEqual(["Tomate"]);
        expect(resultado.falta).toEqual(["Alho"]);
    });

    test('Deve calcular 0% se não tivermos nenhum ingrediente', () => {
        const receitaFalsa = {
            usedIngredients: [],
            missedIngredients: [{ name: "Alho" }, { name: "Azeite" }]
        };
        const resultado = analisarReceita([], receitaFalsa);
        expect(resultado.percentagem).toBe(0);
    });
    
    test('Deve lidar com uma receita vazia sem dar erro de divisão por zero', () => {
        const receitaVazia = {
            usedIngredients: [],
            missedIngredients: []
        };
        const resultado = analisarReceita([], receitaVazia);
        expect(resultado.percentagem).toBe(0); // E não NaN
    });
});