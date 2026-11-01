// A field row with a value and a Set button. Set turns the row into a text input with
// Save / Cancel; Save calls onSave(value) and shows the new value.

export function inlineSetRow({ label, value, placeholder = 'Not set', mono = false, onSave }) {
  const row = document.createElement('div');
  row.className = 'field-row';

  const show = (current) => {
    const text = document.createElement('div');
    text.className = 'stack-0-5';
    const key = document.createElement('span');
    key.className = 'field-key';
    key.textContent = label;
    const shown = document.createElement('span');
    shown.className = current ? (mono ? 'text-mono' : '') : 'text-muted';
    shown.textContent = current || placeholder;
    text.append(key, shown);

    const set = document.createElement('button');
    set.type = 'button';
    set.className = 'button button-sm';
    set.textContent = 'Set';
    set.setAttribute('aria-label', `Set ${label.toLowerCase()}`);
    set.addEventListener('click', () => edit(current));
    row.replaceChildren(text, set);
  };

  const edit = (current) => {
    const input = document.createElement('input');
    input.className = `input${mono ? ' input-mono' : ''}`;
    input.value = current || '';
    input.setAttribute('aria-label', label);
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'button button-sm';
    save.textContent = 'Save';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button button-sm';
    cancel.textContent = 'Cancel';

    const commit = async () => {
      save.disabled = true;
      const next = input.value.trim();
      await onSave(next || undefined);
      show(next);
    };
    save.addEventListener('click', commit);
    cancel.addEventListener('click', () => show(current));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') commit();
      if (event.key === 'Escape') show(current);
    });
    row.replaceChildren(input, save, cancel);
    input.focus();
  };

  show(value);
  return row;
}
