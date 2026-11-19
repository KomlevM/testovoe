import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, retry, throwError, timer } from 'rxjs';
import { TaskRaw, TasksResponse } from '../models/task.models';
import { ApiResult, ApiFailure } from '../models/api.model';

const MAX_RETRIES = 2;

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private readonly baseUrl = '/api/v2';

  readonly tasks$ = new Observable<TaskRaw[]>

  constructor(private http: HttpClient) { }

  getTasks(page = 1, limit = 200): Observable<ApiResult<TasksResponse>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<TasksResponse>(`${this.baseUrl}/tasks`, { params }).pipe(
      retry({
        count: MAX_RETRIES,
        delay: (error) => this.retryDelay(error),
      }),
      map(data => ({ ok: true as const, data })),
      catchError(err => of({ ok: false as const, error: this.toFailure(err) })),
    );
  }

  // --- приватная транспортная логика ---

  private retryDelay(error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      const retryAfter = Number(error.headers.get('Retry-After') ?? '1');
      return timer(Math.max(1, retryAfter) * 1000);
    }
    return throwError(() => error); // остальное — не ретраим
  }

  private toFailure(err: unknown): ApiFailure {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        const retryAfter = Number(err.headers.get('Retry-After') ?? '1');
        return { kind: 'rate-limited', retryAfterSeconds: Math.max(1, retryAfter) };
      }
      if (err.status >= 500) return { kind: 'server-error', status: err.status };
      if (err.status === 0) return { kind: 'network' };
      return { kind: 'unknown', message: `HTTP ${err.status}` };
    }
    return { kind: 'unknown', message: err instanceof Error ? err.message : 'unknown' };
  }
}
