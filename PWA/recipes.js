// Configuração da API
const API_KEY = "5961276e67e64480bac8833f29cc17be";
const HOUSEHOLDS_STORAGE_KEY = "smartPantry.households.v1";

const ALLERGY_TO_INTOLERANCE = {
    Milk: "dairy",
    Eggs: "egg",
    Peanuts: "peanut",
    "Tree nuts": "tree nut",
    Wheat: "wheat",
    Soy: "soy",
    Fish: "seafood",
    Shellfish: "shellfish",
    Sesame: "sesame"
};

const ALLERGY_KEYWORDS = {
    Milk: ["milk", "cheese", "mozzarella", "provolone", "parmesan", "cheddar", "butter", "cream", "yogurt", "whey", "dairy"],
    Eggs: ["egg", "eggs", "mayonnaise"],
    Peanuts: ["peanut", "peanuts"],
    "Tree nuts": ["almond", "almonds", "walnut", "walnuts", "cashew", "cashews", "pecan", "pecans", "hazelnut", "hazelnuts", "pistachio", "pistachios", "macadamia"],
    Wheat: ["wheat", "flour", "bread", "pasta", "spaghetti", "penne", "linguine", "farfalle", "orecchiette", "noodle", "noodles"],
    Soy: ["soy", "soya", "tofu", "edamame", "miso", "tempeh"],
    Fish: ["fish", "salmon", "tuna", "cod", "anchovy", "anchovies", "sardine", "sardines", "trout"],
    Shellfish: ["shrimp", "prawns", "prawn", "crab", "lobster", "clam", "clams", "mussel", "mussels", "oyster", "oysters", "scallop", "scallops", "squid"],
    Sesame: ["sesame", "tahini"]
};

const MEAT_KEYWORDS = ["beef", "pork", "chicken", "turkey", "bacon", "ham", "lamb", "sausage", "meat", "veal", "duck", "prosciutto", "salami", "pepperoni"];
const SEAFOOD_KEYWORDS = [...ALLERGY_KEYWORDS.Fish, ...ALLERGY_KEYWORDS.Shellfish, "seafood"];
const NON_VEGAN_KEYWORDS = [...MEAT_KEYWORDS, ...SEAFOOD_KEYWORDS, ...ALLERGY_KEYWORDS.Milk, ...ALLERGY_KEYWORDS.Eggs, "honey"];

function obterPerfilAtivo() {
    try {
        if (typeof window !== "undefined" && window.SmartPantryProfiles?.readStoredState) {
            const state = window.SmartPantryProfiles.readStoredState();
            return state.households.find((h) => h.id === state.activeHouseholdId) || null;
        }
        const raw = localStorage.getItem(HOUSEHOLDS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.households)) return null;
        return parsed.households.find((h) => h.id === parsed.activeHouseholdId) || parsed.households[0] || null;
    } catch (error) {
        return null;
    }
}

function contemTermo(texto, termos) {
    return termos.some((termo) => {
        const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        return regex.test(texto);
    });
}

function receitaAdequadaAoPerfil(receita, perfil) {
    if (!perfil) return true;

    const nomesIngredientes = [
        receita.title || "",
        ...(receita.usedIngredients || []).map((i) => i.name || ""),
        ...(receita.missedIngredients || []).map((i) => i.name || "")
    ].join(" ").toLowerCase();

    // 1. Verificar estilo de vida / dieta
    if (perfil.lifestyle === "vegan") {
        if (receita.vegan === false || contemTermo(nomesIngredientes, NON_VEGAN_KEYWORDS)) {
            return false;
        }
    } else if (perfil.lifestyle === "vegetarian") {
        if (receita.vegetarian === false || contemTermo(nomesIngredientes, [...MEAT_KEYWORDS, ...SEAFOOD_KEYWORDS])) {
            return false;
        }
    } else if (perfil.lifestyle === "pescatarian") {
        if (contemTermo(nomesIngredientes, MEAT_KEYWORDS)) {
            return false;
        }
    }

    // 2. Verificar alergias
    const alergias = Array.isArray(perfil.allergies) ? perfil.allergies : [];
    for (const alergia of alergias) {
        const keywords = ALLERGY_KEYWORDS[alergia] || [alergia.toLowerCase()];
        if (contemTermo(nomesIngredientes, keywords)) {
            return false;
        }
    }

    // 3. Verificar ingredientes excluídos
    const excluidos = Array.isArray(perfil.excludedIngredients) ? perfil.excludedIngredients : [];
    for (const excluido of excluidos) {
        const limpo = excluido.trim().toLowerCase();
        if (limpo && nomesIngredientes.includes(limpo)) {
            return false;
        }
    }

    return true;
}

function filtrarReceitasPorPerfil(receitas, perfil) {
    return receitas.filter((receita) => receitaAdequadaAoPerfil(receita, perfil));
}

function construirUrlReceitas(nomesIngredientes, perfil) {
    const params = new URLSearchParams({
        includeIngredients: nomesIngredientes,
        fillIngredients: "true",
        addRecipeInformation: "true",
        number: "10",
        apiKey: API_KEY
    });

    if (perfil) {
        if (["vegetarian", "vegan", "pescatarian"].includes(perfil.lifestyle)) {
            params.set("diet", perfil.lifestyle);
        }
        if (Array.isArray(perfil.allergies) && perfil.allergies.length > 0) {
            const intolerances = perfil.allergies
                .map((a) => ALLERGY_TO_INTOLERANCE[a])
                .filter(Boolean);
            if (intolerances.length > 0) {
                params.set("intolerances", intolerances.join(","));
            }
        }
        if (Array.isArray(perfil.excludedIngredients) && perfil.excludedIngredients.length > 0) {
            params.set("excludeIngredients", perfil.excludedIngredients.join(","));
        }
    }

    return `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`;
}

function analisarReceita(ingredientesDespensa, receita) {
    const used = receita.usedIngredients || [];
    const missed = receita.missedIngredients || [];
    const totalIngredientes = used.length + missed.length;

    const percentagem = totalIngredientes > 0
        ? Math.round((used.length / totalIngredientes) * 100)
        : 0;

    return {
        percentagem: percentagem,
        tens: used.map(i => i.name),
        falta: missed.map(i => i.name)
    };
}

async function procurarReceitas() {
    const btn = document.getElementById('btn-fetch-recipes');
    const msg = document.getElementById('recipe-msg');
    const loading = document.getElementById('loading-recipes');
    const lista = document.getElementById('recipes-list');
    const countEl = document.getElementById('recipe-count');

    // Buscar o inventário ao localStorage
    const inventario = JSON.parse(localStorage.getItem('smartPantry_inventory')) || [];

    if (inventario.length === 0) {
        msg.textContent = "A tua despensa está vazia! Adiciona produtos primeiro.";
        msg.className = "form-error";
        msg.hidden = false;
        return;
    }

    const perfilAtivo = obterPerfilAtivo();
    const nomesIngredientes = inventario.map(item => item.name).join(',');

    // Estado de loading
    btn.disabled = true;
    msg.hidden = true;
    lista.innerHTML = '';
    loading.style.display = 'block';

    try {
        const url = construirUrlReceitas(nomesIngredientes, perfilAtivo);
        const response = await fetch(url);

        if (!response.ok) throw new Error('Falha ao contactar a API.');

        const data = await response.json();
        const receitasBrutas = Array.isArray(data) ? data : (data.results || []);
        const receitas = filtrarReceitasPorPerfil(receitasBrutas, perfilAtivo).slice(0, 5);

        // Processar e Renderizar
        loading.style.display = 'none';
        countEl.textContent = receitas.length;

        if (receitas.length === 0) {
            msg.textContent = "Não foram encontradas receitas adequadas ao teu perfil e ingredientes.";
            msg.hidden = false;
            btn.disabled = false;
            return;
        }

        receitas.sort((a, b) => {
            const usaExpirados = (r) => (r.usedIngredients || []).some(ing => {
                const itemDespensa = inventario.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
                return itemDespensa && estaQuaseAExpirar(itemDespensa.expiry);
            });

            const aTemExpirados = usaExpirados(a);
            const bTemExpirados = usaExpirados(b);

            if (aTemExpirados && !bTemExpirados) return -1;
            if (!aTemExpirados && bTemExpirados) return 1;
            return 0;
        });

        // Desenhar os cartões no HTML
        receitas.forEach(receita => {
            const analise = analisarReceita(inventario, receita);

            const usaExpirados = (receita.usedIngredients || []).some(ing => {
                const itemDespensa = inventario.find(i => i.name.toLowerCase() === ing.name.toLowerCase());
                return itemDespensa && estaQuaseAExpirar(itemDespensa.expiry);
            });

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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analisarReceita,
        obterPerfilAtivo,
        receitaAdequadaAoPerfil,
        filtrarReceitasPorPerfil,
        construirUrlReceitas
    };
}