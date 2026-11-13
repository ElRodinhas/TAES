/* US-20: explicit sources keep backups complete without exporting unrelated origin data. */
(() => {
  'use strict';

  // Add one entry here when a new feature starts persisting JSON data.
  // Keep stored objects intact, including fields unknown to the current UI.
  const DATA_SOURCES = Object.freeze([
    { name: 'profiles', storageKey: 'smartPantry.households.v1',
      empty: () => ({ version: 1, households: [], activeHouseholdId: null }) },
    { name: 'pantryStock', storageKey: 'smartPantry_inventory', empty: () => [] }
  ]);

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

  window.SmartPantryExport = { createSnapshot };
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
})();
