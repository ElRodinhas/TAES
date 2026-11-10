// Executar: node --test scanner.validation.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const scannerSource = fs.readFileSync(path.join(__dirname, '..', 'scanner.js'), 'utf8');

function criarAmbiente(barcode = '') {
    const storage = new Map();
    let redirecionamentos = 0;
    const fields = {
        'form-msg': { textContent: '', className: '', hidden: true },
        'scanner-msg': { textContent: '', hidden: true },
        barcodeVal: { value: barcode, focused: false, focus() { this.focused = true; } },
        productName: { value: 'Leite' },
        productCategory: { value: 'Laticínios' },
        productQty: { value: '2' },
        productExpiry: { value: '2026-12-01' },
        manualBarcode: { value: barcode },
        productForm: { reset() {} }
    };
    const localStorage = {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, value)
    };
    const context = {
        document: { getElementById: id => fields[id] || null, addEventListener() {} },
        window: { location: { set href(value) { redirecionamentos++; } } },
        localStorage,
        navigator: {},
        console,
        setTimeout: () => 1
    };
    vm.createContext(context);
    vm.runInContext(scannerSource, context, { filename: 'scanner.js' });
    return {
        context,
        fields,
        storage,
        get redirects() { return redirecionamentos; },
        save() { context.window.saveProduct({ preventDefault() {} }); }
    };
}

test('aceita códigos EAN-8, EAN-13, UPC-A e UPC-E com dígito de controlo válido', () => {
    const { context } = criarAmbiente();
    for (const code of ['96385074', '4006381333931', '036000291452', '00000019']) {
        assert.equal(context.codigoBarrasValido(code), true, code);
    }
});

test('rejeita dígitos de controlo errados, letras e comprimentos não suportados', () => {
    const { context } = criarAmbiente();
    for (const code of ['96385075', '4006381333932', '036000291453', 'ABC123', '1234567', '12 345678', '']) {
        assert.equal(context.codigoBarrasValido(code), false, code);
    }
});

test('não grava nem altera o inventário quando o código é inválido', () => {
    const app = criarAmbiente('4006381333932');
    app.storage.set('smartPantry_inventory', JSON.stringify([{ name: 'Leite', quantity: 1 }]));
    const antes = app.storage.get('smartPantry_inventory');
    app.save();
    assert.equal(app.storage.get('smartPantry_inventory'), antes);
    assert.equal(app.fields['form-msg'].className, 'error');
    assert.match(app.fields['form-msg'].textContent, /inválido/i);
    assert.equal(app.fields.barcodeVal.focused, true);
});

test('grava um produto com código válido sem perder zeros iniciais', () => {
    const app = criarAmbiente('036000291452');
    app.save();
    const inventory = JSON.parse(app.storage.get('smartPantry_inventory'));
    assert.equal(inventory.length, 1);
    assert.equal(inventory[0].barcode, '036000291452');
    assert.equal(app.fields['form-msg'].className, 'success');
});

test('mantém entrada manual de produtos sem código de barras', () => {
    const app = criarAmbiente('');
    app.save();
    const inventory = JSON.parse(app.storage.get('smartPantry_inventory'));
    assert.equal(inventory[0].barcode, null);
    assert.equal(inventory[0].name, 'Leite');
});

test('rejeita o mesmo código de barras para outro produto', () => {
    const app = criarAmbiente('4006381333931');
    app.storage.set('smartPantry_inventory', JSON.stringify([
        { name: 'Arroz', barcode: '4006381333931', quantity: 1 }
    ]));
    const antes = app.storage.get('smartPantry_inventory');

    app.save();

    assert.equal(app.storage.get('smartPantry_inventory'), antes);
    assert.equal(app.fields['form-msg'].className, 'error');
    assert.equal(app.fields['form-msg'].hidden, false);
    assert.match(app.fields['form-msg'].textContent, /outro produto/i);
    assert.equal(app.fields.barcodeVal.focused, true);
});

test('permite aumentar a quantidade do mesmo produto com o mesmo código', () => {
    const app = criarAmbiente('4006381333931');
    app.storage.set('smartPantry_inventory', JSON.stringify([
        { name: 'leite', barcode: '4006381333931', quantity: 1 }
    ]));

    app.save();

    const inventory = JSON.parse(app.storage.get('smartPantry_inventory'));
    assert.equal(inventory.length, 1);
    assert.equal(inventory[0].quantity, 3);
    assert.equal(app.fields['form-msg'].className, 'success');
});

test('permite produtos diferentes com códigos diferentes', () => {
    const app = criarAmbiente('4006381333931');
    app.storage.set('smartPantry_inventory', JSON.stringify([
        { name: 'Arroz', barcode: '96385074', quantity: 1 }
    ]));

    app.save();

    const inventory = JSON.parse(app.storage.get('smartPantry_inventory'));
    assert.equal(inventory.length, 2);
    assert.equal(inventory[1].name, 'Leite');
    assert.equal(inventory[1].barcode, '4006381333931');
});

test('remove espaços do código sem perder zeros iniciais', () => {
    const app = criarAmbiente(' 036000291452 ');

    app.save();

    const inventory = JSON.parse(app.storage.get('smartPantry_inventory'));
    assert.equal(inventory[0].barcode, '036000291452');
});