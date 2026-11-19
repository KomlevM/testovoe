// models/task.models.ts

// ---------- Транспорт: что реально отдаёт бэк ----------

export type TaskStatusCanon =
  | 'NEW' | 'IN_PROGRESS' | 'CODE_REVIEW' | 'BLOCKED' | 'HOLD' | 'DONE';

/** Бэк отдаёт канон, "Неизвестно" (было, но не распозналось) или null (поля не было). */
export type StatusValue = TaskStatusCanon | 'Неизвестно' | null;
export type PriorityValue = 'P0' | 'P1' | 'P2' | 'P3' | 'Неизвестно' | null;

/** Даты в TaskDto — строки "dd.mm.yyyy HH:MM" (UTC), либо "Неизвестно", либо null. */
export type DtoDate = string | null;

export interface TaskCommentDto {
  author: string | null;   // null | "Неизвестно" | канон
  created: DtoDate;        // "dd.mm.yyyy HH:MM" | null
  text: string;
}

export interface TaskDto {
  id: number;
  key: string;
  source: string;
  title: string | null;
  description: string | null;
  status: StatusValue;
  priority: PriorityValue;
  project: string | null;
  assignee: string | null;
  assignee_active: boolean | null;

  created: DtoDate;          // "dd.mm.yyyy HH:MM" | "Неизвестно" | null
  due: DtoDate;
  updated: DtoDate;
  completed: DtoDate;

  createdUTC: string | null;   // ISO-8601 UTC, напр. "2026-10-03T18:17:00Z"
  dueUTC: string | null;
  updatedUTC: string | null;
  completedUTC: string | null;
  archived: boolean;

  tags: string[];
  estimate: number | 'Неизвестно' | null;
  estimate_raw: unknown;
  comments: TaskCommentDto[];
  all_data: [key: any];
}

/** meta.filters — фактически применённые фильтры после нормализации бэком. */
export interface AppliedFilters {
  status?: string | string[];
  priority?: string | string[];
  project?: string | string[];
  assignee?: string | string[];
  tag?: string | string[];
  archived?: boolean;
  due_within_days?: number;
  [key: string]: unknown;
}

export interface TasksMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  filters: AppliedFilters;
  sort: { field: string; dir: 'asc' | 'desc' } | null;
}

export interface TasksResponse {
  data: TaskDto[];
  items: TaskDto[];
  meta: TasksMeta;
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

// ---------- Запрос: что уходит в POST /api/v2/tasks ----------

export type SortField = 'created' | 'due' | 'estimate';
export type SortDir = 'asc' | 'desc';

export interface TasksFiltersPayload {
  status?: string | string[];
  priority?: string | string[];
  project?: string | string[];
  assignee?: string | string[];
  tag?: string | string[];
  archived?: boolean | 'true' | 'false' | '1' | '0' | 'yes' | 'y';
  due_within_days?: number;
}

export interface TasksQuery {
  page: number;
  limit: number;
  filters?: TasksFiltersPayload;
  sort?: { field: SortField; dir: SortDir } | SortField;
  dir?: SortDir;
}

// ---------- GET /api/v2/filters ----------

export interface FilterOption {
  id: string | number;
  label: string;
  special?: boolean;   // "Неизвестно"
  unknown?: boolean;   // сырое значение, которое не сматчилось
}

export interface FiltersResponse {
  statuses: FilterOption[];
  priorities: FilterOption[];
  projects: FilterOption[];
  assignees: FilterOption[];
  tags: FilterOption[];
  unknown: {
    status: string[];
    priority: string[];
    assignee: string[];
    project: string[];
  };
  archived: {
    values: boolean[];
    labels: Record<'false' | 'true', string>;
  };
  due_within_days: {
    min: number;
    max: number;
    default: number;
    unit: 'days';
  };
  sort: {
    fields: { id: string; label: string }[];
    directions: { id: string; label: string }[];
  };
}

// ---------- Доменная модель для UI ----------

export type Urgency = 'overdue' | 'soon' | 'no-due' | 'ok';

/**
 * TaskView — то, что нужно шаблону. Отличия от TaskDto:
 * - даты распарсены в Date | null (UTC-строка "dd.mm.yyyy HH:MM");
 * - сохранено различие null vs "Неизвестно" через isUnknown*;
 * - вычислены флаги срочности и расхождений дат;
 * - all_data не тащим целиком (только uuid при необходимости).
 */
export interface TaskView {
  id: number;
  key: string;
  source: string;

  title: string;
  description: string;

  status: StatusValue;
  statusLabel: string;
  statusTone: StatusTone;

  priority: PriorityValue;
  priorityLabel: string;

  project: string | null;
  assignee: string | null;
  assignee_active: boolean | null;
  archived: boolean;

  // для рендера — строки как пришли с сервера (UTC не сдвигается пайпом)
  created: DtoDate;
  due: DtoDate;
  updated: DtoDate;
  completed: DtoDate;

  // для вычислений — из *UTC полей. null, если сервер отдал null.
  createdUtc: Date | null;
  dueUtc: Date | null;
  updatedUtc: Date | null;
  completedUtc: Date | null;

  estimate: number | null;
  tags: string[];
  comments: TaskCommentDto[];

  dueBeforeCreated: boolean;
  dueFarFuture: boolean;

  all_data: [key: any]
}

export type StatusTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

export const STATUS_LABELS: Record<TaskStatusCanon, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  CODE_REVIEW: 'На ревью',
  BLOCKED: 'Заблокирована',
  HOLD: 'Приостановлена',
  DONE: 'Готово',
};

export const STATUS_TONES: Record<TaskStatusCanon, StatusTone> = {
  NEW: 'neutral',
  IN_PROGRESS: 'info',
  CODE_REVIEW: 'info',
  BLOCKED: 'danger',
  HOLD: 'warning',
  DONE: 'success',
};

export const NO_STATUS = '__no_status__' as const;
export const NO_ASSIGNEE = '__no_assignee__' as const;
export const NO_PROJECT = '__no_project__' as const;

export interface SummaryResponse {
  total: number;
  overdue: number;
  no_assignee: number;
  unknown_data: number;
  no_due: number;
  no_priority: number;
  is_due_date_error: number;
  due_soon: number;
  due_within_days: number;
  by_status: Record<string, number>;
}

/** Ключи метрик = ключи фильтров в TasksFiltersPayload. */
export type SummaryMetricKey =
  | 'overdue'
  | 'no_assignee'
  | 'unknown_data'
  // | 'date_conflicts'
  | 'is_due_date_error'
  | 'archived'
  | 'due_within_days';

/** Фильтры, которые умеет /tasks (расширенные). */
export interface TasksFiltersPayload {
  status?: string | string[];
  priority?: string | string[];
  project?: string | string[];
  assignee?: string | string[];
  tag?: string | string[];
  archived?: boolean | 'true' | 'false' | '1' | '0' | 'yes' | 'y';
  due_within_days?: number;
  overdue?: boolean;
  no_assignee?: boolean;
  unknown_data?: boolean;
  no_due?: boolean;
  no_priority?: boolean;
  is_due_date_error?: boolean;
}

export interface FiltersState {
  status: string[];
  priority: string[];
  project: string[];
  assignee: string[];
  tag: string[];
  archived: boolean;
  due_within_days: number | null;
  overdue: boolean;
  no_assignee: boolean;
  unknown_data: boolean;
  no_due?: boolean;
  no_priority?: boolean;
  is_due_date_error: boolean;
}

export const EMPTY_FILTERS: FiltersState = {
  status: [],
  priority: [],
  project: [],
  assignee: [],
  tag: [],
  archived: false,
  due_within_days: null,
  overdue: false,
  no_assignee: false,
  unknown_data: false,
  // date_conflicts: false,
  is_due_date_error: false,
};