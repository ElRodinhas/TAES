function calcularDiasParaExpirar(dataValidade) {
    if (!dataValidade) return null;
    
    const validade = new Date(dataValidade);
    if (isNaN(validade.getTime())) return null;
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    return Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
}

function obterEstadoValidade(dataValidade) {
    const dias = calcularDiasParaExpirar(dataValidade);
    if (dias === null) return null;
    if (dias < 0) return 'expirado';
    if (dias <= 3) return 'quase';
    return null;
}

function estaQuaseAExpirar(dataValidade) {
    const dias = calcularDiasParaExpirar(dataValidade);
    return dias !== null && dias >= 0 && dias <= 3;
}