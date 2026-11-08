import type { Board } from '../domain/types';
import type { Translate } from '../i18n/messages';
import { toCsv } from './csv';
import { datedFileName, downloadBlob } from './download';
import type { ReportLabels, ReportRow } from './reportRows';

export function reportLabels(t: Translate): ReportLabels {
  return {
    headers: {
      status: t('report.status'),
      tag: t('report.tag'),
      priority: t('report.priority'),
      name: t('report.name'),
      reference: t('report.reference'),
      nextStep: t('report.nextStep'),
      createdAt: t('report.createdAt'),
      updatedAt: t('report.updatedAt'),
      description: t('report.description'),
      lastThreeComments: t('report.lastThreeComments'),
      lastComment: t('report.lastComment'),
    },
    priorities: {
      low: t('priority.low'),
      medium: t('priority.medium'),
      high: t('priority.high'),
      critical: t('priority.critical'),
    },
  };
}

export function exportJson(board: Board): void {
  const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
  downloadBlob(blob, datedFileName('json'));
}

export function exportCsv(rows: ReportRow[], labels: ReportLabels): void {
  downloadBlob(new Blob([toCsv(rows, labels)], { type: 'text/csv;charset=utf-8' }), datedFileName('csv'));
}

/** The workbook writer is the heaviest dependency, so it only loads when used. */
export async function exportExcel(rows: ReportRow[], labels: ReportLabels): Promise<void> {
  const [{ default: writeXlsxFile }, { buildExcelSheet, EXCEL_COLUMN_WIDTHS }] = await Promise.all([
    import('write-excel-file/browser'),
    import('./excelSheet'),
  ]);
  const blob = await writeXlsxFile(buildExcelSheet(rows, labels), { columns: EXCEL_COLUMN_WIDTHS }).toBlob();
  downloadBlob(blob, datedFileName('xlsx'));
}
