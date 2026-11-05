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
    mostrarMensagem(`${motivo} Pode carregar uma foto do código ou preencher os dados manualmente.`);
    mostrarFormulario(); // entrada manual sempre disponível
}

function mostrarFormulario() {
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

document.addEventListener('click', (event) => {
    const alvo = event.target;
    if (!alvo) return;

    if (alvo.id === 'cancel-scanner') {
        fecharScanner();
    }

    if (alvo.id === 'restart-scanner-btn') {
        reiniciarScanner();
    }
});

// ---------- Câmara ----------

async function iniciarScanner() {
    aProcessar = false;
    esconderFormulario();
    limparMensagem();

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

         const cameras = await Html5Qrcode.getCameras();
        
        if (!cameras || cameras.length === 0) {
            throw new Error('Nenhuma câmara encontrada.');
        }
        const cameraId = cameras[cameras.length - 1].id;

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

// ---------- Fallback: upload de imagem ----------

document.addEventListener('change', async (event) => {
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

// ---------- Guardar produto ----------

window.saveProduct = function (event) {
    event.preventDefault();
    const product = {
        barcode: $id('barcodeVal').value,
        name: $id('productName').value,
        category: $id('productCategory').value,
        quantity: $id('productQty').value,
        expiry: $id('productExpiry').value
    };

    console.log('Produto guardado localmente:', product);
    
    // Mostra a mensagem de sucesso na própria página (sem bloquear o browser)
    mostrarMensagem(`Sucesso! "${product.name}" guardado na despensa.`);

    const productForm = $id('productForm');
    if (productForm) productForm.reset();
    const manual = $id('manualBarcode');
    if (manual) manual.value = '';

    // Espera 2 segundos para o utilizador ver a mensagem e depois redireciona
    setTimeout(() => {
        fecharScanner();
    }, 2000);
};

document.addEventListener('DOMContentLoaded', () => {
    // Se a secção do scanner existir nesta página, liga a câmara automaticamente
    if ($id('scanner-screen')) {
        iniciarScanner();
    }
});
