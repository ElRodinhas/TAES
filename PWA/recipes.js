//Coonfiguração da API
const API_KEY = "5961276e67e64480bac8833f29cc17be";

function analisarReceita(ingredientesDespensa, receita) {
    const totalIngredientes = receita.usedIngredients.length + receita.missedIngredients.length;

    const percentagem = totalIngredientes > 0
        ? Math.round((receita.usedIngredients.length / totalIngredientes) * 100)
        : 0;

    return {
        percentagem: percentagem,
        tens: receita.usedIngredients.map(i => i.name),
        falta: receita.missedIngredients.map(i => i.name)
    };
}

async function procurarReceitas() {
    const btn = document.getElementById('btn-fetch-recipes');
    const msg = document.getElementById('recipe-msg');
    const loading = document.getElementById('loading-recipes');
    const lista = document.getElementById('recipes-list');
    const countEl = document.getElementById('recipe-count');

    // buscar o inventário ao localStorage
    const inventario = JSON.parse(localStorage.getItem('smartPantry_inventory')) || [];

    if (inventario.length === 0) {
        msg.textContent = "A tua despensa está vazia! Adiciona produtos primeiro.";
        msg.className = "form-error";
        msg.hidden = false;
        return;
    }

    // Preparar os ingredientes para a API (nomes separados por vírgula)
    const nomesIngredientes = inventario.map(item => item.name).join(',');

    // Estado de loading
    btn.disabled = true;
    msg.hidden = true;
    lista.innerHTML = '';
    loading.style.display = 'block';

    try {
        // 2. Fazer o pedido à API
        const url = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(nomesIngredientes)}&number=5&ranking=1&apiKey=${API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error('Falha ao contactar a API.');

        const receitas = await response.json();

        // 3. Processar e Renderizar
        loading.style.display = 'none';
        countEl.textContent = receitas.length;

        if (receitas.length === 0) {
            msg.textContent = "Não foram encontradas receitas com os teus ingredientes.";
            msg.hidden = false;
            btn.disabled = false;
            return;
        }

        receitas.sort((a, b) => {
            const usaExpirados = (r) => r.usedIngredients.some(ing => {
                const itemDespensa = inventario.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
                return itemDespensa && estaQuaseAExpirar(itemDespensa.expiry);
            });

            const aTemExpirados = usaExpirados(a);
            const bTemExpirados = usaExpirados(b);

            // Se 'a' tem expirados e 'b' não, 'a' vai para cima (-1)
            if (aTemExpirados && !bTemExpirados) return -1;
            // Se 'b' tem expirados e 'a' não, 'b' vai para cima (1)
            if (!aTemExpirados && bTemExpirados) return 1;
            
            // Se ambos têm (ou ambos não têm), mantém a ordem
            return 0;
        });

        // Desenhar os cartões no HTML
        receitas.forEach(receita => {
            const analise = analisarReceita(inventario, receita);

            const usaExpirados = receita.usedIngredients.some(ing => {
                const itemDespensa = inventario.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
                return itemDespensa && estaQuaseAExpirar(itemDespensa.expiry);
            });

            // Criar o cartão
            const card = document.createElement('article');
            card.className = 'household-card';
            card.style.display = 'flex';
            card.style.gap = '15px';
            card.style.alignItems = 'flex-start';

            card.innerHTML = `
                <img src="${receita.image}" alt="${receita.title}" style="width: 120px; height: 120px; border-radius: 8px; object-fit: cover;">
                <div style="flex: 1;">
                    <h3 style="margin-top: 0; margin-bottom: 5px;">${receita.title}</h3>

                    ${usaExpirados ? `
                    <p style="margin: 0 0 10px 0; font-size: 0.85em; background-color: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; display: inline-block;">
                        ⚠️ Usa produto a expirar!
                    </p>` : ''}
                    
                    <div style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.85em; font-weight: bold; color: #17352b; margin-bottom: 4px;">
                            <span id="overlap-value">Tens ${analise.percentagem}% dos ingredientes</span>
                        </div>
                        <div style="width: 100%; background-color: #e0e0e0; border-radius: 10px; height: 10px; overflow: hidden;">
                            <div style="width: ${analise.percentagem}%; background-color: ${analise.percentagem > 50 ? '#2e7d32' : '#e65100'}; height: 100%; border-radius: 10px; transition: width 0.5s ease-in-out;"></div>
                        </div>
                    </div>

                    <div style="font-size: 0.9em;">
                        <p style="margin: 2px 0; color: #2e7d32;">
                            <strong>✅ Tens:</strong> ${analise.tens.join(', ')}
                        </p>
                        <p style="margin: 2px 0; color: #c62828;">
                            <strong>❌ Falta:</strong> ${analise.falta.join(', ') || 'Nada!'}
                        </p>
                    </div>
                </div>
            `;
            lista.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        loading.style.display = 'none';
        msg.textContent = "Ocorreu um erro ao procurar as receitas. Tenta novamente.";
        msg.className = "form-error";
        msg.hidden = false;
    } finally {
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btnFetch = document.getElementById('btn-fetch-recipes');
    if (btnFetch) {
        btnFetch.addEventListener('click', procurarReceitas);
    }
});