import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject, Observable, combineLatest, distinctUntilChanged, forkJoin,
  map, shareReplay, startWith, switchMap, timer, merge, filter, scan,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpService } from './http.service';
import { ApiFailure, ApiResult } from '../models/api.model';
import {
  EMPTY_FILTERS, FiltersResponse, FiltersState, NO_STATUS, SortDir, SortField,
  STATUS_LABELS, SummaryResponse, TasksFiltersPayload, TasksMeta, TasksQuery,
  TasksResponse, TaskView,
} from '../models/task.models';
import { toTaskView } from '../normalizers/task-view.normalizer';

export interface Column {
  status: string;
  label: string;
  tasks: TaskView[];
}

interface RateLimitState {
  at: Date;
  retryAfterSeconds: number;
  remaining?: number;
  limit?: number;
}

export interface TasksState {
  page: number;
  limit: number;
  filters: FiltersState;
  sortField: SortField;
  sortDir: SortDir;
}

export type TasksLoad =
  | { status: 'idle' }
  | {
    status: 'ok';
    response: TasksResponse;
    views: TaskView[];
    appliedFilters: TasksMeta['filters'];
    loadedAt: Date;
  }
  | { status: 'error'; error: ApiFailure };

export type SummaryLoad =
  | { status: 'idle' }
  | { status: 'ok'; data: SummaryResponse; loadedAt: Date }
  | { status: 'error'; error: ApiFailure };

/** Снапшот tasks из одного момента. Summary живёт в отдельном потоке. */
export interface Snapshot {
  tasks: ApiResult<TasksResponse>;
  requestedAt: Date;
}

export type MetricFilterKey =
  | 'overdue'
  | 'no_assignee'
  | 'unknown_data'
  | 'no_due'
  | 'no_priority'
  | 'is_due_date_error'
  | 'due_within_days';

export const METRIC_KEYS: readonly MetricFilterKey[] = [
  'overdue', 'no_assignee', 'unknown_data', 'no_due', 'no_priority',
  'is_due_date_error', 'due_within_days',
];

export const ALLOWED_LIMITS = [10, 25, 50, 100] as const;

const DEFAULT_STATE: TasksState = {
  page: 0,
  limit: 25,
  filters: { ...EMPTY_FILTERS },
  sortField: 'created',
  sortDir: 'desc',
};

const COLUMN_ORDER = [
  'NEW', 'IN_PROGRESS', 'CODE_REVIEW', 'BLOCKED', 'HOLD', 'DONE',
] as const;

const AUTO_RELOAD_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpService);

  private readonly state$ = new BehaviorSubject<TasksState>(DEFAULT_STATE);
  private readonly summarySoonDays$ = new BehaviorSubject<number>(7);

  /** Частичный триггер: только tasks (фильтры/сортировка/пагинация). */
  private readonly tasksReload$ = new BehaviorSubject<void>(undefined);

  /** Полный триггер: tasks + summary + filters (кнопка / автообновление). */
  private readonly fullReload$ = new BehaviorSubject<void>(undefined);

  readonly state = this.state$.asObservable();
  readonly summarySoonDays = this.summarySoonDays$.asObservable();

  // --- tasks ---

  readonly snapshot$: Observable<Snapshot> = combineLatest([
    this.state$.pipe(distinctUntilChanged(sameQuery)),
    this.tasksReload$,
    this.fullReload$,
  ]).pipe(
    switchMap(([state]) => {
      const requestedAt = new Date();
      return this.http.postTasks(toQuery(state)).pipe(
        map((tasks): Snapshot => ({ tasks, requestedAt })),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly load$: Observable<TasksLoad> = this.snapshot$.pipe(
    map(s => toTasksLoad(s)),
    // startWith<TasksLoad>({ status: 'idle' }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly columns$: Observable<Column[]> = this.load$.pipe(
    map(load => buildColumns(load)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly pagination$: Observable<
    Pick<TasksMeta, 'page' | 'per_page' | 'total' | 'total_pages'> | null
  > = this.load$.pipe(
    map(load =>
      load.status === 'ok'
        ? {
          page: load.response.meta.page,
          per_page: load.response.meta.per_page,
          total: load.response.meta.total,
          total_pages: load.response.meta.total_pages,
        }
        : null,
    ),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  // --- summary ---

  private readonly summaryData$: Observable<ApiResult<SummaryResponse>> = combineLatest([
    this.summarySoonDays$,
    this.fullReload$,
  ]).pipe(
    switchMap(([soonDays]) => this.http.getSummary(soonDays)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly summary$: Observable<SummaryLoad> = this.summaryData$.pipe(
    map((res): SummaryLoad =>
      res.ok
        ? { status: 'ok', data: res.data, loadedAt: new Date() }
        : { status: 'error', error: res.error },
    ),
    startWith<SummaryLoad>({ status: 'idle' }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly lastSuccessAt$: Observable<Date | null> = merge(
    this.load$.pipe(
      filter(l => l.status === 'ok'),
      map(l => (l as Extract<TasksLoad, { status: 'ok' }>).loadedAt),
    ),
    this.summary$.pipe(
      filter(s => s.status === 'ok'),
      map(s => (s as Extract<SummaryLoad, { status: 'ok' }>).loadedAt),
    ),
  ).pipe(
    scan((acc, d) => (acc && acc > d ? acc : d), null as Date | null),
    startWith(null),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly rateLimit$ = this.load$.pipe(
    filter((l): l is Extract<TasksLoad, { status: 'error' }> =>
      l.status === 'error' && l.error.kind === 'rate-limited',
    ),
    map(l => l.error as Extract<ApiFailure, { kind: 'rate-limited' }>),
    startWith(null),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  // --- filters ---

  readonly filtersResponse$: Observable<ApiResult<FiltersResponse>> = this.fullReload$.pipe(
    switchMap(() => this.http.getFilters()),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  constructor() {
    // Полная перезагрузка раз в 30 секунд.
    timer(AUTO_RELOAD_MS, AUTO_RELOAD_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.reloadAll());
  }

  // --- команды ---

  setPage(page: number): void {
    const s = this.state$.value;
    if (!Number.isInteger(page) || page < 0 || page === s.page) return;
    this.state$.next({ ...s, page });
  }

  setLimit(limit: number): void {
    if (!ALLOWED_LIMITS.includes(limit as (typeof ALLOWED_LIMITS)[number])) return;
    const s = this.state$.value;
    if (limit === s.limit) return;
    this.state$.next({ ...s, limit, page: 0 });
  }

  setFilters(partial: Partial<FiltersState>): void {
    const s = this.state$.value;
    this.state$.next({
      ...s,
      filters: { ...s.filters, ...partial },
      page: 0,
    });
  }

  setSort(field: SortField, dir: SortDir): void {
    const s = this.state$.value;
    if (field === s.sortField && dir === s.sortDir) return;
    this.state$.next({ ...s, sortField: field, sortDir: dir, page: 0 });
  }

  setMetricFilter(key: MetricFilterKey | null): void {
    const s = this.state$.value;
    const cleared: Partial<FiltersState> = {};
    for (const k of METRIC_KEYS) {
      if (k === 'due_within_days') cleared.due_within_days = null;
      else cleared[k] = false;
    }

    let next: FiltersState = { ...s.filters, ...cleared };
    if (key === 'due_within_days') {
      next = { ...next, due_within_days: this.summarySoonDays$.value };
    } else if (key) {
      next = { ...next, [key]: true };
    }

    this.state$.next({ ...s, filters: next, page: 0 });
  }

  setSummarySoonDays(days: number): void {
    const n = Math.max(0, Math.floor(days));
    if (n === this.summarySoonDays$.value) return;
    this.summarySoonDays$.next(n);

    const s = this.state$.value;
    if (s.filters.due_within_days != null) {
      this.state$.next({
        ...s,
        filters: { ...s.filters, due_within_days: n },
        page: 0,
      });
    }
  }

  /** Кнопка «обновить» и автообновление: полная перезагрузка по всем ручкам. */
  reloadAll(): void {
    this.fullReload$.next();
  }

  /** Явная частичная перезагрузка tasks (обычно не нужна — state сам триггерит). */
  reloadTasks(): void {
    this.tasksReload$.next();
  }
}

// --- маппинг ---

function toTasksLoad(s: Snapshot): TasksLoad {
  if (!s.tasks.ok) return { status: 'error', error: s.tasks.error };
  const now = s.requestedAt;
  return {
    status: 'ok',
    response: s.tasks.data,
    views: s.tasks.data.data.map(dto => toTaskView(dto, now)),
    appliedFilters: s.tasks.data.meta.filters,
    loadedAt: now,
  };
}

function sameQuery(a: TasksState, b: TasksState): boolean {
  return (
    a.page === b.page &&
    a.limit === b.limit &&
    a.sortField === b.sortField &&
    a.sortDir === b.sortDir &&
    JSON.stringify(a.filters) === JSON.stringify(b.filters)
  );
}

export function toQuery(state: TasksState): TasksQuery {
  const filters = toFiltersPayload(state.filters);
  const query: TasksQuery = {
    page: state.page,
    limit: state.limit,
    sort: { field: state.sortField, dir: state.sortDir },
  };
  if (filters) query.filters = filters;
  return query;
}

function toFiltersPayload(f: FiltersState): TasksFiltersPayload | undefined {
  const out: TasksFiltersPayload = {};
  if (f.status.length) out.status = f.status;
  if (f.priority.length) out.priority = f.priority;
  if (f.project.length) out.project = f.project;
  if (f.assignee.length) out.assignee = f.assignee;
  if (f.tag.length) out.tag = f.tag;
  if (f.archived) out.archived = true;
  if (f.due_within_days != null) out.due_within_days = f.due_within_days;
  if (f.overdue) out.overdue = true;
  if (f.no_assignee) out.no_assignee = true;
  if (f.unknown_data) out.unknown_data = true;
  if (f.no_due) out.no_due = true;
  if (f.no_priority) out.no_priority = true;
  if (f.is_due_date_error) out.is_due_date_error = true;
  return Object.keys(out).length ? out : undefined;
}

function buildColumns(load: TasksLoad): Column[] {
  if (load.status !== 'ok') return [];

  const byStatus = new Map<string, TaskView[]>();
  for (const v of load.views) {
    const key = v.status ?? NO_STATUS;
    const bucket = byStatus.get(key);
    if (bucket) bucket.push(v);
    else byStatus.set(key, [v]);
  }

  const columns: Column[] = [];
  for (const status of COLUMN_ORDER) {
    const tasks = byStatus.get(status);
    if (tasks?.length) columns.push({ status, label: STATUS_LABELS[status], tasks });
  }
  const noStatus = byStatus.get(NO_STATUS);
  if (noStatus?.length) columns.push({ status: NO_STATUS, label: 'Без статуса', tasks: noStatus });

  return columns;
}