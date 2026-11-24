const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function boot(today = [2026, 10, 24]) {
  const instant = new Date(...today, 12).getTime();
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return instant; }
  }
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', hidden: true });
    return elements.get(id);
  };
  const storage = new Map([['smartPantry_inventory', '[]'], ['unrelated', 'keep']]);
  const context = vm.createContext({
    Date: FixedDate,
    document: { getElementById: get, addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null }
  });
  vm.runInContext(read('date-utils.js'), context);
  vm.runInContext(read('pantry.js'), context);
  return { context, get, storage, render(items) {
    storage.set('smartPantry_inventory', JSON.stringify(items));
    const before = JSON.stringify([...storage]);
    context.renderPantry();
    assert.equal(JSON.stringify([...storage]), before, 'rendering must not change stored data');
  } };
}

test('the pantry window includes today, 24 and 48 hours, excluding expired and later items', () => {
  const { context } = boot();
  for (const [date, expected] of [
    ['2026-11-23', 'expirado'], ['2026-11-24', 'quase'],
    ['2026-11-25', 'quase'], ['2026-11-26', 'quase'],
    ['2026-11-27', null], ['2026-11-29', null],
    [null, null], ['', null], ['invalid', null], ['2026-02-30', null]
  ]) {
    assert.equal(context.obterEstadoValidade(date, 2), expected, String(date));
  }
  assert.equal(context.obterEstadoValidade('2026-11-27'), 'quase', 'recipe window stays at three days');
  assert.equal(context.estaQuaseAExpirar('2026-11-27'), true);
});

test('calendar-day boundaries work across daylight saving and month/year changes', () => {
  for (const [today, expiry] of [
    [[2026, 2, 28], '2026-03-30'], // Lisbon switches to summer time.
    [[2026, 9, 24], '2026-10-26'], // Lisbon switches back to winter time.
    [[2026, 11, 31], '2027-01-02']
  ]) {
    const { context } = boot(today);
    assert.equal(context.calcularDiasParaExpirar(expiry), 2);
    assert.equal(context.obterEstadoValidade(expiry, 2), 'quase');
  }
});

test('tray and inventory warning include only soon-expiring items, escaping saved names', () => {
  const app = boot();
  app.render([
    { id: 'soon', name: 'Milk <script>', expiry: '2026-11-25' },
    { id: 'boundary', name: 'Yogurt', expiry: '2026-11-26' },
    { id: 'later', name: 'Rice', expiry: '2026-11-29' },
    { id: 'expired', name: 'Old cheese', expiry: '2026-11-23' },
    { id: 'undated', name: 'Salt', expiry: null }
  ]);
  assert.equal(app.get('expiry-alert-tray').hidden, false);
  const tray = app.get('expiry-alert-items').innerHTML;
  assert.match(tray, /Milk &lt;script&gt;/);
  assert.match(tray, /Yogurt/);
  assert.doesNotMatch(tray, /Rice|Old cheese|Salt|<script>/);
  const html = app.get('pantry-list').innerHTML;
  const cards = html.split('<div class="form-card pantry-item"').slice(1);
  assert.equal(cards.length, 5);
  for (const card of cards) {
    const soon = /^ data-id="(soon|boundary)"/.test(card);
    assert.equal(card.includes('data-testid="expiry-warning"'), soon);
  }
  assert.match(html, /expiry-warning-expired/);
  assert.doesNotMatch(html, /<script>/);
});

test('rerendering clears stale tray entries and hides an empty tray', () => {
  const app = boot();
  app.render([{ id: 'soon', name: 'Milk', expiry: '2026-11-25' }]);
  assert.equal(app.get('expiry-alert-tray').hidden, false);
  app.render([{ id: 'later', name: 'Rice', expiry: '2026-11-29' }]);
  assert.equal(app.get('expiry-alert-tray').hidden, true);
  assert.equal(app.get('expiry-alert-items').innerHTML, '');
  assert.doesNotMatch(app.get('pantry-list').innerHTML, /data-testid="expiry-warning"/);
  app.render([]);
  assert.equal(app.get('expiry-alert-tray').hidden, true);
  assert.match(app.get('pantry-list').innerHTML, /despensa está vazia/);
});
