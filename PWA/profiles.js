/* Shared local profile storage and header control for all app pages. */
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

  const $ = (id) => document.getElementById(id);

  function renderSwitcher(state = readStoredState()) {
    const selector = $('active-profile');
    selector.replaceChildren(...state.households.map((household) => {
      const option = document.createElement('option');
      option.value = household.id;
      option.textContent = household.name;
      return option;
    }));
    selector.value = state.activeHouseholdId ?? '';
    $('profile-switcher').hidden = state.households.length === 0;
    $('profile-switch-error').hidden = true;
    $('profile-switch-error').textContent = '';
  }

  function initSwitcher(onChange = () => {}) {
    renderSwitcher();
    $('active-profile').addEventListener('change', (event) => {
      // Read current storage so switching cannot overwrite profiles edited elsewhere.
      const state = readStoredState();
      const id = event.target.value;
      renderSwitcher(state);
      const error = $('profile-switch-error');
      if (!state.households.some((household) => household.id === id)) {
        error.textContent = 'This profile is no longer available.';
        error.hidden = false;
        return;
      }
      if (id === state.activeHouseholdId) return;
      const next = { ...state, activeHouseholdId: id };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (failure) {
        error.textContent = 'Could not switch profiles on this device. Please try again.';
        error.hidden = false;
        return;
      }
      renderSwitcher(next);
      onChange(next);
    });
  }

  window.SmartPantryProfiles = { readStoredState, renderSwitcher, initSwitcher, isValidHousehold, LIFESTYLES };
  // The household page initializes with a callback to refresh its active card.
  if (!$('household-form')) initSwitcher();
})();
