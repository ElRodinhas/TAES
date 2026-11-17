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

