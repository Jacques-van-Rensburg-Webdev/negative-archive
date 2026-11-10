// Darkroom timer: the My chemicals panel. Every live bottle with its status and a Throw out button,
// and the Mix new form. Bottles are read through the session; writes go to the database.

import { KINDS, bottleStatus, findProduct, products, todayText } from './chemicals.js';
import { mixBottle, retireBottle } from './chemicals-store.js';
import { getDb } from './db.js';

const KIND_LABEL = Object.fromEntries(KINDS);
const PROCESS_LABEL = { c41: 'C-41', e6: 'E-6', ecn2: 'ECN-2' };
const SURE_MS = 4000;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function field(labelText, input, className = 'form-field') {
  const wrap = el('label', className);
  wrap.append(el('span', 'form-label', labelText), input);
  return wrap;
}

function selectInput(options, value) {
  const box = el('div', 'select');
  const select = el('select', 'input');
  options.forEach(([key, text]) => select.add(new Option(text, key, false, key === value)));
  box.append(select);
  return [box, select];
}

function numberInput(value, placeholder) {
  const input = el('input', 'input input-mono');
  Object.assign(input, { type: 'number', min: 0, step: 1, inputMode: 'numeric', placeholder });
  if (value != null) input.value = value;
  return input;
}

// Throw out needs a second tap within a few seconds
function throwOutButton(id) {
  let timer;
  const node = button('button button-sm', 'Throw out', async () => {
    if (node.dataset.sure) { node.disabled = true; await retireBottle(await getDb(), id); return; }
    node.dataset.sure = '1';
    node.textContent = 'Tap again to throw out';
    timer = setTimeout(() => { delete node.dataset.sure; node.textContent = 'Throw out'; }, SURE_MS);
  });
  node.addEventListener('blur', () => clearTimeout(timer));
  return node;
}

function bottleRow(bottle) {
  const row = el('li', 'timer-row');
  const text = el('div', 'timer-row-text stack-0-5');
  const status = bottleStatus(bottle);
  const name = bottle.process ? `${PROCESS_LABEL[bottle.process]} · ${bottle.name}` : bottle.name;
  text.append(el('span', 'timer-row-name text-bold', name), el('span', `text-xs timer-bottle-status is-${status.state}`, `${KIND_LABEL[bottle.kind]} · ${status.text}`));
  row.append(text, throwOutButton(bottle.id));
  return row;
}

function mixForm(onDone) {
  const form = el('form', 'stack-2 timer-mix');
  const state = { kind: 'fixer', product: null };
  const [kindBox, kindSelect] = selectInput(KINDS, state.kind);
  const productBox = el('div', 'select');
  const mixed = el('input', 'input');
  Object.assign(mixed, { type: 'date', value: todayText(), required: true });
  const capacity = numberInput(null, 'from the bottle');
  const days = numberInput(null, 'from the bottle');
  const note = el('p', 'text-xs text-muted');
  const save = button('span-2 button button-primary', 'Save bottle', () => {});
  save.type = 'submit';
  const cancel = button('span-2 button button-secondary', 'Cancel', () => onDone());
  const pair = (a, b) => { const row = el('div', 'grid grid-inner'); row.append(a, b); return row; };

  const fillProduct = () => {
    const p = findProduct(state.kind, state.product);
    capacity.value = p?.capacity ?? '';
    days.value = p?.days ?? '';
    save.disabled = !p || p.oneShot;
    if (!p) note.textContent = '';
    else if (p.oneShot) note.textContent = `${p.name} is one-shot: discard after use, nothing to keep.`;
    else note.textContent = [p.capacity != null ? `Capacity ${p.capacity} rolls` : 'Capacity: see the bottle', p.daysAreGuide ? `${p.days} days is a guide, not the maker's figure` : `use within ${p.days} days`, p.source && `(${p.source})`].filter(Boolean).join(' · ');
  };
  const fillProducts = () => {
    const list = products(state.kind);
    state.product = list.some((p) => p.key === state.product) ? state.product : list[0]?.key;
    const [, select] = selectInput(list.map((p) => [p.key, p.process ? `${PROCESS_LABEL[p.process]} · ${p.name}` : p.name]), state.product);
    select.addEventListener('change', () => { state.product = select.value; fillProduct(); });
    productBox.replaceChildren(select);
    fillProduct();
  };
  kindSelect.addEventListener('change', () => { state.kind = kindSelect.value; fillProducts(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    save.disabled = true;
    try {
      await mixBottle(await getDb(), {
        kind: state.kind,
        product: state.product,
        mixedAt: mixed.value || todayText(),
        capacity: capacity.value === '' ? null : Number(capacity.value),
        useWithinDays: days.value === '' ? null : Number(days.value),
      });
      onDone();
    } catch (error) {
      note.textContent = `Not saved: ${error.message}`;
      save.disabled = false;
    }
  });

  form.append(field('Kind', kindBox), field('Product', productBox), pair(field('Mixed on', mixed, 'span-2 form-field'), field('Rolls per bottle', capacity, 'span-2 form-field')), pair(field('Use within (days)', days, 'span-2 form-field'), el('div', 'span-2')), note, pair(save, cancel));
  fillProducts();
  return form;
}

/** The panel: { root, refresh }. refresh() redraws the list from the session's bottles. */
export function createChemicalsPanel(session) {
  const root = el('section', 'span-4 timer-panel stack-2');
  const head = el('div', 'results-head');
  const title = el('h2', 'section-label', 'My chemicals');
  const list = el('ol', 'timer-sheet');
  const empty = el('p', 'text-sm text-muted', 'No bottles yet. Mix new to keep count of a fixer, stop bath, stock developer or colour kit.');
  const slot = el('div');
  let form = null;
  const close = () => { form?.remove(); form = null; mix.hidden = false; };
  const mix = button('button button-sm', '+ Mix new', () => {
    if (form) return;
    form = mixForm(close);
    slot.append(form);
    mix.hidden = true;
    form.querySelector('select').focus();
  });
  head.append(title, mix);
  root.append(head, list, empty, slot);

  function refresh() {
    const bottles = [...session.bottles().values()];
    list.replaceChildren(...bottles.map(bottleRow));
    list.hidden = !bottles.length;
    empty.hidden = Boolean(bottles.length);
  }
  refresh();
  return { root, refresh };
}
