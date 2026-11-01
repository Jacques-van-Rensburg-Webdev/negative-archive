// CSV parser: quoted fields, "" escapes, commas and line breaks inside quotes, BOM.
// The delimiter (comma or semicolon, as some Numbers exports use) is detected from the first line.

function detectDelimiter(text) {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char === ',') commas += 1;
    else if (!quoted && char === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

/** Parses CSV text into an array of rows (arrays of strings). Blank lines are dropped. */
export function parseCsv(input) {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length) endRow();
  return rows;
}
