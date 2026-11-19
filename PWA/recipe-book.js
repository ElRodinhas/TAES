/* Shared recipe storage/rendering and the saved-recipes page. Existing data stays unchanged. */
(() => {
  'use strict';
  const STORAGE_KEY = 'smartPantry.generatedRecipes.v1';
  const $ = (id) => document.getElementById(id);
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function isRecipe(recipe) {
    return recipe && typeof recipe.title === 'string' && Number.isInteger(recipe.servings) && recipe.servings >= 1 && recipe.servings <= 30 &&
      ['prepMinutes', 'cookMinutes', 'totalMinutes'].every((key) => Number.isInteger(recipe[key]) && recipe[key] >= 0) && recipe.totalMinutes > 0 &&
      Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && recipe.ingredients.every((item) =>
        item && typeof item.name === 'string' && typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 && typeof item.unit === 'string' && (item.sourceIndex === null || Number.isInteger(item.sourceIndex))) &&
      Array.isArray(recipe.steps) && recipe.steps.length > 0 && recipe.steps.every((step) => typeof step === 'string' && step.trim());
  }
  function readSaved() {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored) || !stored.every(isRecipe)) throw new Error('STORAGE');
    return stored;
  }
  function recipeDetails(recipe, headingTag = 'h3') {
    const content = element('div');
    content.className = 'recipe-details';
    content.append(element('p', `${recipe.servings} porções · Preparação: ${recipe.prepMinutes} min · Cozedura: ${recipe.cookMinutes} min · Total: ${recipe.totalMinutes} min`));
    const ingredients = element('ul');
    recipe.ingredients.forEach((item) => ingredients.append(element('li', `${item.quantity.toLocaleString('pt-PT')} ${item.unit} de ${item.name}${item.sourceIndex === null ? ' — Em falta' : ''}`)));
    const steps = element('ol');
    recipe.steps.forEach((step) => steps.append(element('li', step)));
    content.append(element(headingTag, 'Ingredientes'), ingredients, element(headingTag, 'Preparação'), steps);
    content.append(element('p', 'Receita gerada por IA. Confirma os ingredientes e rótulos, sobretudo em caso de alergia.'));
    return content;
  }
  function updateSavedLink() {
    const link = $('saved-recipes-link');
    if (!link) return;
    try { link.textContent = `Receitas Guardadas (${readSaved().length})`; }
    catch { link.textContent = 'Receitas Guardadas'; }
  }
  function saveRecipe(recipe) {
    if (!isRecipe(recipe)) throw new Error('STORAGE');
    const saved = readSaved();
    if (!saved.some((item) => JSON.stringify(item) === JSON.stringify(recipe))) saved.push(recipe);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    updateSavedLink();
  }
  const normalize = (text) => text.trim().toLocaleLowerCase('pt-PT').normalize('NFD').replace(/\p{M}/gu, '');
  function renderSaved() {
    const list = $('saved-recipes');
    if (!list) return;
    list.replaceChildren();
    try {
      const saved = readSaved();
      const query = normalize($('saved-search').value);
      const matches = saved.filter((recipe) => normalize(recipe.title).includes(query));
      $('saved-status').textContent = query ? `${matches.length} de ${saved.length} receitas` : `${saved.length} ${saved.length === 1 ? 'receita guardada' : 'receitas guardadas'}`;
      if (!saved.length) {
        list.append(element('p', 'Ainda não guardaste receitas. Procura ou gera uma receita para começar.'));
      } else if (!matches.length) {
        list.append(element('p', 'Não foram encontradas receitas com esse título.'));
      } else {
        matches.forEach((recipe) => {
          const card = element('details');
          card.className = 'household-card saved-recipe';
          card.dataset.testid = 'saved-recipe';
          const summary = element('summary');
          summary.dataset.testid = 'saved-recipe-summary';
          summary.append(element('h2', recipe.title), element('p', `${recipe.servings} porções · ${recipe.totalMinutes} min`));
          const content = recipeDetails(recipe);
          content.dataset.testid = 'saved-recipe-details';
          card.append(summary, content);
          list.append(card);
        });
      }
    } catch {
      $('saved-status').textContent = 'Não foi possível ler as receitas guardadas neste dispositivo.';
    }
  }
  window.SmartPantryRecipeBook = { isRecipe, saveRecipe, recipeDetails };
  $('saved-search')?.addEventListener('input', renderSaved);
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) { updateSavedLink(); renderSaved(); }
  });
  updateSavedLink();
  renderSaved();
  if ($('saved-recipes') && 'serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
})();
