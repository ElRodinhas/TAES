document.addEventListener('DOMContentLoaded', () => {
    renderShoppingList();

    document.getElementById('btn-add-item').addEventListener('click', () => {
        const nameInput = document.getElementById('input-item-name');
        const qtyInput = document.getElementById('input-item-qty');
        
        const name = nameInput.value.trim();
        const qty = parseInt(qtyInput.value, 10);

        if (name && qty > 0) {
            addItem(name, qty);
            nameInput.value = ''; // Limpa o campo
            qtyInput.value = '1'; // Reseta a quantidade
        } else {
            alert('Por favor, insira um nome e uma quantidade válida.');
        }
    });
});

function renderShoppingList() {
    const container = document.getElementById('shopping-list-container');
    const list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];

    if (list.length === 0) {
        container.innerHTML = "<li>A tua lista de compras está vazia.</li>";
        return;
    }

    container.innerHTML = '';

    list.forEach((item, index) => {
        const li = document.createElement('li');
        li.style.padding = "10px";
        li.style.borderBottom = "1px solid #ccc";
        
        // O estilo do texto muda consoante o estado 'checked'
        const textStyle = item.checked 
            ? 'text-decoration: line-through; color: #888;' 
            : 'text-decoration: none; color: inherit;';

        li.innerHTML = `
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleItem(${index}, this)">
                <span style="${textStyle}">
                    <strong>${item.quantity} ${item.unit}</strong> - ${item.name}
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

function toggleItem(index, checkboxElement) {
    let list = JSON.parse(localStorage.getItem("smartPantry.shoppingList")) || [];
    
    // Atualiza o estado no array (true ou false)
    list[index].checked = checkboxElement.checked; 
    
    // Guarda no localStorage
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