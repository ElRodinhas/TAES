/* US-15: local-first recipe generation through server.js; credentials stay outside PWA/. */
(() => {
  'use strict';
  const { isRecipe, saveRecipe, recipeDetails } = window.SmartPantryRecipeBook;
  const $ = (id) => document.getElementById(id);
  const leftovers = [];
  let busy = false;
  let consentRequest = null;
  let profileId = null;
  const errors = {
    INPUT: 'Escolhe pelo menos um ingrediente e indica entre 1 e 30 porções.',
    PROFILE: 'Cria ou seleciona um perfil válido antes de gerar uma receita.',
    OFFLINE: 'Sem ligação à Internet. As receitas guardadas continuam disponíveis.',
    TIMEOUT: 'O pedido demorou demasiado. Tenta novamente.',
    QUOTA: 'O limite de pedidos do Gemini foi atingido. Tenta mais tarde.',
    BLOCKED: 'O Gemini não conseguiu devolver uma receita para este pedido. Experimenta outros ingredientes.',
    INVALID_RECIPE: 'A receita recebida está incompleta ou é inválida. Tenta novamente.',
    RESTRICTION: 'Foi detetado um conflito com as restrições do perfil. Revê os ingredientes.',
    NOT_CONFIGURED: 'O serviço de receitas ainda não está configurado. Verifica a chave e o modelo Gemini no servidor local.',
    UNAVAILABLE: 'Não foi possível contactar o serviço de receitas. Verifica a ligação e o servidor local e tenta novamente.',
    STORAGE: 'Não foi possível guardar a receita neste dispositivo. Liberta espaço e tenta novamente.'
  };

  function message(text) { $('generation-message').textContent = text; }
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function profile() {
    const state = window.SmartPantryProfiles.readStoredState();
    return state.households.find((entry) => entry.id === state.activeHouseholdId);
  }
  function clearConsent() {
    consentRequest = null;
    $('missing-consent').hidden = true;
  }
  function syncProfile() {
    const active = profile();
    profileId = active?.id ?? null;
    $('generation-servings').value = active?.servings ?? '';
    const lifestyles = { omnivore: 'Omnívoro', vegetarian: 'Vegetariano', vegan: 'Vegano', pescatarian: 'Pescetariano' };
    $('generation-profile').textContent = active
      ? `${active.name} · ${lifestyles[active.lifestyle]} · Alergias: ${active.allergies.join(', ') || 'nenhuma'} · Excluir: ${active.excludedIngredients.join(', ') || 'nada'}`
      : 'Cria um perfil na página inicial para definir as restrições alimentares.';
    clearConsent();
    $('generated-recipe').replaceChildren();
  }
  function renderPantry() {
    const holder = $('generation-pantry');
    holder.replaceChildren();
    let pantry;
    try { pantry = JSON.parse(localStorage.getItem('smartPantry_inventory')) || []; } catch { pantry = []; }
    if (!Array.isArray(pantry)) pantry = [];
    pantry.filter((item) => item && typeof item.name === 'string' && item.name.trim()).forEach((item, index) => {
      const label = element('label');
      label.style.display = 'block';
      const checkbox = element('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.testid = `generation-pantry-${index}`;
      checkbox.dataset.name = item.name;
      // Pantry quantities are not converted: their stored units may differ.
      checkbox.dataset.available = [item.quantity, item.unit].filter((x) => x !== undefined && x !== null).join(' ');
      label.append(checkbox, document.createTextNode(` ${item.name} (${checkbox.dataset.available || 'quantidade não indicada'})`));
      holder.append(label);
    });
    if (!holder.children.length) holder.append(element('p', 'A despensa está vazia. Podes adicionar sobras abaixo.'));
  }
  function renderLeftovers() {
    $('leftover-list').replaceChildren(...leftovers.map((item, index) => {
      const row = element('li', `${item.name}${item.available ? ` — ${item.available}` : ''} `);
      const remove = element('button', 'Remover');
      remove.type = 'button';
      remove.className = 'button button-secondary';
      remove.setAttribute('aria-label', `Remover ${item.name}`);
      remove.disabled = busy;
      remove.addEventListener('click', () => { leftovers.splice(index, 1); clearConsent(); renderLeftovers(); });
      row.append(remove);
      return row;
    }));
  }
  function addLeftover() {
    const name = $('leftover-name').value.trim();
    if (!name) return false;
    if (leftovers.length >= 40) { message('Podes adicionar até 40 ingredientes.'); return false; }
    leftovers.push({ name, available: $('leftover-amount').value.trim() });
    $('leftover-name').value = '';
    $('leftover-amount').value = '';
    clearConsent();
    renderLeftovers();
    return true;
  }
  function buildRequest() {
    const active = profile();
    if (!active) throw new Error('PROFILE');
    if (active.id !== profileId) { syncProfile(); throw new Error('PROFILE'); }
    const ingredients = [...$('generation-pantry').querySelectorAll('input:checked')].map((item) => ({
      name: item.dataset.name, available: item.dataset.available
    })).concat(leftovers.map((item) => ({ ...item })));
    const servings = Number($('generation-servings').value);
    if (!ingredients.length || ingredients.length > 40 || !Number.isInteger(servings) || servings < 1 || servings > 30) throw new Error('INPUT');
    return { ingredients, servings, lifestyle: active.lifestyle, allergies: [...active.allergies], excludedIngredients: [...active.excludedIngredients], allowMissing: false };
  }
  function recipeCard(recipe) {
    const card = element('article');
    card.className = 'household-card';
    card.append(element('h3', recipe.title), recipeDetails(recipe, 'h4'));
    const save = element('button', 'Guardar receita');
    save.type = 'button';
    save.className = 'button button-secondary';
    save.dataset.testid = 'save-generated-recipe';
    save.addEventListener('click', () => {
      try {
        saveRecipe(recipe);
        message('Receita guardada. Abre Receitas Guardadas para a consultar.');
      } catch { message(errors.STORAGE); }
    });
    card.append(save);
    return card;
  }
  async function generate(request) {
    if (busy) return;
    if (!navigator.onLine) { message(errors.OFFLINE); return; }
    busy = true;
    const requestProfileId = profileId;
    clearConsent();
    $('generated-recipe').replaceChildren();
    // Lock input while a request is running, so consent and results refer to the displayed selection.
    const controls = [...$('generate-form').querySelectorAll('input, button'), $('allow-missing'), $('active-profile')];
    controls.forEach((control) => { control.disabled = true; });
    $('generate-form').setAttribute('aria-busy', 'true');
    message('A gerar a receita…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch('./api/generate-recipe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal
      });
      let result;
      try { result = await response.json(); } catch { throw new Error('UNAVAILABLE'); }
      if (!response.ok) throw new Error(result.error || 'UNAVAILABLE');
      const current = profile();
      if (!current || current.id !== requestProfileId || current.lifestyle !== request.lifestyle || JSON.stringify(current.allergies) !== JSON.stringify(request.allergies) || JSON.stringify(current.excludedIngredients) !== JSON.stringify(request.excludedIngredients)) {
        syncProfile();
        throw new Error('PROFILE');
      }
      if (result.status === 'no_recipe' && result.recipe === null) {
        if (!request.allowMissing) {
          consentRequest = request;
          $('missing-consent').hidden = false;
          message('Não foi encontrada uma proposta só com os ingredientes indicados.');
        } else message('Não foi possível propor uma receita adequada. Experimenta outros ingredientes.');
      } else if (result.status === 'ready' && isRecipe(result.recipe) && result.recipe.servings === request.servings) {
        $('generated-recipe').replaceChildren(recipeCard(result.recipe));
        message('Receita gerada. As quantidades indicam o necessário para as porções pedidas.');
      } else throw new Error('INVALID_RECIPE');
    } catch (error) {
      message(errors[error.name === 'AbortError' ? 'TIMEOUT' : error.message] || errors.UNAVAILABLE);
    } finally {
      clearTimeout(timeout);
      busy = false;
      controls.forEach((control) => { control.disabled = false; });
      $('generate-form').setAttribute('aria-busy', 'false');
    }
  }

  $('add-leftover').addEventListener('click', addLeftover);
  $('generate-form').addEventListener('input', clearConsent);
  $('generate-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    try { if ($('leftover-name').value.trim()) addLeftover(); generate(buildRequest()); }
    catch (error) { message(errors[error.message] || errors.INPUT); }
  });
  $('allow-missing').addEventListener('click', () => {
    if (consentRequest) generate({ ...consentRequest, allowMissing: true });
  });
  $('cancel-missing').addEventListener('click', () => { clearConsent(); message('Podes alterar os ingredientes e tentar novamente.'); });
  $('active-profile').addEventListener('change', syncProfile);
  window.addEventListener('storage', (event) => {
    if (event.key === 'smartPantry.households.v1' || event.key === null) {
      window.SmartPantryProfiles.renderSwitcher();
      syncProfile();
      $('generated-recipe').replaceChildren();
    }
    if (event.key === 'smartPantry_inventory' || event.key === null) { renderPantry(); clearConsent(); }
  });
  renderPantry();
  syncProfile();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
})();
