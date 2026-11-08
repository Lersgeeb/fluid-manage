// @vitest-environment node
import { unzipSync, strFromU8 } from 'fflate';
import writeXlsxFile from 'write-excel-file/node';
import { describe, expect, it } from 'vitest';
import type { Board, Comment, Task } from '../domain/types';
import { DEFAULT_VIEW } from '../domain/view';
import { neutralizeFormula, toCsv } from './csv';
import { buildExcelSheet, EXCEL_CELL_LIMIT } from './excelSheet';
import { buildReportRows, reportColumns, type ReportLabels, type ReportRow } from './reportRows';

const comment = (id: string, day: number): Comment => ({
  id,
  text: `c-${id}`,
  createdAt: `2024-01-0${day}T00:00:00.000Z`,
  updatedAt: `2024-01-0${day}T00:00:00.000Z`,
});

const makeTask = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: `name-${id}`,
  description: 'desc',
  tag: 'ACME',
  tagColor: '#000',
  priority: 'high',
  reference: 'REF',
  nextStep: 'next',
  columnId: 'c',
  order: 0,
  createdAt: new Date(2024, 0, 15, 9, 5).toISOString(),
  updatedAt: new Date(2024, 1, 20, 18, 30).toISOString(),
  ...extra,
});

const labels: ReportLabels = {
  headers: {
    status: 'Status',
    tag: 'Tag',
    priority: 'Priority',
    name: 'Name',
    reference: 'Reference',
    nextStep: 'Next step',
    createdAt: 'Created',
    updatedAt: 'Updated',
    description: 'Description',
    lastThreeComments: 'Last three comments',
    lastComment: 'Last comment',
  },
  priorities: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },
};

const board: Board = {
  columns: [
    { id: 'c', title: 'Todo', order: 0, tasks: [makeTask('1'), makeTask('2', { tag: 'Other', hidden: true })] },
    { id: 'z', title: 'Archive', order: 1, isArchive: true, tasks: [makeTask('3')] },
  ],
};

const row = (over: Partial<ReportRow> = {}): ReportRow => ({
  status: 'Todo',
  tag: 'ACME',
  priority: 'high',
  name: 'Name',
  reference: 'R',
  nextStep: 'N',
  createdAt: '2024-01-15 09:05',
  updatedAt: '2024-02-20 18:30',
  description: 'D',
  lastThreeComments: 'C',
  lastComment: 'C',
  ...over,
});

describe('reportColumns', () => {
  it('"all" ignores filters and includes hidden and archived tasks', () => {
    const columns = reportColumns(board, { ...DEFAULT_VIEW, tag: 'nothing' }, 'all');
    expect(columns.flatMap((c) => c.tasks.map((t) => t.id))).toEqual(['1', '2', '3']);
  });

  it('"visible" follows the current filters', () => {
    const columns = reportColumns(board, { ...DEFAULT_VIEW, tag: 'ACME' }, 'visible');
    expect(columns.flatMap((c) => c.tasks.map((t) => t.id))).toEqual(['1']);
  });
});

describe('buildReportRows', () => {
  it('maps every required field', () => {
    const task = makeTask('1', { comments: [comment('a', 1), comment('b', 2), comment('c', 3), comment('d', 4)] });
    const [result] = buildReportRows([{ column: board.columns[0]!, tasks: [task] }]);
    expect(result).toEqual({
      status: 'Todo',
      tag: 'ACME',
      priority: 'high',
      name: 'name-1',
      reference: 'REF',
      nextStep: 'next',
      createdAt: '2024-01-15 09:05',
      updatedAt: '2024-02-20 18:30',
      description: 'desc',
      lastThreeComments: 'c-d\nc-c\nc-b',
      lastComment: 'c-d',
    });
  });

  it('keeps unparseable imported dates as they are', () => {
    const [result] = buildReportRows([{ column: board.columns[0]!, tasks: [makeTask('1', { createdAt: 'yesterday' })] }]);
    expect(result!.createdAt).toBe('yesterday');
  });
});

describe('toCsv', () => {
  it('has a BOM, CRLF lines and exactly the required columns', () => {
    const csv = toCsv([row()], labels);
    expect(csv.startsWith('﻿')).toBe(true);
    const [header, line] = csv.slice(1).split('\r\n');
    expect(header).toBe(
      'Status,Tag,Priority,Name,Reference,Next step,Created,Updated,Description,Last three comments',
    );
    expect(line).toBe('Todo,ACME,High,Name,R,N,2024-01-15 09:05,2024-02-20 18:30,D,C');
  });

  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv([row({ name: 'a,b', description: 'say "hi"', lastThreeComments: 'x\ny' })], labels);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain('"x\ny"');
  });

  it('neutralizes spreadsheet formulas in user text', () => {
    const csv = toCsv([row({ name: '=HYPERLINK("http://evil.test")' })], labels);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"")"`);
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '\r=1'])('neutralizes %j', (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
  });

  it('leaves ordinary text alone', () => {
    expect(neutralizeFormula('plain = text')).toBe('plain = text');
  });
});

describe('buildExcelSheet', () => {
  const sheet = buildExcelSheet([row(), row({ priority: 'critical' })], labels);

  it('has the CSV columns plus a separate last comment column', () => {
    const header = sheet[0]!.map((cell) => (cell as { value: string }).value);
    expect(header).toEqual([
      'Status',
      'Tag',
      'Priority',
      'Name',
      'Reference',
      'Next step',
      'Created',
      'Updated',
      'Description',
      'Last three comments',
      'Last comment',
    ]);
    expect(sheet[1]).toHaveLength(11);
  });

  it('colors the priority cell', () => {
    expect(sheet[1]![2]).toMatchObject({ value: 'High', backgroundColor: '#E77009' });
    expect(sheet[2]![2]).toMatchObject({ value: 'Critical', backgroundColor: '#FF5A50' });
  });

  it('truncates values beyond the Excel cell limit', () => {
    const big = buildExcelSheet([row({ description: 'x'.repeat(EXCEL_CELL_LIMIT + 10) })], labels);
    expect((big[1]![8] as { value: string }).value).toHaveLength(EXCEL_CELL_LIMIT);
  });

  it('produces one worksheet where formula-like text stays text', async () => {
    const data = buildExcelSheet([row({ name: '=1+1' })], labels);
    const buffer = await writeXlsxFile(data).toBuffer();
    const files = unzipSync(new Uint8Array(buffer));
    const worksheets = Object.keys(files).filter((name) => /worksheets\/sheet\d+\.xml$/.test(name));
    expect(worksheets).toHaveLength(1);
    const xml = strFromU8(files[worksheets[0]!]!);
    expect(xml).not.toContain('<f>');
    expect(strFromU8(files['xl/sharedStrings.xml']!)).toContain('=1+1');
    expect(strFromU8(files['xl/styles.xml']!).toUpperCase()).toContain('E77009');
  });
});
