document.addEventListener('DOMContentLoaded', () => {
    renderShoppingList();
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