// Saved data may come from a JSON backup; render its values as text, never markup.
function escapePantryText(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
}

function renderPantry() {
    const pantryListContainer = document.getElementById('pantry-list');
    const inventory = JSON.parse(localStorage.getItem('smartPantry_inventory')) || [];

    if (inventory.length === 0) {
        pantryListContainer.innerHTML = '<p style="text-align: center;">A tua despensa está vazia.</p>';
        return;
    }

    let htmlContent = '';
    inventory.forEach(item => {
        const estado = obterEstadoValidade(item.expiry); 
        if (estado === 'expirado') {
            alertaHtml = `<p style="background-color: #ffebee; color: #c62828; padding: 5px 10px; border-radius: 4px; font-size: 0.9em; margin: 5px 0;"><strong>❌ Expirado!</strong></p>`;
        } else if (estado === 'quase') {
            alertaHtml = `<p style="background-color: #fff3cd; color: #856404; padding: 5px 10px; border-radius: 4px; font-size: 0.9em; margin: 5px 0;"><strong>⚠️ Expira em breve!</strong></p>`;
        }

        htmlContent += `
            <div class="form-card pantry-item" data-id="${escapePantryText(item.id)}" style="margin-bottom: 15px; padding: 15px; border-radius: 8px; border: 1px solid #ccc;">
                <h3 style="margin-top: 0; color: #17352b;">${escapePantryText(item.name)}</h3>
                <p style="margin: 5px 0;"><strong>Categoria:</strong> ${escapePantryText(item.category)}</p>
                <p style="margin: 5px 0;"><strong>Validade:</strong> ${item.expiry ?  new Date(item.expiry).toLocaleDateString('pt-PT') : 'N/A'}</p>
                
                <!-- MODO VISUALIZAÇÃO -->
                <div class="view-mode">
                    <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${escapePantryText(item.quantity)}</p>
                    <div style="margin-top: 15px;">
                        <button class="btn-edit" style="cursor: pointer;">Editar Qtd</button>
                        <button class="btn-delete" style="margin-left: 10px; cursor: pointer; color: red;">Remover</button>
                    </div>
                </div>
                
                <!-- MODO EDIÇÃO (Oculto por defeito) -->
                <div class="edit-mode" style="display: none; margin-top: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Nova Quantidade:</label>
                    <input type="number" name="edit-quantity" value="${escapePantryText(item.quantity)}" min="1" style="width: 60px; padding: 5px;">
                    <button class="btn-save-edit" style="margin-left: 10px; cursor: pointer;">Gravar</button>
                    <button class="btn-cancel-edit" style="margin-left: 5px; cursor: pointer; color: red">Cancelar</button>
                </div>
            </div>
        `;
    });

    pantryListContainer.innerHTML = htmlContent;
}

document.addEventListener('DOMContentLoaded', () => {
    renderPantry(); // Desenha a lista inicial

    const pantryListContainer = document.getElementById('pantry-list');
    
    // Delegação de eventos: deteta cliques em qualquer botão dentro da lista
    pantryListContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.pantry-item');
        if (!card) return;
        
        const id = card.getAttribute('data-id');
        let inventory = JSON.parse(localStorage.getItem('smartPantry_inventory')) || [];
        const itemIndex = inventory.findIndex(item => item.id === id);
        
        if (itemIndex === -1) return;

        // 1. Remover Item
        if (e.target.classList.contains('btn-delete')) {
            if (confirm(`Queres mesmo remover o item "${inventory[itemIndex].name}" da despensa?`)) {
                inventory.splice(itemIndex, 1);
                localStorage.setItem('smartPantry_inventory', JSON.stringify(inventory));
                renderPantry();
            }
        }
        
        // 2. Abrir Modo de Edição
        if (e.target.classList.contains('btn-edit')) {
            card.querySelector('.view-mode').style.display = 'none';
            card.querySelector('.edit-mode').style.display = 'block';
        }

        // 3. Cancelar Edição
        if (e.target.classList.contains('btn-cancel-edit')) {
            card.querySelector('.view-mode').style.display = 'block';
            card.querySelector('.edit-mode').style.display = 'none';
        }

        // 4. Gravar Nova Quantidade
        if (e.target.classList.contains('btn-save-edit')) {
            const newQty = parseInt(card.querySelector('input[name="edit-quantity"]').value, 10);
            
            if (newQty > 0) {
                inventory[itemIndex].quantity = newQty;
                localStorage.setItem('smartPantry_inventory', JSON.stringify(inventory));
                renderPantry(); // Redesenha a interface com os novos valores
            } else {
                alert('A quantidade tem de ser pelo menos 1.');
            }
        }
    });
});
