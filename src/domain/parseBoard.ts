import { DEFAULT_TAG_COLOR, isPriority } from './constants';
import type { Board, Column, Task } from './types';

export class BoardFormatError extends Error {
  override name = 'BoardFormatError';
}

type Json = Record<string, unknown>;

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptional = (value: unknown, type: 'string' | 'boolean') => value === undefined || typeof value === type;

function fail(message: string): never {
  throw new BoardFormatError(message);
}

function requireFields(source: Json, label: string, fields: Record<string, 'string' | 'number'>) {
  for (const [field, type] of Object.entries(fields)) {
    const value = source[field];
    const valid = type === 'number' ? Number.isFinite(value) : typeof value === 'string';
    if (!valid) fail(`${label}: invalid or missing "${field}"`);
  }
}

function assertUnique(ids: Set<string>, id: string, label: string) {
  if (ids.has(id)) fail(`Duplicate ${label} id "${id}"`);
  ids.add(id);
}

function validateComments(comments: unknown, label: string) {
  if (comments === undefined) return;
  if (!Array.isArray(comments)) fail(`${label}: "comments" must be an array`);
  const ids = new Set<string>();
  for (const comment of comments) {
    if (!isObject(comment)) fail(`${label}: malformed comment`);
    requireFields(comment, `${label} comment`, {
      id: 'string',
      text: 'string',
      createdAt: 'string',
      updatedAt: 'string',
    });
    assertUnique(ids, comment.id as string, 'comment');
  }
}

function textOr(value: unknown, legacy: unknown, fallback: string, label: string, field: string): string {
  if (value !== undefined && typeof value !== 'string') fail(`${label}: "${field}" must be a string`);
  if (typeof value === 'string') return value;
  return typeof legacy === 'string' ? legacy : fallback;
}

function parseTask(raw: unknown, seen: Set<string>): Task {
  if (!isObject(raw)) fail('Malformed task');
  requireFields(raw, 'Task', {
    id: 'string',
    title: 'string',
    columnId: 'string',
    order: 'number',
    createdAt: 'string',
    updatedAt: 'string',
  });
  const label = `Task "${raw.id as string}"`;
  assertUnique(seen, raw.id as string, 'task');

  for (const field of ['nextStep', 'archivedFromColumnId', 'archivedAt']) {
    if (!isOptional(raw[field], 'string')) fail(`${label}: "${field}" must be a string`);
  }
  if (!isOptional(raw.hidden, 'boolean')) fail(`${label}: "hidden" must be a boolean`);
  validateComments(raw.comments, label);

  const { client, clientColor, ...rest } = raw;
  return {
    ...rest,
    description: textOr(raw.description, undefined, '', label, 'description'),
    reference: textOr(raw.reference, undefined, '', label, 'reference'),
    tag: textOr(raw.tag, client, '', label, 'tag'),
    tagColor: textOr(raw.tagColor, clientColor, DEFAULT_TAG_COLOR, label, 'tagColor'),
    priority: isPriority(raw.priority) ? raw.priority : 'low',
  } as Task;
}

function parseColumn(raw: unknown, seenColumns: Set<string>, seenTasks: Set<string>): Column {
  if (!isObject(raw)) fail('Malformed column');
  requireFields(raw, 'Column', { id: 'string', title: 'string', order: 'number' });
  assertUnique(seenColumns, raw.id as string, 'column');
  if (!Array.isArray(raw.tasks)) fail(`Column "${raw.id as string}": "tasks" must be an array`);
  if (!isOptional(raw.isArchive, 'boolean')) fail(`Column "${raw.id as string}": "isArchive" must be a boolean`);
  return { ...raw, tasks: raw.tasks.map((task) => parseTask(task, seenTasks)) } as Column;
}

/**
 * Parses and validates board JSON from an untrusted source.
 *
 * Throws {@link BoardFormatError} without side effects, so callers can keep
 * the current board. Unknown fields are kept: dropping them would make the
 * migration lossy.
 */
export function parseBoard(text: string): Board {
  let data: unknown;
  try {
    data = JSON.parse(text, (key, value: unknown) => (UNSAFE_KEYS.has(key) ? undefined : value));
  } catch {
    fail('The file is not valid JSON');
  }
  if (!isObject(data)) fail('The root must be a board object');
  if (!Array.isArray(data.columns)) fail('"columns" must be an array');
  if (data.presentationColumns !== undefined && !Array.isArray(data.presentationColumns)) {
    fail('"presentationColumns" must be an array');
  }
  const seenColumns = new Set<string>();
  const seenTasks = new Set<string>();
  return {
    ...data,
    columns: data.columns.map((column) => parseColumn(column, seenColumns, seenTasks)),
  } as Board;
}
