import { inject, Injectable, signal } from '@angular/core';
import { BehaviorSubject, combineLatest, firstValueFrom, map, Observable, shareReplay, switchMap } from 'rxjs';
import { EMPTY_FILTERS, Filters, NO_ASSIGNEE, NO_PROJECT, NO_STATUS, TaskRaw } from '../models/task.models';
import { HttpService } from './http.service';
import { ApiFailure } from '../models/api.model';

interface Column {
  status: string;
  label: string;
  tasks: TaskRaw[];
}

export interface TasksState {
  tasks: TaskRaw[];
  error: ApiFailure | null;
}

@Injectable({
  providedIn: 'root'
})
export class TasksService {
  constructor(private http: HttpService) { }
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  private readonly _filters$ = new BehaviorSubject<Filters>(EMPTY_FILTERS);
  readonly filters$ = this._filters$.asObservable();

  readonly state$: Observable<TasksState> = this.reload$.pipe(
    switchMap(() =>
      this.http.getTasks(1, 200).pipe(
        map(result =>
          result.ok
            ? { tasks: result.data.items, error: null }
            : { tasks: [], error: result.error },
        ),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly tasks$ = this.state$.pipe(map(s => s.tasks));
  readonly error$ = this.state$.pipe(map(s => s.error));

  readonly visibleTasks$ = combineLatest([this.tasks$, this.filters$]).pipe(
    map(([tasks, filters]) => applyFilters(tasks, filters)),
  );

  readonly columns$ = this.visibleTasks$.pipe(map(tasks => groupByRawStatus(tasks)));

  readonly statusOptions$ = this.tasks$.pipe(map(tasks => uniq(tasks.map(t => t.status))));
  readonly priorityOptions$ = this.tasks$.pipe(map(tasks => uniq(tasks.map(t => t.priority))));
  readonly projectOptions$ = this.tasks$.pipe(map(tasks => uniq(tasks.map(t => t.project))));
  readonly assigneeOptions$ = this.tasks$.pipe(map(tasks => uniq(tasks.map(t => t.assignee))));
  readonly tagOptions$ = this.tasks$.pipe(
    map(tasks => uniq(tasks.flatMap(t => (Array.isArray(t.tags) ? t.tags : [])))),
  );

  reload(): void { this.reload$.next(); }
  setFilters(filters: Filters): void { this._filters$.next(filters); }
}

// ---- 3. Чистые функции (после класса) ----

function uniq(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s !== '') set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function rawStatus(t: TaskRaw): string {
  const v = t.status;
  if (v === null || v === undefined) return '';
  console.log([...new Set(String(v).trim())].join(''))
  return String(v).trim();
}

function applyFilters(tasks: TaskRaw[], f: Filters): TaskRaw[] {
  return tasks.filter(t => {
    if (!f.showArchived && isArchived(t)) return false;

    if (f.statuses.length) {
      const s = rawStatus(t);
      const match = s === '' ? f.statuses.includes(NO_STATUS) : f.statuses.includes(s);
      if (!match) return false;
    }
    if (f.priorities.length) {
      const p = t.priority == null ? '' : String(t.priority).trim();
      if (!f.priorities.includes(p)) return false;
    }
    if (f.projects.length) {
      const p = t.project == null ? '' : String(t.project).trim();
      const match = p === '' ? f.projects.includes(NO_PROJECT) : f.projects.includes(p);
      if (!match) return false;
    }
    if (f.assignees.length) {
      const a = t.assignee == null ? '' : String(t.assignee).trim();
      const match = a === '' ? f.assignees.includes(NO_ASSIGNEE) : f.assignees.includes(a);
      if (!match) return false;
    }
    if (f.tags.length) {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      if (!tags.some(tag => f.tags.includes(tag))) return false;
    }
    return true;
  });
}

function isArchived(t: TaskRaw): boolean {
  return (t as Record<string, unknown>)['archived'] === true;
}

function groupByRawStatus(tasks: TaskRaw[]): Column[] {
  const map = new Map<string, TaskRaw[]>();
  for (const t of tasks) {
    const key = rawStatus(t) || '— без статуса —';
    const arr = map.get(key);
    if (arr) arr.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()]
    .map(([status, tasks]) => ({ status, label: status, tasks }))
    .sort((a, b) => a.status.localeCompare(b.status));
}