const SHOPPING_LIST_KEY = "smartPantry.shoppingList";
const INVENTORY_KEY = "smartPantry_inventory";

const PANTRY_CATEGORIES = [
    "Laticínios",
    "Mercearia",
    "Frutas e Legumes",
    "Carne e Peixe",
    "Congelados",
    "Bebidas",
    "Padaria",
    "Outros"
];

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function mostrarMensagemLista(texto, tipo = "form-error") {
    const msg = document.getElementById("shopping-list-msg");
    if (!msg) return;
    msg.textContent = texto;
    msg.className = tipo;
    msg.hidden = false;
}

function esconderMensagemLista() {
    const msg = document.getElementById("shopping-list-msg");
    if (!msg) return;
    msg.textContent = "";
    msg.hidden = true;
}

function obterItensMarcados(lista) {
    return lista
        .map((item, index) => ({ ...item, originalIndex: index }))
        .filter((item) => Boolean(item.checked));
}

function renderShoppingList() {
    const container = document.getElementById("shopping-list-container");
    if (!container) return;

    const list = JSON.parse(localStorage.getItem(SHOPPING_LIST_KEY)) || [];

    if (list.length === 0) {
        container.innerHTML = "<li>A tua lista de compras está vazia.</li>";
        return;
    }

    container.innerHTML = "";

    list.forEach((item, index) => {
        const li = document.createElement("li");
        li.style.padding = "10px";
        li.style.borderBottom = "1px solid #ccc";

        const textStyle = item.checked
            ? "text-decoration: line-through; color: #888;"
            : "text-decoration: none; color: inherit;";

        li.innerHTML = `
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${item.checked ? "checked" : ""} onchange="toggleItem(${index}, this)">
                <span style="${textStyle}">
                    <strong>${escapeHtml(item.quantity)} ${escapeHtml(item.unit || "un")}</strong> - ${escapeHtml(item.name)}
                </span>
            </label>
            <div>
                    <button class="btn-edit" onclick="openEditMode(${index})" style="margin-right: 5px; cursor: pointer;">Editar</button>
                    <button class="btn-delete" onclick="removeItem(${index})" style="color: red; cursor: pointer;">Remover</button>
                </div>
            </div>
            
            <!-- Modo de Edição (Oculto por defeito) -->
            <div id="edit-mode-${index}" style="display: none; width: 100%; margin-top: 10px;">
                <input type="text" id="edit-item-name-${index}" value="${item.name}" style="padding: 5px; margin-right: 5px;">
                <input type="number" id="edit-item-qty-${index}" value="${item.quantity}" min="1" style="width: 60px; padding: 5px; margin-right: 5px;">
                <button id="btn-save-edit-${index}" onclick="saveEdit(${index})" style="cursor: pointer;">Gravar</button>
                <button onclick="closeEditMode(${index})" style="cursor: pointer;">Cancelar</button>
            </div>
        `;
        container.appendChild(li);
    });
}

function abrirTransferenciaEmLote() {
    esconderMensagemLista();
    const list = JSON.parse(localStorage.getItem(SHOPPING_LIST_KEY)) || [];
    const marcados = obterItensMarcados(list);

    if (marcados.length === 0) {
        mostrarMensagemLista("Seleciona pelo menos um item marcado na lista de compras para transferir.");
        return;
    }

    const section = document.getElementById("batch-transfer-section");
    const itemsContainer = document.getElementById("batch-transfer-items");

    itemsContainer.innerHTML = marcados.map((item, idx) => {
        const optionsHtml = PANTRY_CATEGORIES.map((cat) =>
            `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
        ).join("");

        return `
            <div class="batch-transfer-row" data-original-index="${item.originalIndex}" data-name="${escapeHtml(item.name)}" style="padding: 12px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 8px;">
                <p style="margin: 0 0 8px 0;"><strong>${escapeHtml(item.name)}</strong></p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
                    <label>
                        Quantidade:
                        <input id="batch-qty-${idx}" type="number" min="1" value="${escapeHtml(item.quantity || 1)}" style="width: 70px; padding: 4px;">
                    </label>
                    <label>
                        Categoria:
                        <select id="batch-category-${idx}" style="padding: 4px;">
                            ${optionsHtml}
                        </select>
                    </label>
                    <label>
                        Validade:
                        <input id="batch-expiry-${idx}" type="date" style="padding: 4px;">
                    </label>
                </div>
            </div>
        `;
    }).join("");

    section.hidden = false;
}

function fecharTransferenciaEmLote() {
    const section = document.getElementById("batch-transfer-section");
    const itemsContainer = document.getElementById("batch-transfer-items");
    if (itemsContainer) itemsContainer.innerHTML = "";
    if (section) section.hidden = true;
}

function aplicarTransferenciaEmLote(shoppingList, inventory, itensConfigurados) {
    const novoInventario = inventory.map((item) => ({ ...item }));
    const indicesTransferidos = new Set();

    for (const cfg of itensConfigurados) {
        const quantidade = Number(cfg.quantity);
        if (!Number.isInteger(quantidade) || quantidade < 1) {
            throw new Error(`Quantidade inválida para "${cfg.name}".`);
        }

        const categoria = (cfg.category || "Outros").trim() || "Outros";
        const validade = (cfg.expiry || "").trim();

        const existente = novoInventario.find(
            (inv) =>
                inv.name.toLowerCase() === cfg.name.toLowerCase() &&
                (inv.category || "") === categoria &&
                (inv.expiry || "") === validade
        );

        if (existente) {
            existente.quantity = Number(existente.quantity || 0) + quantidade;
        } else {
            novoInventario.push({
                id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: cfg.name,
                category: categoria,
                quantity: quantidade,
                expiry: validade
            });
        }

        if (typeof cfg.originalIndex === "number") {
            indicesTransferidos.add(cfg.originalIndex);
        }
    }

    const novaListaCompras = shoppingList.filter((_, idx) => !indicesTransferidos.has(idx));

    return {
        shoppingList: novaListaCompras,
        inventory: novoInventario
    };
}

function confirmarTransferenciaEmLote() {
    esconderMensagemLista();
    const rows = Array.from(document.querySelectorAll(".batch-transfer-row"));
    if (rows.length === 0) return;

    const itensConfigurados = rows.map((row, idx) => ({
        originalIndex: Number(row.getAttribute("data-original-index")),
        name: row.getAttribute("data-name"),
        quantity: parseInt(document.getElementById(`batch-qty-${idx}`).value, 10),
        category: document.getElementById(`batch-category-${idx}`).value,
        expiry: document.getElementById(`batch-expiry-${idx}`).value
    }));
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

        const dataHojeFormatada = hoje.toLocaleDateString('pt-PT');



    for (const item of itensConfigurados) {
        if (!item.expiry) {
            mostrarMensagemLista(`Por favor, preenche a data de validade para o produto: ${item.name}`, "form-error");
            return;
        }


        const dataValidade = new Date(item.expiry + 'T00:00:00'); 
        if (dataValidade < hoje) {
            mostrarMensagemLista(`A data de validade do produto "${item.name}" não pode ter data de validade inferior a ${dataHojeFormatada}`, "form-error");
            return;
        }
    }
    try {
        const currentList = JSON.parse(localStorage.getItem(SHOPPING_LIST_KEY)) || [];
        const currentInventory = JSON.parse(localStorage.getItem(INVENTORY_KEY)) || [];

        const resultado = aplicarTransferenciaEmLote(currentList, currentInventory, itensConfigurados);

        localStorage.setItem(INVENTORY_KEY, JSON.stringify(resultado.inventory));
        localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(resultado.shoppingList));

        fecharTransferenciaEmLote();
        renderShoppingList();
        mostrarMensagemLista("Itens transferidos para a despensa com sucesso!", "success");
    } catch (error) {
        mostrarMensagemLista(error.message || "Erro ao transferir itens para a despensa.");
    }
}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        renderShoppingList();

        const btnAdd = document.getElementById('btn-add-item');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const nameInput = document.getElementById('input-item-name');
                const qtyInput = document.getElementById('input-item-qty');
                const name = nameInput.value.trim();
                const qty = parseInt(qtyInput.value, 10);

                if (name && qty > 0) {
                    addItem(name, qty);
                    nameInput.value = '';
                    qtyInput.value = '1';
                } else {
                    alert('Por favor, insira um nome e uma quantidade válida.');
                }
            });
        }

        const btnOpen = document.getElementById("btn-open-batch-transfer");
        if (btnOpen) btnOpen.addEventListener("click", abrirTransferenciaEmLote);

        const btnConfirm = document.getElementById("btn-confirm-batch-transfer");
        if (btnConfirm) btnConfirm.addEventListener("click", confirmarTransferenciaEmLote);

        const btnCancel = document.getElementById("btn-cancel-batch-transfer");
        if (btnCancel) btnCancel.addEventListener("click", fecharTransferenciaEmLote);
    });
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        obterItensMarcados,
        aplicarTransferenciaEmLote,
        abrirTransferenciaEmLote,
        confirmarTransferenciaEmLote
    };
}


function addItem(name, quantity) {
    const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
    list.push({ name: name, quantity: quantity, unit: "un", checked: false });
    localStorage.setItem("smartPantry.shoppingList", JSON.stringify(list));
    renderShoppingList();
}

function removeItem(index) {
    const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
    list.splice(index, 1);
    localStorage.setItem("smartPantry.shoppingList", JSON.stringify(list));
    renderShoppingList();
}

function openEditMode(index) {
    document.getElementById(`edit-mode-${index}`).style.display = 'block';
}

function closeEditMode(index) {
    document.getElementById(`edit-mode-${index}`).style.display = 'none';
}

function saveEdit(index) {
    const newName = document.getElementById(`edit-item-name-${index}`).value.trim();
    const newQty = parseInt(document.getElementById(`edit-item-qty-${index}`).value, 10);

    if (newName && newQty > 0) {
        const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
        list[index].name = newName;
        list[index].quantity = newQty;
        localStorage.setItem("smartPantry.shoppingList", JSON.stringify(list));
        renderShoppingList();
    } else {
        alert('Nome ou quantidade inválidos.');
    }
}

function toggleItem(index, checkboxElement) {
    let list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
    list[index].checked = checkboxElement.checked;
    localStorage.setItem("smartPantry.shoppingList", JSON.stringify(list));

    const textSpan = checkboxElement.nextElementSibling;
    if (list[index].checked) {
        textSpan.style.textDecoration = "line-through";
        textSpan.style.color = "#888";
    } else {
        textSpan.style.textDecoration = "none";
        textSpan.style.color = "inherit";
    }
}