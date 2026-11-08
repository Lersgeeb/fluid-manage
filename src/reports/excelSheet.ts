import type { SheetData } from 'write-excel-file/browser';
import { PRIORITY_COLORS } from '../domain/constants';
import { EXCEL_FIELDS, type ReportLabels, type ReportRow } from './reportRows';

export const EXCEL_CELL_LIMIT = 32767;

const WRAPPED_FIELDS = new Set<keyof ReportRow>(['description', 'lastThreeComments', 'lastComment']);

export const EXCEL_COLUMN_WIDTHS = EXCEL_FIELDS.map((field) => ({
  width: WRAPPED_FIELDS.has(field) ? 45 : 20,
}));

/**
 * Every value is written as an explicit String cell, which is what keeps
 * formula-like user text from being evaluated when the workbook is opened.
 */
export function buildExcelSheet(rows: ReportRow[], labels: ReportLabels): SheetData {
  const header = EXCEL_FIELDS.map((field) => ({
    value: labels.headers[field],
    type: String,
    fontWeight: 'bold' as const,
  }));

  const body = rows.map((row) =>
    EXCEL_FIELDS.map((field) => {
      if (field === 'priority') {
        return {
          value: labels.priorities[row.priority],
          type: String,
          fontWeight: 'bold' as const,
          textColor: '#111111',
          backgroundColor: PRIORITY_COLORS[row.priority],
        };
      }
      return {
        value: row[field].slice(0, EXCEL_CELL_LIMIT),
        type: String,
        wrap: WRAPPED_FIELDS.has(field),
      };
    }),
  );

  return [header, ...body];
}
