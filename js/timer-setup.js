// Darkroom timer: the setup panel. Rebuilt whenever the settings change.
// Each chemical select lists my bottles first ("… · bottle · 7 of 24 rolls"), then the catalogue.

import { bottleLabel } from './chemicals.js';
import { BW_FILMS, developerOptions } from './timer-calc.js';
import { BATHS } from './timer-data.js';
import { COLOUR_FILMS } from './timer-data-kits.js';
import { AGITATIONS, PUSH_LABELS, availablePush, currentColourFilm, currentKit, kitsFor } from './timer-steps.js';

const PROCESSES = [['bw', 'B&W'], ['c41', 'C-41'], ['e6', 'E-6'], ['ecn2', 'ECN-2']];
const BOTTLE = 'bottle:';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function selectField(labelText, options, value, onChange, disabled = false) {
  const field = el('label', 'form-field');
  field.append(el('span', 'form-label', labelText));
  const box = el('div', 'select');
  const select = el('select', 'input');
  select.disabled = disabled;
  options.forEach((o) => {
    const option = new Option(o.text, o.value, false, o.value === value);
    option.disabled = Boolean(o.disabled);
    select.add(option);
  });
  select.addEventListener('change', () => onChange(select.value));
  box.append(select);
  field.append(box);
  return field;
}

const plainOptions = (names) => names.map((name) => ({ value: name, text: name }));
const bathOptions = (group) => plainOptions(BATHS[group].map((b) => b.label));

function processTabs(current, change) {
  const group = el('div', 'segmented');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Process');
  PROCESSES.forEach(([key, label]) => {
    const button = el('button', 'segment', label);
    button.type = 'button';
    button.dataset.process = key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(key === current));
    button.tabIndex = key === current ? 0 : -1;
    group.append(button);
  });
  group.addEventListener('change', (event) => change({ process: event.target.dataset.process }));
  return group;
}

function temperatureField(value, change) {
  const field = el('label', 'form-field');
  const label = el('span', 'form-label', `Temperature ${value} °C`);
  const slider = el('input', 'timer-slider');
  Object.assign(slider, { type: 'range', min: 18, max: 28, step: 0.5, value });
  slider.addEventListener('input', () => { label.textContent = `Temperature ${slider.value} °C`; });
  slider.addEventListener('change', () => change({ temperature: Number(slider.value) }));
  field.append(label, slider);
  return field;
}

/** A chemical select: my bottles of this kind first, then the catalogue. Picking a bottle picks its product. */
function chemicalField(session, kind, labelText, catalogue, current, onProduct, disabled = false) {
  const s = session.settings;
  const mine = [...session.bottles().values()].filter((b) => b.kind === kind && (kind !== 'kit' || b.process === s.process));
  const options = [...mine.map((b) => ({ value: `${BOTTLE}${b.id}`, text: bottleLabel(b) })), ...catalogue];
  const chosen = session.bottleFor(kind);
  const value = chosen ? `${BOTTLE}${chosen.id}` : current;
  return selectField(labelText, options, value, (picked) => (picked.startsWith(BOTTLE) ? session.pickBottle(kind, picked.slice(BOTTLE.length)) : onProduct(picked)), disabled);
}

/** Builds the panel's contents. session: the timer session. */
export function renderSetup(session) {
  const s = session.settings;
  const change = (patch) => session.change(patch);
  const fields = el('fieldset', 'timer-fieldset stack-2');
  fields.disabled = session.busy();
  fields.append(processTabs(s.process, change));

  if (s.process === 'bw') {
    const fixedAgitation = ['rod100', 'caffenol', 'df96'].includes(s.developer);
    fields.append(
      selectField('Film', plainOptions(BW_FILMS), s.film, (film) => change({ film })),
      chemicalField(session, 'developer', 'Developer', developerOptions(s.film), s.developer, (developer) => change({ developer })),
      temperatureField(s.temperature, change),
      selectField('Agitation', AGITATIONS.map(([value, text]) => ({ value, text })), s.agitation, (agitation) => change({ agitation }), fixedAgitation),
    );
    if (s.developer !== 'df96') {
      fields.append(
        chemicalField(session, 'stop', 'Stop bath', bathOptions('Stop'), s.stop, (stop) => change({ stop })),
        chemicalField(session, 'fixer', 'Fixer', bathOptions('Fixer'), s.fixer, (fixer) => change({ fixer })),
        chemicalField(session, 'hypo', 'Hypo clear', bathOptions('Hypo clear'), s.hypo, (hypo) => change({ hypo })),
      );
    }
    fields.append(chemicalField(session, 'wetting', 'Wetting agent', bathOptions('Wetting'), s.wetting, (wetting) => change({ wetting })));
  } else {
    fields.append(
      selectField('Film', plainOptions(COLOUR_FILMS[s.process]), currentColourFilm(s), (film) => change({ colourFilm: { ...s.colourFilm, [s.process]: film } })),
      chemicalField(session, 'kit', 'Chemistry kit', plainOptions(kitsFor(s.process).map((k) => k.name)), currentKit(s).name, (kit) => change({ kit: { ...s.kit, [s.process]: kit } })),
    );
  }

  const available = availablePush(s);
  const pushDisabled = s.process === 'bw' && s.developer === 'df96';
  fields.append(selectField('Push / pull', PUSH_LABELS.map(([value, text]) => ({ value, text, disabled: !available[value] })), s.push, (push) => change({ push }), pushDisabled));

  const notes = el('div', 'stack-1');
  const plan = session.plan();
  plan.info.forEach((line) => notes.append(el('p', 'text-sm', line)));
  plan.warnings.forEach((line) => notes.append(el('p', 'text-sm timer-warning', line)));
  if (plan.source) notes.append(el('p', 'text-xs text-muted', `Source: ${plan.source}`));
  return [fields, notes];
}
