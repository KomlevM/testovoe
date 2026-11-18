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