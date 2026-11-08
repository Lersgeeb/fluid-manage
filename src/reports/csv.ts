import { CSV_FIELDS, type ReportLabels, type ReportRow } from './reportRows';

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

/** Makes Excel read the file as UTF-8, keeping accents intact. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** Stops spreadsheets from executing user text as a formula (CSV injection). */
export const neutralizeFormula = (value: string) => (FORMULA_START.test(value) ? `'${value}` : value);

function cell(value: string): string {
  const safe = neutralizeFormula(value);
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: ReportRow[], labels: ReportLabels): string {
  const header = CSV_FIELDS.map((field) => cell(labels.headers[field]));
  const lines = rows.map((row) =>
    CSV_FIELDS.map((field) => cell(field === 'priority' ? labels.priorities[row.priority] : row[field])).join(','),
  );
  return BYTE_ORDER_MARK + [header.join(','), ...lines].join('\r\n');
}
