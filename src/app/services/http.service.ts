// services/http.service.ts

import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, retry, throwError, timer } from 'rxjs';
import { FiltersResponse, SummaryResponse, TasksQuery, TasksResponse } from '../models/task.models';
import { ApiFailure, ApiResult, HealthResponse, RateLimitSnapshot } from '../models/api.model';
import { PulseMetricsResponse } from '../models/metrics.model';

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
  private readonly rateLimitSubject = new BehaviorSubject<RateLimitSnapshot | null>(null);
  readonly rateLimit$ = this.rateLimitSubject.asObservable();

  constructor(private http: HttpClient) { }

  postTasks(body: TasksQuery): Observable<ApiResult<TasksResponse>> {
    return this.http
      .post<TasksResponse>(`${this.baseUrl}/tasks`, body, {
        headers: this.staffHeaders(),
        observe: 'response',
      })
      .pipe(
        retry({ count: MAX_RETRIES, delay: (e, n) => this.retryDelay(e, n) }),
        map(res => {
          this.observeRateLimit(res.headers, false);
          return { ok: true as const, data: res.body as TasksResponse };
        }),
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

  private observeRateLimit(headers: HttpHeaders, limited: boolean, retryAfterSeconds?: number): void {
    const limit = this.parsePositiveInt(headers.get('X-RateLimit-Limit'));
    const remaining = this.parsePositiveInt(headers.get('X-RateLimit-Remaining'));

    const prev = this.rateLimitSubject.value;

    // 429: фиксируем «лимит до»
    if (limited) {
      const until = new Date(Date.now() + (retryAfterSeconds ?? 5) * 1000);
      this.rateLimitSubject.next({
        limit, remaining, observedAt: new Date(), limited: true, limitedUntil: until, retryAfterSeconds,
      });
      return;
    }

    // успех: если лимит ещё не истёк — не сбрасываем флаг, только обновляем числа
    const stillLimited = prev?.limited && prev.limitedUntil && prev.limitedUntil.getTime() > Date.now();
    this.rateLimitSubject.next({
      limit, remaining, observedAt: new Date(),
      limited: !!stillLimited,
      limitedUntil: stillLimited ? prev!.limitedUntil : null,
      retryAfterSeconds: stillLimited ? prev!.retryAfterSeconds : undefined,
    });
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
    return throwError(() => error);
  }

  private toFailure(err: unknown): ApiFailure {
    if (!(err instanceof HttpErrorResponse)) {
      return { kind: 'unknown', message: err instanceof Error ? err.message : 'unknown' };
    }

    if (err.status === 0) return { kind: 'network' };

    if (err.status === 429) {
      const retryAfter = this.parsePositiveInt(err.headers.get('Retry-After')) ?? 1;
      this.observeRateLimit(err.headers, true, retryAfter);
      const remaining = this.parsePositiveInt(err.headers.get('X-RateLimit-Remaining')) ?? undefined;
      const limit = this.parsePositiveInt(err.headers.get('X-RateLimit-Limit')) ?? undefined;
      return { kind: 'rate-limited', retryAfterSeconds: retryAfter, remaining, limit };
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

  getHealth(): Observable<ApiResult<HealthResponse>> {
    return this.http
      .get<HealthResponse>(`${this.baseUrl}/health`, { headers: this.staffHeaders() })
      .pipe(
        retry({ count: MAX_RETRIES, delay: (e, n) => this.retryDelay(e, n) }),
        map(data => ({ ok: true as const, data })),
        catchError(err => of({ ok: false as const, error: this.toFailure(err) })),
      );
  }

  getPulse(): Observable<ApiResult<PulseMetricsResponse>> {
    return this.http
      .get<PulseMetricsResponse>(`${this.baseUrl}/system/pulse`, { headers: this.staffHeaders() })
      .pipe(
        retry({ count: MAX_RETRIES, delay: (e, n) => this.retryDelay(e, n) }),
        map(data => ({ ok: true as const, data })),
        catchError(err => of({ ok: false as const, error: this.toFailure(err) })),
      );
  }
}