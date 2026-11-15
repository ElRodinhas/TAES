// Executar: node --test camera.fallback.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const scannerSource = fs.readFileSync(path.join(__dirname, '..', 'scanner.js'), 'utf8');

// Criar o ambiente simulado
function criarAmbiente() {
    const fields = {
        'camera-container': { style: { display: 'block' } },
        'fallback-container': { style: { display: 'none' } },
        'formContainer': { style: { display: 'none' }, scrollIntoView: () => { } },
        'scanner-msg': { textContent: '', hidden: true }
    };

    const context = {
        document: {
            getElementById: id => fields[id] || null,
            addEventListener() { }
        },
        window: { location: { href: '' } },
        navigator: {},
        console,
        setTimeout: () => 1,
        // Mock para o script não dar erro ao tentar carregar a biblioteca
        Html5Qrcode: function () { },
        Html5QrcodeSupportedFormats: {}
    };

    vm.createContext(context);
    vm.runInContext(scannerSource, context, { filename: 'scanner.js' });

    return { context, fields };
}

test('SCRUM-26: showFallback esconde a câmara e mostra a caixa de alternativas', () => {
    const { context, fields } = criarAmbiente();

    
    context.showFallback('Teste de câmara indisponível');

    // Verifica se a câmara foi escondida
    assert.equal(fields['camera-container'].style.display, 'none');

   
    assert.equal(fields['fallback-container'].style.display, 'block');

   
    assert.equal(fields['formContainer'].style.display, 'none');

    // Verifica se a mensagem de erro foi atualizada e mostrada
    assert.equal(fields['scanner-msg'].hidden, false);
    assert.equal(fields['scanner-msg'].textContent, 'Teste de câmara indisponível');
});

test('SCRUM-26: mostrarFormulario esconde o fallback e a câmara, e abre o formulário', () => {
    const { context, fields } = criarAmbiente();

    // Executa a função do scanner.js
    context.mostrarFormulario();

    // Verifica se a câmara e o fallback foram escondidos
    assert.equal(fields['camera-container'].style.display, 'none');
    assert.equal(fields['fallback-container'].style.display, 'none');

    // Verifica se o formulário de guardar produto foi mostrado
    assert.equal(fields['formContainer'].style.display, 'block');
});