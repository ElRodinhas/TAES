function calcularDiasParaExpirar(dataValidade) {
    if (!dataValidade) return null;
    
    // Expiry is a local calendar date, not a UTC timestamp. Compare calendar
    // days so timezone offsets and 23/25-hour daylight-saving days do not shift it.
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataValidade);
    if (!partes) return null;
    const [, ano, mes, dia] = partes.map(Number);
    const validade = new Date(Date.UTC(ano, mes - 1, dia));
    if (validade.getUTCFullYear() !== ano || validade.getUTCMonth() !== mes - 1 ||
        validade.getUTCDate() !== dia) return null;

    const hoje = new Date();
    const inicioHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return (validade.getTime() - inicioHoje) / (1000 * 60 * 60 * 24);
}

function obterEstadoValidade(dataValidade, limiteDias = 3) {
    const dias = calcularDiasParaExpirar(dataValidade);
    if (dias === null) return null;
    if (dias < 0) return 'expirado';
    if (dias <= limiteDias) return 'quase';
    return null;
}

function estaQuaseAExpirar(dataValidade) {
    const dias = calcularDiasParaExpirar(dataValidade);
    return dias !== null && dias >= 0 && dias <= 3;
}
