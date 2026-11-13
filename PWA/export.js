/* US-20: explicit sources keep backups complete without exporting unrelated origin data. */
(() => {
  'use strict';

  // Add one entry here when a new feature starts persisting JSON data,
  // including a validator for imports. Both directions use the same source list.
  // Keep stored objects intact, including fields unknown to the current UI.
  const DATA_SOURCES = Object.freeze([
    { name: 'profiles', storageKey: 'smartPantry.households.v1',
      empty: () => ({ version: 1, households: [], activeHouseholdId: null }), valid: validProfiles },
    { name: 'pantryStock', storageKey: 'smartPantry_inventory', empty: () => [], valid: validPantry }
  ]);

  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const nonemptyString = (value) => typeof value === 'string' && value.trim().length > 0;

  function validProfiles(value) {
    if (!isObject(value) || value.version !== 1 || !Array.isArray(value.households) ||
        !value.households.every(window.SmartPantryProfiles.isValidHousehold)) return false;
    const ids = new Set(value.households.map((household) => household.id));
    return ids.size === value.households.length && (ids.size === 0
      ? value.activeHouseholdId === null : ids.has(value.activeHouseholdId));
  }

  function validPantry(value) {
    if (!Array.isArray(value)) return false;
    const ids = new Set();
    const barcodes = new Map();
    return value.every((item) => {
      if (!isObject(item) || !nonemptyString(item.id) || ids.has(item.id) || !nonemptyString(item.name) ||
          typeof item.category !== 'string' ||
          !['number', 'string'].includes(typeof item.quantity) ||
          !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) return false;
      ids.add(item.id);
      if (item.expiry !== null && item.expiry !== undefined && item.expiry !== '' &&
          (typeof item.expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.expiry) ||
           !Number.isFinite(Date.parse(item.expiry)) || new Date(item.expiry).toISOString().slice(0, 10) !== item.expiry)) return false;
      if (item.barcode !== null && item.barcode !== undefined && item.barcode !== '') {
        if (typeof item.barcode !== 'string' || !codigoBarrasValido(item.barcode)) return false;
        const name = item.name.trim().toLowerCase();
        if (barcodes.has(item.barcode) && barcodes.get(item.barcode) !== name) return false;
        barcodes.set(item.barcode, name);
      }
      return true;
    });
  }

  function validateSnapshot(snapshot) {
    if (!isObject(snapshot) || snapshot.application !== 'SmartPantry' || snapshot.schemaVersion !== 1 ||
        typeof snapshot.exportedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.exportedAt)) ||
        !isObject(snapshot.data)) throw new Error('Choose a supported Smart Pantry JSON backup (schema version 1).');
    if (Object.keys(snapshot.data).some((name) => !DATA_SOURCES.some((source) => source.name === name))) {
      throw new Error('This backup contains data this app version cannot restore. Update the app first.');
    }
    for (const source of DATA_SOURCES) {
      if (!Object.hasOwn(snapshot.data, source.name) || !source.valid(snapshot.data[source.name])) {
        throw new Error(`The backup has missing or invalid ${source.name} data. Nothing was imported.`);
      }
    }
  }

  function restoreSnapshot(storage, snapshot) {
    validateSnapshot(snapshot);
    // Read and serialize everything before writing. Never clear unrelated origin data.
    const changes = DATA_SOURCES.map((source) => ({
      key: source.storageKey, previous: storage.getItem(source.storageKey),
      next: JSON.stringify(snapshot.data[source.name])
    }));
    const written = [];
    try {
      for (const change of changes) {
        storage.setItem(change.key, change.next);
        written.push(change);
      }
    } catch (failure) {
      let rollbackFailed = false;
      for (const change of written.reverse()) {
        try {
          if (change.previous === null) storage.removeItem(change.key);
          else storage.setItem(change.key, change.previous);
        } catch (rollbackError) {
          rollbackFailed = true;
        }
      }
      throw new Error(rollbackFailed
        ? 'Import failed and previous data could not be fully restored. Check your saved data before trying again.'
        : 'Could not save the import. Your previous data was restored. Check available browser storage and try again.');
    }
  }

  function createSnapshot(storage, now = new Date()) {
    const data = {};
    for (const source of DATA_SOURCES) {
      // A failed read or invalid JSON aborts the entire backup; never silently omit data.
      const stored = storage.getItem(source.storageKey);
      data[source.name] = stored === null ? source.empty() : JSON.parse(stored);
    }
    return { application: 'SmartPantry', schemaVersion: 1, exportedAt: now.toISOString(), data };
  }

  function downloadSnapshot(snapshot) {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    try {
      link.href = url;
      link.download = `smartpantry-backup-${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      // Give the browser time to start reading the download before releasing its URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  window.SmartPantryExport = { createSnapshot, validateSnapshot, restoreSnapshot };
  document.getElementById('export-data').addEventListener('click', () => {
    const error = document.getElementById('export-error');
    const status = document.getElementById('export-status');
    error.hidden = true;
    status.textContent = '';
    try {
      downloadSnapshot(createSnapshot(window.localStorage));
      status.textContent = 'Export file prepared. Check your browser downloads.';
    } catch (failure) {
      error.textContent = 'Could not export your data. Saved data could not be read or the download could not be started. Please try again.';
      error.hidden = false;
    }
  });

  const importButton = document.getElementById('import-data');
  const fileInput = document.getElementById('import-file');
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const error = document.getElementById('import-error');
    const status = document.getElementById('import-status');
    error.hidden = true;
    status.textContent = '';
    importButton.disabled = true;
    fileInput.disabled = true;
    try {
      let snapshot;
      try {
        snapshot = JSON.parse(await file.text());
      } catch (readError) {
        throw new Error('Could not read this file as JSON. Choose a Smart Pantry backup file.');
      }
      validateSnapshot(snapshot);
      if (!window.confirm('Import this backup? It will replace all saved profiles and pantry stock on this device. Export your current data first if you want to keep it.')) {
        status.textContent = 'Import cancelled. Your saved data is unchanged.';
        return;
      }
      restoreSnapshot(window.localStorage, snapshot);
      // Reinitialize both the dashboard and its in-memory profile state from storage.
      window.location.reload();
    } catch (failure) {
      error.textContent = failure.message || 'Could not import the backup. Please try again.';
      error.hidden = false;
    } finally {
      fileInput.value = '';
      fileInput.disabled = false;
      importButton.disabled = false;
    }
  });
})();
