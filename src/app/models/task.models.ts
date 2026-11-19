export type DateLike = string | number | null | undefined;

export interface TaskRaw {
  id: string | number;
  key?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  project?: string | null;
  assignee?: string | null;
  created?: DateLike;
  due?: DateLike;
  deadline?: DateLike;
  tags?: string[] | null;
  private?: boolean;
  [key: string]: unknown;
}

export interface TasksResponse {
  items: TaskRaw[];
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface Filters {
  statuses: string[];       // сырые значения
  priorities: string[];
  projects: string[];
  assignees: string[];      // может содержать sentinel '__none__'
  tags: string[];
  showArchived: boolean;
}

export const EMPTY_FILTERS: Filters = {
  statuses: [],
  priorities: [],
  projects: [],
  assignees: [],
  tags: [],
  showArchived: false,
};

export const NO_ASSIGNEE = '__none__';
export const NO_STATUS = '__none_status__';
export const NO_PROJECT = '__none_project__';