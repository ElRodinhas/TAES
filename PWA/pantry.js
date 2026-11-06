document.addEventListener('DOMContentLoaded', () => {
    const pantryListContainer = document.getElementById('pantry-list');
    
    // Ler os dados da cache do browser
    const inventoryJson = localStorage.getItem('smartPantry_inventory');
    const inventory = inventoryJson ? JSON.parse(inventoryJson) : [];

    // Validar se a despensa está vazia
    if (inventory.length === 0) {
        pantryListContainer.innerHTML = '<p style="text-align: center;">A tua despensa está vazia.</p>';
        return;
    }

    // Gerar o HTML para cada produto
    let htmlContent = '';
    inventory.forEach(item => {
        htmlContent += `
            <div class="form-card" style="margin-bottom: 10px; padding: 15px; border-radius: 8px; border: 1px solid #ccc;">
                <h3 style="margin-top: 0; color: #17352b;">${item.name}</h3>
                <p style="margin: 5px 0;"><strong>Categoria:</strong> ${item.category}</p>
                <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${item.quantity}</p>
                <p style="margin: 5px 0;"><strong>Validade:</strong> ${item.expiry ? item.expiry : 'N/A'}</p>
            </div>
        `;
    });

    pantryListContainer.innerHTML = htmlContent;
});