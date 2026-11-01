// One delegated listener for the toggle controls, so screens don't wire them one by one:
//  - .chip[aria-pressed]: toggles. In a [data-select="single"] row, pressing one releases the others.
//  - [role="radio"] in a [role="radiogroup"] (segmented control): checks one; arrow keys move.
//  - [role="switch"]: toggles aria-checked.
// Each change fires a bubbling "change" event on the control, so screens can listen on a parent.

function notify(control) {
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function toggleChip(chip) {
  const row = chip.closest('[data-select="single"]');
  const pressed = chip.getAttribute('aria-pressed') === 'true';
  if (row) {
    if (pressed) return;
    row.querySelectorAll('.chip[aria-pressed="true"]').forEach((other) => other.setAttribute('aria-pressed', 'false'));
  }
  chip.setAttribute('aria-pressed', String(!pressed));
  notify(chip);
}

function checkRadio(radio) {
  const group = radio.closest('[role="radiogroup"]');
  group.querySelectorAll('[role="radio"]').forEach((other) => {
    const checked = other === radio;
    other.setAttribute('aria-checked', String(checked));
    other.tabIndex = checked ? 0 : -1;
  });
  notify(radio);
}

function toggleSwitch(control) {
  const checked = control.getAttribute('aria-checked') === 'true';
  control.setAttribute('aria-checked', String(!checked));
  notify(control);
}

function onClick(event) {
  const chip = event.target.closest('.chip[aria-pressed]');
  if (chip) {
    toggleChip(chip);
    return;
  }
  const radio = event.target.closest('[role="radiogroup"] [role="radio"]');
  if (radio) {
    if (radio.getAttribute('aria-checked') !== 'true') checkRadio(radio);
    return;
  }
  const control = event.target.closest('[role="switch"]');
  if (control) toggleSwitch(control);
}

// Arrow keys move the selection within a radiogroup, as screen readers expect.
function onKeydown(event) {
  const radio = event.target.closest('[role="radiogroup"] [role="radio"]');
  if (!radio) return;
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const radios = [...radio.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')];
  const next = radios[(radios.indexOf(radio) + step + radios.length) % radios.length];
  checkRadio(next);
  next.focus();
}

export function initControls() {
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
}
