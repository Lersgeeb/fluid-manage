import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Board, Task } from './domain/types';
import { LANGUAGE_KEY } from './i18n/I18nProvider';
import * as download from './reports/download';
import { STORAGE_KEY } from './storage/boardStorage';

const excel = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock('write-excel-file/browser', () => ({ default: excel.write }));

const makeTask = (id: string, columnId: string, order: number, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: `desc ${id}`,
  tag: 'ACME',
  tagColor: '#112233',
  priority: 'low',
  reference: '',
  columnId,
  order,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...extra,
});

const sampleBoard = (): Board => ({
  columns: [
    {
      id: 'c1',
      title: 'Uno',
      order: 0,
      tasks: [
        makeTask('alpha', 'c1', 0, { priority: 'high', tag: 'ACME' }),
        makeTask('beta', 'c1', 1, { priority: 'critical', tag: 'Globex' }),
      ],
    },
    { id: 'c2', title: 'Dos', order: 1, tasks: [] },
    { id: 'c3', title: 'Tres', order: 2, tasks: [] },
  ],
});

function renderApp(board?: Board, language = 'es') {
  localStorage.setItem(LANGUAGE_KEY, language);
  if (board) localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  return { user: userEvent.setup(), ...render(<App />) };
}

const saved = (): Board => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Board;

const flushSave = () =>
  act(() => {
    window.dispatchEvent(new Event('pagehide'));
  });

const columnNamed = (title: string) => screen.getByRole('region', { name: title });
const dialog = () => screen.getByRole('dialog');
const openTask = (user: UserEvent, title: string) => user.dblClick(screen.getByRole('button', { name: title }));
const confirmAction = async (user: UserEvent, name: string) => {
  const alert = await screen.findByRole('alertdialog');
  await user.click(within(alert).getByRole('button', { name }));
  return alert;
};
const openDataMenu = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Datos' }));
const pickOption = async (user: UserEvent, label: string, option: string) => {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(screen.getByRole('option', { name: option }));
};
const toggleView = async (user: UserEvent, label: string) => {
  await user.click(screen.getByRole('button', { name: 'Vista' }));
  await user.click(screen.getByLabelText(label));
  await user.keyboard('{Escape}');
};
const columnMenuItem = async (user: UserEvent, column: string, item: string) => {
  await user.click(screen.getByRole('button', { name: `Opciones de ${column}` }));
  await user.click(screen.getByRole('menuitem', { name: item }));
};
const summaryOf = (column: string) =>
  within(within(columnNamed(column)).getByRole('list', { name: 'Resumen' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

const jsonFile = (content: unknown) =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], 'board.json', {
    type: 'application/json',
  });

const importFile = async (user: UserEvent, file: File) => {
  await user.upload(screen.getByLabelText('Archivo JSON'), file);
};

const importAndConfirm = async (user: UserEvent, content: unknown) => {
  await importFile(user, jsonFile(content));
  await confirmAction(user, 'Reemplazar');
};

beforeEach(() => {
  excel.write.mockReset();
});

describe('startup', () => {
  it('creates the default columns in the active language', () => {
    renderApp();
    expect(screen.getByRole('region', { name: 'Pendientes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'En progreso' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Completadas' })).toBeInTheDocument();
  });

  it('uses English column names in English', () => {
    renderApp(undefined, 'en');
    expect(screen.getByRole('region', { name: 'To do' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'In progress' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Done' })).toBeInTheDocument();
  });

  it('restores a saved board from the legacy storage key', () => {
    renderApp(sampleBoard());
    expect(within(columnNamed('Uno')).getByText('alpha')).toBeInTheDocument();
  });

  it('warns and starts fresh when saved data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    renderApp();
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron leer/i);
    expect(screen.getByRole('region', { name: 'Pendientes' })).toBeInTheDocument();
  });

  it('is branded FluidManage', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'FluidManage' })).toBeInTheDocument();
  });

  it('shows the app icon next to the name, hidden from screen readers', () => {
    renderApp();
    const icon = screen.getByRole('heading', { level: 1 }).querySelector('img');
    expect(icon).toHaveAttribute('src', '/favicon.svg');
    expect(icon).toHaveAttribute('alt', '');
  });

  it('offers no presentation view', async () => {
    const { user } = renderApp({ ...sampleBoard(), presentationColumns: [] });
    await openDataMenu(user);
    expect(screen.queryByText(/presentaci[oó]n/i)).not.toBeInTheDocument();
  });
});

describe('columns', () => {
  it('creates a column', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'Añadir columna' }));
    await user.type(screen.getByLabelText('Nombre de la columna'), 'Cuatro{Enter}');
    expect(columnNamed('Cuatro')).toBeInTheDocument();
  });

  it('renames a column', async () => {
    const { user } = renderApp(sampleBoard());
    await columnMenuItem(user, 'Dos', 'Renombrar');
    const input = screen.getByLabelText('Nombre de la columna');
    await user.clear(input);
    await user.type(input, 'Segunda{Enter}');
    expect(columnNamed('Segunda')).toBeInTheDocument();
  });

  it('moves a column', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'Mover Dos a la izquierda' }));
    const names = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'));
    expect(names).toEqual(['Dos', 'Uno', 'Tres']);
  });

  it('warns that tasks are deleted along with the column', async () => {
    const { user } = renderApp(sampleBoard());
    await columnMenuItem(user, 'Uno', 'Eliminar columna');
    const alert = await screen.findByRole('alertdialog');
    expect(alert).toHaveTextContent('2 tareas');
    await user.click(within(alert).getByRole('button', { name: 'Cancelar' }));
    expect(columnNamed('Uno')).toBeInTheDocument();

    await columnMenuItem(user, 'Uno', 'Eliminar columna');
    await confirmAction(user, 'Eliminar');
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Uno' })).not.toBeInTheDocument());
  });
});

describe('tasks', () => {
  it('requires title and tag', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'Añadir tarea en Dos' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Crear' }));
    expect(within(dialog()).getByText('El título es obligatorio')).toBeInTheDocument();
    expect(within(dialog()).getByText('La etiqueta es obligatoria')).toBeInTheDocument();
    expect(within(columnNamed('Dos')).queryByRole('article')).not.toBeInTheDocument();
  });

  it('creates a task with all its fields and no length limits', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'Añadir tarea en Dos' }));
    const form = within(dialog());
    expect(form.getByLabelText(/Título/)).not.toHaveAttribute('maxlength');
    await user.type(form.getByLabelText(/Título/), 'Nueva');
    await user.type(form.getByLabelText('Descripción'), 'Detalle');
    await user.type(form.getByLabelText(/^Etiqueta/), 'Cliente');
    await user.selectOptions(form.getByLabelText('Prioridad'), 'high');
    await user.type(form.getByLabelText('Referencia'), 'REF-9');
    await user.click(form.getByRole('button', { name: 'Crear' }));

    const card = within(columnNamed('Dos'));
    expect(card.getByText('Nueva')).toBeInTheDocument();
    expect(card.getByText('Cliente')).toBeInTheDocument();
    await flushSave();
    expect(saved().columns[1]!.tasks[0]).toMatchObject({
      title: 'Nueva',
      description: 'Detalle',
      tag: 'Cliente',
      priority: 'high',
      reference: 'REF-9',
      columnId: 'c2',
      order: 0,
    });
  });

  it.each([
    ['Rojo', '#f87171'],
    ['Naranja', '#fb923c'],
    ['Ámbar', '#fbbf24'],
    ['Lima', '#a3e635'],
    ['Esmeralda', '#34d399'],
    ['Cian', '#22d3ee'],
    ['Azul', '#60a5fa'],
    ['Índigo', '#818cf8'],
    ['Violeta', '#a78bfa'],
    ['Fucsia', '#e879f9'],
  ])('offers %s (%s) as a preset tag color', async (name, color) => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'Añadir tarea en Dos' }));
    const form = within(dialog());
    const swatch = form.getByRole('button', { name });
    expect(swatch).toHaveAttribute('aria-pressed', 'false');
    await user.click(swatch);
    expect(swatch).toHaveAttribute('aria-pressed', 'true');
    expect(form.getByLabelText('Color de etiqueta')).toHaveValue(color);
  });

  it('saves the chosen preset and still allows a custom color', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'Añadir tarea en Dos' }));
    const form = within(dialog());
    await user.type(form.getByLabelText(/Título/), 'Con color');
    await user.type(form.getByLabelText(/^Etiqueta/), 'Cliente');
    await user.click(form.getByRole('button', { name: 'Esmeralda' }));
    expect(screen.getByLabelText('Color de etiqueta')).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Crear' }));
    await flushSave();
    expect(saved().columns[1]!.tasks[0]!.tagColor).toBe('#34d399');
  });

  it('marks the preset matching an existing color, ignoring case', async () => {
    const board = sampleBoard();
    board.columns[0]!.tasks[0]!.tagColor = '#60A5FA';
    const { user } = renderApp(board);
    await openTask(user, 'alpha');
    await user.click(within(dialog()).getByRole('button', { name: 'Editar resumen' }));
    expect(within(dialog()).getByRole('button', { name: 'Azul' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows and edits a task, updating its modification date', async () => {
    const { user } = renderApp(sampleBoard());
    await openTask(user, 'alpha');
    const form = within(dialog());
    await user.click(form.getByRole('button', { name: 'Editar resumen' }));
    const title = form.getByLabelText(/Título/);
    expect(title).toHaveValue('alpha');
    await user.clear(title);
    await user.type(title, 'alpha editada');
    await user.click(form.getByRole('button', { name: 'Guardar resumen' }));
    expect(screen.getByRole('button', { name: 'alpha editada' })).toBeInTheDocument();
    expect(form.queryByLabelText(/Título/)).not.toBeInTheDocument();
    await flushSave();
    expect(saved().columns[0]!.tasks[0]!.updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
  });

  it('deletes a task only after confirmation', async () => {
    const { user } = renderApp(sampleBoard());
    await openTask(user, 'alpha');
    await user.click(within(dialog()).getByRole('button', { name: 'Eliminar tarea' }));
    const alert = await confirmAction(user, 'Eliminar');
    expect(alert).toHaveTextContent('alpha');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'alpha' })).not.toBeInTheDocument());
  });

  it('hides tasks and reveals them with the toggle', async () => {
    const { user } = renderApp(sampleBoard());
    await openTask(user, 'alpha');
    await user.click(within(dialog()).getByRole('button', { name: 'Ocultar' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('button', { name: 'alpha' })).not.toBeInTheDocument();
    await toggleView(user, 'Mostrar ocultas');
    expect(screen.getByRole('button', { name: 'alpha' })).toBeInTheDocument();
  });

  it('renders imported text inertly', () => {
    const board = sampleBoard();
    board.columns[0]!.tasks[0]!.title = '<img src=x onerror=alert(1)>';
    board.columns[0]!.tasks[0]!.tagColor = 'url(https://evil.test/x)';
    const { container } = renderApp(board);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img[src="x"], img[onerror]')).toBeNull();
    expect(container.innerHTML).not.toContain('evil.test');
  });
});

describe('archive', () => {
  it('archives into an automatically created column and restores', async () => {
    const { user } = renderApp(sampleBoard());
    expect(screen.queryByRole('region', { name: 'Archivo' })).not.toBeInTheDocument();

    await openTask(user, 'alpha');
    await user.click(within(dialog()).getByRole('button', { name: 'Archivar' }));
    expect(screen.queryByRole('button', { name: 'alpha' })).not.toBeInTheDocument();

    await toggleView(user, 'Mostrar archivo');
    const archive = columnNamed('Archivo');
    expect(within(archive).getByText('alpha')).toBeInTheDocument();
    expect(within(archive).queryByRole('button', { name: /^Mover/ })).not.toBeInTheDocument();
    expect(within(archive).queryByRole('button', { name: /^Añadir tarea/ })).not.toBeInTheDocument();
    await user.click(within(archive).getByRole('button', { name: 'Opciones de Archivo' }));
    expect(screen.getByRole('menuitem', { name: 'Renombrar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Eliminar columna' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await flushSave();
    expect(saved().columns.at(-1)!.tasks[0]).toMatchObject({ archivedFromColumnId: 'c1' });

    await openTask(user, 'alpha');
    await user.click(within(dialog()).getByRole('button', { name: 'Restaurar' }));
    expect(within(columnNamed('Uno')).getByText('alpha')).toBeInTheDocument();
    await flushSave();
    expect(saved().columns[0]!.tasks.find((t) => t.id === 'alpha')).not.toHaveProperty('archivedAt');
  });
});

describe('next step and comments', () => {
  it('completing a next step clears it and logs a comment', async () => {
    const { user } = renderApp(sampleBoard());
    await openTask(user, 'alpha');
    const form = within(dialog());
    await user.click(form.getByRole('button', { name: 'Editar próximo paso' }));
    await user.type(form.getByLabelText('Próximo paso'), 'Llamar');
    await user.click(form.getByRole('button', { name: 'Guardar paso' }));
    expect(form.getByText('Llamar')).toBeInTheDocument();
    await user.click(form.getByRole('button', { name: 'Completar paso' }));
    expect(form.getByText('Sin próximo paso')).toBeInTheDocument();
    expect(form.getByText('Paso completado: Llamar')).toBeInTheDocument();
  });

  it('cannot complete a step while it is being edited', async () => {
    const board = sampleBoard();
    board.columns[0]!.tasks[0]!.nextStep = 'Llamar';
    const { user } = renderApp(board);
    await openTask(user, 'alpha');
    const form = within(dialog());
    expect(form.getByRole('button', { name: 'Completar paso' })).toBeEnabled();
    await user.click(form.getByRole('button', { name: 'Editar próximo paso' }));
    expect(form.getByRole('button', { name: 'Completar paso' })).toBeDisabled();
  });

  it('keeps keyboard focus inside the dialog after saving or completing', async () => {
    const { user } = renderApp(sampleBoard());
    await openTask(user, 'alpha');
    const form = within(dialog());
    await user.click(form.getByRole('button', { name: 'Editar próximo paso' }));
    expect(form.getByLabelText('Próximo paso')).toHaveFocus();
    await user.type(form.getByLabelText('Próximo paso'), 'Llamar');
    await user.click(form.getByRole('button', { name: 'Guardar paso' }));
    expect(form.getByRole('button', { name: 'Editar próximo paso' })).toHaveFocus();
    await user.click(form.getByRole('button', { name: 'Completar paso' }));
    expect(form.getByRole('button', { name: 'Editar próximo paso' })).toHaveFocus();
    await user.type(form.getByLabelText('Nuevo comentario'), 'Hola');
    await user.click(form.getByRole('button', { name: 'Añadir comentario' }));
    expect(form.getByLabelText('Nuevo comentario')).toHaveFocus();
  });

  it('offers restore for tasks in any archive column of an imported file', async () => {
    const board = sampleBoard();
    board.columns.push(
      { id: 'a1', title: 'Archivo 1', order: 3, isArchive: true, tasks: [] },
      { id: 'a2', title: 'Archivo 2', order: 4, isArchive: true, tasks: [makeTask('gamma', 'a2', 0)] },
    );
    const { user } = renderApp(board);
    await toggleView(user, 'Mostrar archivo');
    await openTask(user, 'gamma');
    expect(within(dialog()).getByRole('button', { name: 'Restaurar' })).toBeInTheDocument();
  });

  it('adds, edits and deletes comments', async () => {
    const { user } = renderApp(sampleBoard());
    await openTask(user, 'alpha');
    const form = within(dialog());
    await user.type(form.getByLabelText('Nuevo comentario'), 'Hola');
    await user.click(form.getByRole('button', { name: 'Añadir comentario' }));
    expect(form.getByText('Hola')).toBeInTheDocument();

    await user.click(form.getByRole('button', { name: 'Editar comentario' }));
    const editor = form.getByLabelText('Editar texto del comentario');
    await user.clear(editor);
    await user.type(editor, 'Adiós');
    await user.click(form.getByRole('button', { name: 'Guardar comentario' }));
    expect(form.getByText('Adiós')).toBeInTheDocument();

    await user.click(form.getByRole('button', { name: 'Eliminar comentario' }));
    await confirmAction(user, 'Eliminar');
    await waitFor(() => expect(form.queryByText('Adiós')).not.toBeInTheDocument());
  });
});

describe('filter colors', () => {
  const dotOf = (option: string) =>
    screen.getByRole('option', { name: option }).querySelector<HTMLElement>('[data-testid="option-dot"]');

  it('shows each tag with its color', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('combobox', { name: 'Filtrar por etiqueta' }));
    expect(dotOf('Todas')).toBeNull();
    expect(dotOf('ACME')!.style.backgroundColor).toBe('rgb(17, 34, 51)');
  });

  it('shows each priority with its color', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('combobox', { name: 'Filtrar por prioridad' }));
    expect(dotOf('Alta')!.style.backgroundColor).toBe('rgb(231, 112, 9)');
    expect(dotOf('Crítica')!.style.backgroundColor).toBe('rgb(255, 90, 80)');
  });

  it('never renders an unsafe imported color', async () => {
    const board = sampleBoard();
    board.columns[0]!.tasks[0]!.tagColor = 'url(https://evil.test/x)';
    const { user, container } = renderApp(board);
    await user.click(screen.getByRole('combobox', { name: 'Filtrar por etiqueta' }));
    expect(dotOf('ACME')).not.toBeNull();
    expect(container.innerHTML).not.toContain('evil.test');
  });
});

describe('task detail', () => {
  const detailBoard = () => {
    const board = sampleBoard();
    Object.assign(board.columns[0]!.tasks[0]!, {
      description: 'Detalle original',
      reference: '#47977',
      nextStep: 'Paso pendiente',
      comments: [
        { id: 'k1', text: 'Comentario antiguo', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: 'k2', text: 'Comentario nuevo', createdAt: '2024-02-01T00:00:00.000Z', updatedAt: '2024-02-01T00:00:00.000Z' },
      ],
    });
    return board;
  };

  it('opens in read mode with every value visible', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const detail = within(dialog());
    expect(detail.getByText('Detalle original')).toBeInTheDocument();
    expect(detail.getByText('Paso pendiente')).toBeInTheDocument();
    expect(detail.getByText('Alta')).toBeInTheDocument();
    expect(detail.getByText('ACME')).toBeInTheDocument();
    expect(detail.getByText(/#47977/)).toBeInTheDocument();
    expect(detail.getByText(/^Creada:/)).toBeInTheDocument();
    expect(detail.getByText(/^Modificada:/)).toBeInTheDocument();
    expect(detail.queryByRole('textbox')).toBe(detail.queryByLabelText('Nuevo comentario'));
  });

  it('lists comments newest first', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const items = within(within(dialog()).getByRole('list')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Comentario nuevo');
    expect(items[1]).toHaveTextContent('Comentario antiguo');
  });

  it('reverses the comment order with the arrow and back', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const detail = within(dialog());
    const texts = () => within(detail.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent);

    await user.click(detail.getByRole('button', { name: 'Mostrar primero los más antiguos' }));
    expect(texts()[0]).toContain('Comentario antiguo');
    expect(detail.getByRole('button', { name: 'Mostrar primero los más recientes' })).toHaveFocus();

    await user.click(detail.getByRole('button', { name: 'Mostrar primero los más recientes' }));
    expect(texts()[0]).toContain('Comentario nuevo');
  });

  it('edits the description in place and stays open', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const detail = within(dialog());
    await user.click(detail.getByRole('button', { name: 'Editar descripción' }));
    const field = detail.getByLabelText('Descripción');
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, 'Detalle nuevo');
    await user.click(detail.getByRole('button', { name: 'Guardar descripción' }));
    expect(detail.getByText('Detalle nuevo')).toBeInTheDocument();
    expect(detail.getByRole('button', { name: 'Editar descripción' })).toHaveFocus();
    await flushSave();
    expect(saved().columns[0]!.tasks[0]).toMatchObject({ description: 'Detalle nuevo', title: 'alpha' });
  });

  it('does not touch the modification date when nothing changed', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const detail = within(dialog());
    await user.click(detail.getByRole('button', { name: 'Editar descripción' }));
    await user.click(detail.getByRole('button', { name: 'Guardar descripción' }));
    await user.click(detail.getByRole('button', { name: 'Editar próximo paso' }));
    await user.click(detail.getByRole('button', { name: 'Guardar paso' }));
    await flushSave();
    expect(saved().columns[0]!.tasks[0]!.updatedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('discards an edit with Cancel', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const detail = within(dialog());
    await user.click(detail.getByRole('button', { name: 'Editar descripción' }));
    await user.type(detail.getByLabelText('Descripción'), ' cambiada');
    await user.click(detail.getByRole('button', { name: 'Cancelar' }));
    expect(detail.getByText('Detalle original')).toBeInTheDocument();
    expect(detail.queryByLabelText('Descripción')).not.toBeInTheDocument();
  });

  it('discards an edit with Escape, keeping the dialog open', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const detail = within(dialog());
    await user.click(detail.getByRole('button', { name: 'Editar próximo paso' }));
    await user.type(detail.getByLabelText('Próximo paso'), ' cambiado{Escape}');
    expect(detail.getByText('Paso pendiente')).toBeInTheDocument();
    expect(detail.getByRole('button', { name: 'Editar próximo paso' })).toHaveFocus();
  });

  it('requires title and tag when editing the summary', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const detail = within(dialog());
    await user.click(detail.getByRole('button', { name: 'Editar resumen' }));
    await user.clear(detail.getByLabelText(/Título/));
    await user.click(detail.getByRole('button', { name: 'Guardar resumen' }));
    expect(detail.getByText('El título es obligatorio')).toBeInTheDocument();
    expect(detail.getByLabelText(/Título/)).toBeInTheDocument();
  });

  it('does not overwrite a description saved while the summary is open', async () => {
    const { user } = renderApp(detailBoard());
    await openTask(user, 'alpha');
    const detail = within(dialog());
    await user.click(detail.getByRole('button', { name: 'Editar resumen' }));
    await user.click(detail.getByRole('button', { name: 'Editar descripción' }));
    await user.type(detail.getByLabelText('Descripción'), ' ampliado');
    await user.click(detail.getByRole('button', { name: 'Guardar descripción' }));
    await user.click(detail.getByRole('button', { name: 'Guardar resumen' }));
    await flushSave();
    expect(saved().columns[0]!.tasks[0]!.description).toBe('Detalle original ampliado');
  });
});

describe('opening a task', () => {
  it('does not open on a single click', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'alpha' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on a double click anywhere on the card', async () => {
    const { user } = renderApp(sampleBoard());
    await user.dblClick(screen.getByText('desc alpha'));
    expect(within(dialog()).getByRole('heading', { level: 2, name: 'alpha' })).toBeInTheDocument();
  });

  it('still opens from the keyboard', async () => {
    const { user } = renderApp(sampleBoard());
    screen.getByRole('button', { name: 'alpha' }).focus();
    await user.keyboard('{Enter}');
    expect(within(dialog()).getByRole('heading', { level: 2, name: 'alpha' })).toBeInTheDocument();
  });

  it('opens with a single tap on devices without a mouse', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(hover: none)' }));
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'alpha' }));
    expect(within(dialog()).getByRole('heading', { level: 2, name: 'alpha' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('marks cards as draggable only in manual order', async () => {
    const { user } = renderApp(sampleBoard());
    expect(screen.getByRole('article', { name: 'alpha' })).toHaveClass('card--draggable');
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'priority');
    expect(screen.getByRole('article', { name: 'alpha' })).not.toHaveClass('card--draggable');
  });
});

describe('board layout', () => {
  it('shows the reference on the card', () => {
    const board = sampleBoard();
    board.columns[0]!.tasks[0]!.reference = '#47977';
    renderApp(board);
    expect(within(columnNamed('Uno')).getByText('#47977')).toBeInTheDocument();
  });

  it('summarizes each column by priority', () => {
    renderApp(sampleBoard());
    expect(summaryOf('Uno')).toEqual(['Baja: 0', 'Media: 0', 'Alta: 1', 'Crítica: 1']);
    expect(summaryOf('Dos')).toEqual(['Baja: 0', 'Media: 0', 'Alta: 0', 'Crítica: 0']);
  });

  it('keeps the summary in step with the active filters', async () => {
    const { user } = renderApp(sampleBoard());
    await pickOption(user, 'Filtrar por etiqueta', 'Globex');
    expect(summaryOf('Uno')).toEqual(['Baja: 0', 'Media: 0', 'Alta: 0', 'Crítica: 1']);
  });

  it('returns focus to the trigger when a menu closes with Escape', async () => {
    const { user } = renderApp(sampleBoard());
    const trigger = screen.getByRole('button', { name: 'Opciones de Dos' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes a menu when clicking elsewhere', async () => {
    const { user } = renderApp(sampleBoard());
    await user.click(screen.getByRole('button', { name: 'Opciones de Dos' }));
    await user.click(columnNamed('Tres'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('filters and display', () => {
  it('filters by tag and priority', async () => {
    const { user } = renderApp(sampleBoard());
    await pickOption(user, 'Filtrar por etiqueta', 'Globex');
    expect(screen.queryByRole('button', { name: 'alpha' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'beta' })).toBeInTheDocument();
    await pickOption(user, 'Filtrar por prioridad', 'Alta');
    expect(screen.queryByRole('button', { name: 'beta' })).not.toBeInTheDocument();
  });

  it('sorts by priority in both directions', async () => {
    const { user } = renderApp(sampleBoard());
    const order = () => within(columnNamed('Uno')).getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(order()).toEqual(['alpha', 'beta']);
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'priority');
    expect(order()).toEqual(['alpha', 'beta']);
    await user.selectOptions(screen.getByLabelText('Dirección'), 'desc');
    expect(order()).toEqual(['beta', 'alpha']);
  });

  it('disables dragging outside manual order', async () => {
    const { user } = renderApp(sampleBoard());
    expect(screen.getAllByRole('button', { name: /^Arrastrar/ })).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'priority');
    expect(screen.queryByRole('button', { name: /^Arrastrar/ })).not.toBeInTheDocument();
  });

  it('selects the card text', async () => {
    const board = sampleBoard();
    board.columns[0]!.tasks[0]!.nextStep = 'siguiente paso';
    const { user } = renderApp(board);
    expect(screen.getByText('desc alpha')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Texto en tarjetas'), 'nextStep');
    expect(screen.queryByText('desc alpha')).not.toBeInTheDocument();
    expect(screen.getByText('siguiente paso')).toBeInTheDocument();
  });

  it('switches language and theme, remembering them', async () => {
    const { user, unmount } = renderApp(sampleBoard());
    await user.selectOptions(screen.getByLabelText('Idioma'), 'en');
    expect(screen.getByRole('button', { name: 'Add column' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');

    const before = document.documentElement.dataset.theme;
    await user.click(screen.getByRole('button', { name: /Switch to (dark|light) theme/ }));
    const after = document.documentElement.dataset.theme;
    expect(after).not.toBe(before);

    unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Add column' })).toBeInTheDocument();
  });
});

describe('JSON import and export', () => {
  it('replaces the board after confirmation and keeps presentation data', async () => {
    const { user } = renderApp(sampleBoard());
    const incoming = {
      columns: [{ id: 'n', title: 'Importada', order: 0, tasks: [makeTask('gamma', 'n', 0)] }],
      presentationColumns: [{ id: 'p', title: 'Slide', tasks: [], order: 0 }],
    };
    await importAndConfirm(user, incoming);
    expect(await screen.findByRole('region', { name: 'Importada' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Uno' })).not.toBeInTheDocument();
    expect(saved()).toEqual(incoming);
  });

  it('shows legacy client data as tag and color', async () => {
    const { user, container } = renderApp(sampleBoard());
    const legacy = makeTask('old', 'n', 0, { client: 'Cliente Viejo', clientColor: '#abcdef' } as Partial<Task>) as unknown as Record<string, unknown>;
    delete legacy.tag;
    delete legacy.tagColor;
    await importAndConfirm(user, { columns: [{ id: 'n', title: 'L', order: 0, tasks: [legacy] }] });
    const column = await screen.findByRole('region', { name: 'L' });
    expect(within(column).getByText('Cliente Viejo')).toBeInTheDocument();
    const dot = container.querySelector<HTMLElement>('[data-testid="tag-dot"]')!;
    expect(dot.style.backgroundColor).toBe('rgb(171, 205, 239)');
  });

  it('reports an invalid file and keeps the current board', async () => {
    const { user } = renderApp(sampleBoard());
    await importFile(user, jsonFile('{"columns": 3}'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no es válido/i);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(columnNamed('Uno')).toBeInTheDocument();
  });

  it('exports the whole board as importable JSON', async () => {
    const spy = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const board = { ...sampleBoard(), presentationColumns: [] };
    const { user } = renderApp(board);
    await openDataMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Exportar JSON' }));
    expect(spy).toHaveBeenCalledOnce();
    const [blob, name] = spy.mock.calls[0]!;
    expect(name).toMatch(/^fluidmanage-.*\.json$/);
    expect(JSON.parse(await blob.text())).toEqual(board);
  });
});

describe('reports', () => {
  it('exports filtered tasks to CSV', async () => {
    const spy = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = renderApp(sampleBoard());
    await pickOption(user, 'Filtrar por etiqueta', 'Globex');
    await openDataMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'CSV: tareas visibles' }));
    const text = await spy.mock.calls[0]![0].text();
    expect(text).toContain('beta');
    expect(text).not.toContain('alpha');
    expect(text).toContain('Estado');
  });

  it('exports all tasks to CSV regardless of filters', async () => {
    const spy = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = renderApp(sampleBoard());
    await pickOption(user, 'Filtrar por etiqueta', 'Globex');
    await openDataMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'CSV: todas las tareas' }));
    const text = await spy.mock.calls[0]![0].text();
    expect(text).toContain('alpha');
    expect(text).toContain('beta');
  });

  it('exports to Excel, loading the library on demand', async () => {
    const blob = new Blob(['x']);
    excel.write.mockReturnValue({ toBlob: () => Promise.resolve(blob) });
    const spy = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = renderApp(sampleBoard());
    await openDataMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Excel: todas las tareas' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(blob, expect.stringMatching(/\.xlsx$/)));
    expect(excel.write.mock.calls[0]![0]).toHaveLength(3);
  });

  it('reports an export failure', async () => {
    excel.write.mockReturnValue({ toBlob: () => Promise.reject(new Error('boom')) });
    const { user } = renderApp(sampleBoard());
    await openDataMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Excel: tareas visibles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo exportar/i);
  });
});

describe('local persistence', () => {
  it('survives a reload', async () => {
    const { user, unmount } = renderApp(sampleBoard());
    await columnMenuItem(user, 'Dos', 'Renombrar');
    await user.type(screen.getByLabelText('Nombre de la columna'), 'X{Enter}');
    await flushSave();
    unmount();
    render(<App />);
    expect(columnNamed('DosX')).toBeInTheDocument();
  });

  it('reports a failed save', async () => {
    const { user } = renderApp(sampleBoard());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await user.click(screen.getByRole('button', { name: 'Mover Dos a la izquierda' }));
    await flushSave();
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo guardar/i);
  });

  it('clears the local board after confirmation', async () => {
    const { user } = renderApp(sampleBoard());
    await openDataMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Borrar tablero local' }));
    await confirmAction(user, 'Borrar');
    expect(await screen.findByRole('region', { name: 'Pendientes' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Uno' })).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('picks up changes from another tab', async () => {
    renderApp(sampleBoard());
    const other = { columns: [{ id: 'o', title: 'Otra pestaña', order: 0, tasks: [] }] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(other));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });
    expect(columnNamed('Otra pestaña')).toBeInTheDocument();
  });
});
