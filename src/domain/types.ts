export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
  priority: Priority;
  reference: string;
  nextStep?: string;
  archivedFromColumnId?: string;
  archivedAt?: string;
  hidden?: boolean;
  columnId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
  order: number;
  isArchive?: boolean;
}

export interface Board {
  columns: Column[];
  /** Out of scope in the UI; carried through untouched so migrations lose nothing. */
  presentationColumns?: Column[];
}

export type TaskInput = Pick<Task, 'title' | 'description' | 'tag' | 'tagColor' | 'priority' | 'reference'>;

/** Non-deterministic inputs, injected so board operations stay pure. */
export interface OperationContext {
  id: () => string;
  now: () => string;
}
