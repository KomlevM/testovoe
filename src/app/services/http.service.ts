// services/http.service.ts

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, retry, throwError, timer } from 'rxjs';
import { FiltersResponse, FiltersState, SummaryResponse, TasksFiltersPayload, TasksQuery, TasksResponse } from '../models/task.models';
import { ApiFailure, ApiResult } from '../models/api.model';

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 8000;
const JITTER_MS = 300;

interface BackendErrorBody {
  error?: string;
  route?: string;
  id?: string;
}

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly baseUrl = '/api/v2';

  constructor(private http: HttpClient) { }

  postTasks(body: TasksQuery): Observable<ApiResult<TasksResponse>> {
    return this.http
      .post<TasksResponse>(`${this.baseUrl}/tasks`, body, { headers: this.staffHeaders() })
      .pipe(
        retry({
          count: MAX_RETRIES,
          delay: (error, retryCount) => this.retryDelay(error, retryCount),
        }),
        map(data => ({ ok: true as const, data })),
        catchError(err => of({ ok: false as const, error: this.toFailure(err) })),
      );
  }

  getFilters(): Observable<ApiResult<FiltersResponse>> {
    return this.http
      .get<FiltersResponse>(`${this.baseUrl}/filters`, { headers: this.staffHeaders() })
      .pipe(
        retry({
          count: MAX_RETRIES,
          delay: (error, retryCount) => this.retryDelay(error, retryCount),
        }),
        map(data => ({ ok: true as const, data })),
        catchError(err => of({ ok: false as const, error: this.toFailure(err) })),
      );
  }

  getSummary(dueWithinDays: number): Observable<ApiResult<SummaryResponse>> {
    const body = { due_within_days: dueWithinDays };
    return this.http.post<SummaryResponse>(`${this.baseUrl}/summary`, body, { headers: this.staffHeaders() }).pipe(
      retry({ count: MAX_RETRIES, delay: (e, n) => this.retryDelay(e, n) }),
      map(data => ({ ok: true as const, data })),
      catchError(err => of({ ok: false as const, error: this.toFailure(err) })),
    );
  }

  // --- приватная транспортная логика ---

  /**
   * X-Staff-Key: по контракту нужен только для приватных задач (all_data.private === true).
   * Мок не отдаёт признак private в списке, поэтому шлём на все запросы.
   * Значение захардкожено в моке — это не секрет. Решение зафиксировать в DECISIONS.md.
   */
  private staffHeaders(): Record<string, string> {
    return { 'X-Staff-Key': 'tb-staff-2024' };
  }

  private retryDelay(error: unknown, retryCount: number): Observable<unknown> {
    if (!(error instanceof HttpErrorResponse) || error.status !== 429) {
      return throwError(() => error); // не 429 — не ретраим
    }
    // Retry-After бэк не отдаёт (контракт), но если появится — уважаем.
    const retryAfter = this.parsePositiveInt(error.headers.get('Retry-After'));
    const remaining = this.parsePositiveInt(error.headers.get('X-RateLimit-Remaining'));

    let delayMs: number;
    if (retryAfter !== null) {
      delayMs = retryAfter * 1000;
    } else {
      // Экспоненциальный backoff: 1s, 2s, ... + jitter, чтобы параллельные запросы не били синхронно.
      const exp = Math.min(BASE_BACKOFF_MS * 2 ** retryCount, MAX_BACKOFF_MS);
      delayMs = exp + Math.floor(Math.random() * JITTER_MS);
      // Если бэк сказал, что в окне ещё есть место — можно подождать меньше.
      if (remaining !== null && remaining > 0) {
        delayMs = Math.min(delayMs, 500 + Math.floor(Math.random() * JITTER_MS));
      }
    }
    return timer(delayMs);
  }

  private toFailure(err: unknown): ApiFailure {
    if (!(err instanceof HttpErrorResponse)) {
      return { kind: 'unknown', message: err instanceof Error ? err.message : 'unknown' };
    }

    if (err.status === 0) return { kind: 'network' };

    if (err.status === 429) {
      const retryAfter = this.parsePositiveInt(err.headers.get('Retry-After')) ?? 1;
      const remaining = this.parsePositiveInt(err.headers.get('X-RateLimit-Remaining'));
      return { kind: 'rate-limited', retryAfterSeconds: retryAfter, remaining };
    }

    const body = this.asBackendError(err.error);

    if (err.status === 403) return { kind: 'forbidden' };

    if (err.status === 404) {
      if (body?.error === 'not_found') return { kind: 'not-found', id: body.id };
      if (body?.error === 'unknown_route') return { kind: 'unknown-route', route: body.route };
      return { kind: 'not-found' }; // 404 без тела — трактуем как not_found
    }

    if (err.status === 400) {
      return { kind: 'bad-request', error: body?.error ?? 'bad_request' };
    }

    if (err.status >= 500) return { kind: 'server-error', status: err.status };

    return { kind: 'unknown', message: `HTTP ${err.status}` };
  }

  private asBackendError(value: unknown): BackendErrorBody | null {
    return value !== null && typeof value === 'object' ? (value as BackendErrorBody) : null;
  }

  private parsePositiveInt(raw: string | null): number | null {
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
}