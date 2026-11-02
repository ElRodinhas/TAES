/* No backend or external libraries: household data stays in this browser's localStorage. */
(() => {
  'use strict';

  const STORAGE_KEY = 'smartPantry.households.v1';
  const SERVING_MIN = 1;
  const SERVING_MAX = 30;
  const LIFESTYLES = Object.freeze({
    omnivore: 'No specific diet',
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    pescatarian: 'Pescatarian'
  });
  const ALLERGY_OPTIONS = ['Milk', 'Eggs', 'Peanuts', 'Tree nuts', 'Wheat', 'Soy', 'Fish', 'Shellfish', 'Sesame'];
  const $ = (id) => document.getElementById(id);

  const setupScreen = $('setup-screen');
  const householdsScreen = $('households-screen');
  const form = $('household-form');
  const servingInput = $('serving-count');
  const nameInput = $('household-name');
  const managerError = $('manager-error');

  let state = readStoredState();
  let mode = 'initial'; // 'initial', 'add', or 'edit'
  let editingId = null;
  let pendingDeleteId = null;

  function blankState() {
    return { version: 1, households: [], activeHouseholdId: null };
  }

  function isValidHousehold(household) {
    return household && typeof household.id === 'string' && household.id.length > 0 &&
      typeof household.name === 'string' && household.name.trim().length > 0 &&
      Number.isInteger(household.servings) && household.servings >= SERVING_MIN && household.servings <= SERVING_MAX &&
      Object.hasOwn(LIFESTYLES, household.lifestyle) &&
      Array.isArray(household.allergies) && household.allergies.every((a) => ALLERGY_OPTIONS.includes(a)) &&
      Array.isArray(household.excludedIngredients) && household.excludedIngredients.every((i) => typeof i === 'string');
  }

  function readStoredState() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return blankState();
      const parsed = JSON.parse(stored);
      if (parsed.version !== 1 || !Array.isArray(parsed.households)) return blankState();
      const households = parsed.households.filter(isValidHousehold);
      const activeHouseholdId = households.some((h) => h.id === parsed.activeHouseholdId)
        ? parsed.activeHouseholdId
        : (households[0]?.id ?? null);
      return { version: 1, households, activeHouseholdId };
    } catch (error) {
      // Corrupt data or disabled storage cannot falsely count as completed onboarding.
      return blankState();
    }
  }

  function persist(nextState) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      state = nextState;
      return true;
    } catch (error) {
      return false;
    }
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `household-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function hideError(id) {
    const element = $(id);
    element.textContent = '';
    element.hidden = true;
  }

  function showError(id, message) {
    const element = $(id);
    element.textContent = message;
    element.hidden = false;
  }

  function clearErrors() {
    ['name-error', 'servings-error', 'form-error', 'manager-error'].forEach(hideError);
    nameInput.setAttribute('aria-invalid', 'false');
    servingInput.setAttribute('aria-invalid', 'false');
  }

  function switchScreen(screen) {
    setupScreen.hidden = screen !== 'setup';
    householdsScreen.hidden = screen !== 'households';
  }

  function startForm(nextMode, household = null) {
    mode = nextMode;
    editingId = household?.id ?? null;
    form.reset();
    clearErrors();
    nameInput.value = household?.name ?? 'My household';
    servingInput.value = household?.servings ?? '';
    $('dietary-lifestyle').value = household?.lifestyle ?? 'omnivore';
    $('excluded-ingredients').value = household?.excludedIngredients.join(', ') ?? '';
    form.querySelectorAll('input[name="allergies"]').forEach((checkbox) => {
      checkbox.checked = household?.allergies.includes(checkbox.value) ?? false;
    });
    $('setup-step').textContent = nextMode === 'initial' ? 'GETTING STARTED · 1 OF 1' : 'HOUSEHOLD SETTINGS';
    $('setup-title').textContent = nextMode === 'edit' ? 'Edit household' :
      nextMode === 'add' ? 'Add a household' : 'Set up your household';
    $('setup-description').textContent = nextMode === 'initial'
      ? "Tell us who you cook for. We'll use these preferences to suggest suitable recipes and serving sizes."
      : 'Choose the serving size and food preferences for this household.';
    $('save-household').textContent = nextMode === 'edit' ? 'Save changes' : 'Save household';
    $('cancel-setup').hidden = nextMode === 'initial';
    switchScreen('setup');
    window.scrollTo(0, 0);
  }

  function parseExcludedIngredients(value) {
    const seen = new Set();
    return value.split(',').map((text) => text.trim()).filter((text) => {
      const key = text.toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getFormData() {
    const name = nameInput.value.trim();
    const rawServings = servingInput.value.trim();
    const servings = Number(rawServings);
    let firstInvalid = null;

    clearErrors();
    if (!name) {
      showError('name-error', 'Enter a household name.');
      nameInput.setAttribute('aria-invalid', 'true');
      firstInvalid = nameInput;
    }
    if (!rawServings || !Number.isInteger(servings) || servings < SERVING_MIN || servings > SERVING_MAX) {
      showError('servings-error', 'Enter a whole number between 1 and 30.');
      servingInput.setAttribute('aria-invalid', 'true');
      firstInvalid ??= servingInput;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    return {
      name,
      servings,
      lifestyle: $('dietary-lifestyle').value,
      allergies: Array.from(form.querySelectorAll('input[name="allergies"]:checked')).map((checkbox) => checkbox.value),
      excludedIngredients: parseExcludedIngredients($('excluded-ingredients').value)
    };
  }

  function householdDetails(household) {
    return `${household.servings} ${household.servings === 1 ? 'serving' : 'servings'} · ${LIFESTYLES[household.lifestyle]}`;
  }

  function createButton(label, action, householdId, testId, style = 'button-secondary') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button button-small ${style}`;
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.householdId = householdId;
    button.dataset.testid = testId;
    return button;
  }

  function appendInfo(parent, title, items) {
    const paragraph = document.createElement('p');
    paragraph.textContent = `${title}: ${items.length ? items.join(', ') : 'None'}`;
    parent.appendChild(paragraph);
  }

  function renderHouseholdCard(household) {
    const active = household.id === state.activeHouseholdId;
    const card = document.createElement('article');
    card.className = `household-card${active ? ' is-active' : ''}`;
    card.dataset.testid = 'household-card';
    card.dataset.householdId = household.id;

    const titleRow = document.createElement('div');
    titleRow.className = 'household-title-row';
    const title = document.createElement('h3');
    title.textContent = household.name;
    titleRow.appendChild(title);
    if (active) {
      const badge = document.createElement('span');
      badge.className = 'active-tag';
      badge.textContent = 'Active';
      badge.dataset.testid = 'active-badge';
      titleRow.appendChild(badge);
    }
    card.appendChild(titleRow);

    const details = document.createElement('p');
    details.textContent = householdDetails(household);
    card.appendChild(details);
    appendInfo(card, 'Allergies', household.allergies);
    appendInfo(card, 'Avoid', household.excludedIngredients);

    const actions = document.createElement('div');
    actions.className = 'household-actions';
    if (!active) actions.appendChild(createButton('Set active', 'activate', household.id, 'activate-household'));
    actions.appendChild(createButton('Edit', 'edit', household.id, 'edit-household'));
    actions.appendChild(createButton('Delete', 'delete', household.id, 'delete-household', 'button-danger'));
    card.appendChild(actions);

    if (pendingDeleteId === household.id) {
      const confirm = document.createElement('div');
      confirm.className = 'confirm-delete';
      const text = document.createElement('p');
      text.textContent = 'Delete this household? This cannot be undone.';
      confirm.appendChild(text);
      const confirmActions = document.createElement('div');
      confirmActions.className = 'household-actions';
      confirmActions.appendChild(createButton('Cancel', 'cancel-delete', household.id, 'cancel-delete'));
      confirmActions.appendChild(createButton('Confirm delete', 'confirm-delete', household.id, 'confirm-delete', 'button-danger'));
      confirm.appendChild(confirmActions);
      card.appendChild(confirm);
    }
    return card;
  }

  function renderHouseholds() {
    pendingDeleteId = pendingDeleteId && state.households.some((h) => h.id === pendingDeleteId) ? pendingDeleteId : null;
    hideError('manager-error');
    const active = state.households.find((h) => h.id === state.activeHouseholdId) ?? state.households[0];
    if (!active) {
      startForm('initial');
      return;
    }
    $('active-title').textContent = active.name;
    $('active-description').textContent = householdDetails(active);
    const list = $('household-list');
    list.replaceChildren(...state.households.map(renderHouseholdCard));
    switchScreen('households');
    window.scrollTo(0, 0);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = getFormData();
    if (!profile) return;

    const next = {
      version: 1,
      households: state.households.map((h) => ({ ...h })),
      activeHouseholdId: state.activeHouseholdId
    };
    if (mode === 'edit') {
      const index = next.households.findIndex((h) => h.id === editingId);
      if (index < 0) {
        showError('form-error', 'This household no longer exists. Please try again.');
        return;
      }
      next.households[index] = { id: editingId, ...profile };
    } else {
      const added = { id: newId(), ...profile };
      next.households.push(added);
      if (mode === 'initial' || !next.activeHouseholdId) next.activeHouseholdId = added.id;
    }
    if (!persist(next)) {
      showError('form-error', 'Could not save on this device. Check whether browser storage is blocked or full.');
      return;
    }
    pendingDeleteId = null;
    renderHouseholds();
  });

  $('cancel-setup').addEventListener('click', () => renderHouseholds());
  $('add-household').addEventListener('click', () => startForm('add'));

  $('household-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const household = state.households.find((h) => h.id === button.dataset.householdId);
    if (!household) return;
    const action = button.dataset.action;
    if (action === 'edit') {
      startForm('edit', household);
    } else if (action === 'delete') {
      pendingDeleteId = household.id;
      renderHouseholds();
    } else if (action === 'cancel-delete') {
      pendingDeleteId = null;
      renderHouseholds();
    } else if (action === 'activate' || action === 'confirm-delete') {
      const next = {
        version: 1,
        households: action === 'activate' ? state.households : state.households.filter((h) => h.id !== household.id),
        activeHouseholdId: action === 'activate' ? household.id : state.activeHouseholdId
      };
      if (!next.households.some((h) => h.id === next.activeHouseholdId)) {
        next.activeHouseholdId = next.households[0]?.id ?? null;
      }
      if (!persist(next)) {
        showError('manager-error', 'Could not update the device storage. Please try again.');
        return;
      }
      pendingDeleteId = null;
      if (next.households.length === 0) startForm('initial');
      else renderHouseholds();
    }
  });

  if (state.households.length === 0) startForm('initial');
  else renderHouseholds();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        // Offline caching is optional; the page still functions without service workers.
      });
    });
  }
})();
