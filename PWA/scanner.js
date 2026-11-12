/* SmartPantry - Scanner de código de barras (spike)
 * Biblioteca: html5-qrcode (Html5Qrcode)
 * Fallbacks: upload de imagem + entrada manual
 */
let html5QrCode = null;
let aProcessar = false; // evita processar o mesmo código várias vezes

const $id = (id) => document.getElementById(id);

// ---------- Utilitários ----------

function bibliotecaDisponivel() {
    return typeof Html5Qrcode !== 'undefined';
}

function criarLeitor() {
    if (!bibliotecaDisponivel()) return null;
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode('reader', {
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E
            ],
            verbose: false
        });
    }
    return html5QrCode;
}

function mostrarMensagem(texto) {
    const el = $id('scanner-msg');
    if (!el) return;
    el.textContent = texto;
    el.hidden = false;
}

function limparMensagem() {
    const el = $id('scanner-msg');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
}

function showFallback(motivo) {
    mostrarMensagem(`${motivo}`);
    if ($id('camera-container')) $id('camera-container').style.display = 'none';
    if ($id('fallback-container')) $id('fallback-container').style.display = 'block';
    esconderFormulario();
}

function mostrarFormulario() {
    if ($id('camera-container')) $id('camera-container').style.display = 'none';
    if ($id('fallback-container')) $id('fallback-container').style.display = 'none';

    const formContainer = $id('formContainer');
    if (formContainer) {
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function esconderFormulario() {
    const formContainer = $id('formContainer');
    if (formContainer) formContainer.style.display = 'none';
}

async function pararCamara() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
        } catch (err) {
            console.error('Erro ao parar a câmara:', err);
        }
    }
}

async function fecharScanner() {
    await pararCamara();
    limparMensagem();
    esconderFormulario();
    window.location.href = './index.html';
}

// ---------- Abrir / cancelar scanner ----------

document.addEventListener('click', async (event) => {
    const alvo = event.target;
    if (!alvo) return;

    if (alvo.id === 'cancel-scanner') {
        fecharScanner();
    }

    if (alvo.id === 'restart-scanner-btn') {
        reiniciarScanner();
    }

    if (alvo.id === 'btn-force-fallback') {
        await pararCamara();
        showFallback('Optou por usar as alternativas à câmara.');
    }
});

// ---------- Câmara ----------

async function iniciarScanner() {
    aProcessar = false;
    esconderFormulario();
    limparMensagem();

    if ($id('camera-container')) $id('camera-container').style.display = 'block';
    if ($id('fallback-container')) $id('fallback-container').style.display = 'none';

    if (!bibliotecaDisponivel()) {
        showFallback('A biblioteca de leitura não foi carregada (sem ligação?).');
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showFallback('Este browser não suporta acesso à câmara (ou a página não está em HTTPS).');
        return;
    }

    const leitor = criarLeitor();
    await pararCamara();

    try {
        const allCameras = await Html5Qrcode.getCameras();
        if (!allCameras || allCameras.length === 0) throw new Error('Nenhuma câmara encontrada.');

        // FILTRO: Remover a câmara frontal!
        const rearCameras = allCameras.filter(cam => {
            const label = (cam.label || '').toLowerCase();
            // Se tiver estas palavras, é a frontal. Vamos ignorá-la.
            if (label.includes('front') || label.includes('user') || label.includes('facetime')) {
                return false;
            }
            return true;
        });

        const camerasToUse = rearCameras.length > 0 ? rearCameras : allCameras;

        const cameraSelect = $id('camera-select');
        const selectionContainer = $id('camera-selection-container');

        // Preencher o seletor apenas com as câmaras traseiras
        if (cameraSelect && selectionContainer) {
            if (cameraSelect.options.length === 0) {
                camerasToUse.forEach((cam, index) => {
                    const opt = document.createElement('option');
                    opt.value = cam.id;
                    opt.text = cam.label || `Câmara Traseira ${index + 1}`;
                    cameraSelect.appendChild(opt);
                });
            }
            // Mostra o seletor só se houver mais do que uma câmara traseira (para escolher a 1x)
            if (camerasToUse.length > 1) {
                selectionContainer.style.display = 'block';
            } else {
                selectionContainer.style.display = 'none';
            }
        }

        const savedCamId = localStorage.getItem('preferredCameraId');
        let cameraId = savedCamId || (cameraSelect ? cameraSelect.value : cameras[0].id);

        if (savedCamId && !camerasToUse.some(c => c.id === savedCamId)) {
            cameraId = camerasToUse[0].id;
        }

        if (cameraSelect && savedCamId && camerasToUse.some(c => c.id === savedCamId)) {
            cameraSelect.value = savedCamId;
        }

        await leitor.start(
            cameraId,
            { fps: 10, qrbox: { width: 250, height: 150 } },
            onScanSuccess,
            onScanFailure
        );
    } catch (err) {
        console.error('Erro ao iniciar a câmara:', err);
        const nome = (err && (err.name || err)) + '';
        if (nome.includes('NotAllowed') || nome.includes('Permission')) {
            showFallback('Permissão da câmara negada.');
        } else if (nome.includes('NotFound')) {
            showFallback('Nenhuma câmara encontrada.');
        } else {
            showFallback('Câmara indisponível.');
        }
    }
}

async function reiniciarScanner() {
    esconderFormulario();
    const restartBtn = $id('restart-scanner-container');
    if (restartBtn) restartBtn.style.display = 'none';

    limparMensagem();
    const form = $id('productForm');
    if (form) form.reset();

    //Liga a câmara novamente
    await iniciarScanner();
}

function onScanFailure() {
    // Ignorado: dispara a cada frame sem código visível.
}

// ---------- Resultado da leitura / consulta à API ----------

async function onScanSuccess(decodedText) {
    if (aProcessar) return;
    aProcessar = true;

    console.log(`Código detetado: ${decodedText}`);
    await pararCamara();

    const restartBtn = $id('restart-scanner-container');
    if (restartBtn) restartBtn.style.display = 'block';

    mostrarFormulario();
    limparMensagem();
    $id('barcodeVal').value = decodedText;
    $id('productName').value = 'A procurar produto...';
    $id('productCategory').value = '';

    try {
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(decodedText)}` +
            '?fields=product_name,categories_tags';
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            $id('productName').value = data.product.product_name || '';
            const categoria = data.product.categories_tags && data.product.categories_tags[0];
            $id('productCategory').value = categoria ? categoria.replace(/^[a-z]{2}:/, '') : 'Geral';
            if (!data.product.product_name) {
                mostrarMensagem('Produto encontrado sem nome. Preencha manualmente.');
            }
        } else {
            $id('productName').value = '';
            mostrarMensagem('Produto não encontrado na base de dados pública. Preencha os dados manualmente.');
        }
    } catch (error) {
        console.error('Erro ao consultar a API:', error);
        $id('productName').value = '';
        mostrarMensagem('Erro de ligação à base de dados. Preencha os dados manualmente.');
    }
}

// ---------- Verifica a data de validade ----------

function verifyExpiryDate() {
    const dateInput = $id('productExpiry');
    if (dateInput) {
        const hoje = new Date();

        // Mínimo: data atual
        const dataMinima = hoje.toISOString().split('T')[0];

        // Máximo: data atual + 30 anos
        hoje.setFullYear(hoje.getFullYear() + 30);
        const dataMaxima = hoje.toISOString().split('T')[0];

        dateInput.setAttribute('min', dataMinima);
        dateInput.setAttribute('max', dataMaxima);
    }
}

// ---------- Fallback: upload de imagem ----------

document.addEventListener('change', async (event) => {
    if (event.target.id === 'camera-select') {
        const selectedCamId = event.target.value;
        localStorage.setItem('preferredCameraId', selectedCamId); // Guarda a escolha
        await pararCamara();
        await iniciarScanner(); // Reinicia logo com a nova câmara
        return; // Para não continuar para a lógica de upload
    }
    
    const input = event.target;
    if (!input || input.id !== 'barcodeFile' || !input.files || !input.files[0]) return;

    const ficheiro = input.files[0];
    input.value = ''; // permite voltar a escolher o mesmo ficheiro

    if (!bibliotecaDisponivel()) {
        showFallback('A biblioteca de leitura não foi carregada.');
        mostrarFormulario();
        return;
    }

    await pararCamara();
    limparMensagem();

    try {
        const leitor = criarLeitor();
        const codigo = await leitor.scanFile(ficheiro, false);
        aProcessar = false;
        onScanSuccess(codigo);
    } catch (err) {
        console.error('Erro ao ler a imagem:', err);
        showFallback('Não foi possível ler o código na imagem.');
        mostrarFormulario(); // entrada manual
    }
});

// ---------- Fallback: entrada manual ----------

window.manualLookup = async function () {
    const codigo = $id('manualBarcode').value.trim();
    if (!codigo) {
        mostrarMensagem('Introduza um número de código de barras.');
        return;
    }
    await pararCamara();
    aProcessar = false;
    onScanSuccess(codigo);
};

// ---------- Barcode Validation ----------

// GTIN-8 (EAN-8), GTIN-12 (UPC-A) e GTIN-13 (EAN-13)
// usam um dígito de controlo calculado com pesos alternados 3 e 1.
function digitoControloValido(codigo) {
    if (!/^\d+$/.test(codigo)) return false;

    let soma = 0;
    let peso = 3;
    for (let i = codigo.length - 2; i >= 0; i--) {
        soma += Number(codigo[i]) * peso;
        peso = peso === 3 ? 1 : 3;
    }

    const esperado = (10 - (soma % 10)) % 10;
    return esperado === Number(codigo[codigo.length - 1]);
}

// Um UPC-E de 8 dígitos contém o sistema numérico, 6 dígitos
// comprimidos e o dígito de controlo. Expandimos para UPC-A antes
// de verificar o dígito de controlo.
function upcEValido(codigo) {
    if (!/^[01]\d{7}$/.test(codigo)) return false;

    const sistema = codigo[0];
    const dados = codigo.slice(1, 7);
    const ultimo = dados[5];
    let corpo;

    if ('012'.includes(ultimo)) {
        corpo = sistema + dados.slice(0, 2) + ultimo + '0000' + dados.slice(2, 5);
    } else if (ultimo === '3') {
        corpo = sistema + dados.slice(0, 3) + '00000' + dados.slice(3, 5);
    } else if (ultimo === '4') {
        corpo = sistema + dados.slice(0, 4) + '00000' + dados[4];
    } else {
        corpo = sistema + dados.slice(0, 5) + '0000' + ultimo;
    }

    return digitoControloValido(corpo + codigo[7]);
}

function codigoBarrasValido(codigo) {
    if (!/^\d+$/.test(codigo)) return false;

    if (codigo.length === 8) {
        // O leitor pode devolver EAN-8 ou UPC-E com 8 dígitos.
        return digitoControloValido(codigo) || upcEValido(codigo);
    }

    if (codigo.length === 12 || codigo.length === 13) {
        return digitoControloValido(codigo);
    }

    return false;
}

// ---------- Guardar produto ----------

window.saveProduct = function (event) {
    event.preventDefault();
    const formMsg = $id('form-msg');

    //Rejeitar item sem nome
    const nameVal = $id('productName').value.trim();
    if (!nameVal) {
        formMsg.textContent = 'Erro: O nome do produto é obrigatório.';
        formMsg.className = 'error';
        formMsg.hidden = false;

        limparMensagem();
        return;
    }

    // Reject invalid barcode
    const barcode = $id('barcodeVal').value.trim();
    if (barcode && !codigoBarrasValido(barcode)) {
        formMsg.textContent = 'Erro: Código de barras inválido. Verifique o número e o dígito de controlo (EAN-8, EAN-13, UPC-A ou UPC-E).';
        formMsg.className = 'error';
        formMsg.hidden = false;
        $id('barcodeVal').focus();
        return;
    }

    // Criar o objeto do produto
    const product = {
        id: Date.now().toString(), // Identificador único
        barcode: barcode || null,
        name: nameVal,
        category: $id('productCategory').value || 'Geral',
        quantity: $id('productQty') ? $id('productQty').value : 1,
        expiry: $id('productExpiry') ? $id('productExpiry').value : null
    };

    // 1. Ir buscar o inventário atual à cache do browser (ou iniciar array vazio)
    let pantryInventory = JSON.parse(localStorage.getItem('smartPantry_inventory')) || [];

    if (barcode && pantryInventory.some(item =>
        String(item.barcode ?? '').trim() === barcode &&
        item.name.trim().toLowerCase() !== nameVal.toLowerCase()
    )) {
        formMsg.textContent =
            'Erro: Este código de barras já está associado a outro produto.';
        formMsg.className = 'error';
        formMsg.hidden = false;
        $id('barcodeVal').focus();
        return;
    }

    // 2. Verificar se o produto já existe pelo nome (case-insensitive)
    const existingProductIndex = pantryInventory.findIndex(
        item => item.name.toLowerCase() === product.name.toLowerCase()
    );

    if (existingProductIndex !== -1) {
        pantryInventory[existingProductIndex].quantity =
            Number(pantryInventory[existingProductIndex].quantity) + Number(product.quantity);
        if (product.expiry) {
            pantryInventory[existingProductIndex].expiry = product.expiry;
        }
    } else {
        // Se não existe, adiciona como novo
        pantryInventory.push(product);
    }

    // 3. Guardar no localStorage
    localStorage.setItem('smartPantry_inventory', JSON.stringify(pantryInventory));

    formMsg.textContent = `Sucesso! "${product.name}" guardado na despensa.`;
    formMsg.className = 'success';
    formMsg.hidden = false;

    limparMensagem();

    const productForm = $id('productForm');
    if (productForm) productForm.reset();
    const manual = $id('manualBarcode');
    if (manual) manual.value = '';

    // Espera 2 segundos para o utilizador ver a mensagem e depois redireciona
    setTimeout(() => {
        window.location.href = './pantry.html';
    }, 2000);
};

document.addEventListener('DOMContentLoaded', () => {

    verifyExpiryDate();

    // Se a secção do scanner existir nesta página, liga a câmara automaticamente
    if ($id('scanner-screen')) {
        iniciarScanner();
    }
});

