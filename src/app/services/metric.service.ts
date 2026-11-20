// metrics.service.ts
import { Injectable, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, switchMap, timer } from 'rxjs';
import { HttpService } from './http.service';
import { PulseMetricsResponse, MetricsView, ApiState, CounterMap } from '../models/metrics.model';

const POLL_MS = 20_000;          // 15–30с; 20 — компромисс
const HISTORY_LEN = 60;

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly view$ = new BehaviorSubject<MetricsView>({
    apiState: 'unknown', p95Ms: null, error5xxRate: null, rps: null,
    uptimeSeconds: null, rateLimitHitsDelta: 0, lastOkAt: null, history: [],
  });

  readonly metrics$ = this.view$.asObservable();

  private prev: { at: number; pulse: PulseMetricsResponse } | null = null;

  constructor() {
    timer(0, POLL_MS)
      .pipe(
        switchMap(() => this.http.getPulse()),
        map(res => {
          if (!res.ok) {
            // ошибка сети/429 — не сбрасываем lastOkAt, помечаем состояние
            const cur = this.view$.value;
            const state: ApiState = res.error.kind === 'rate-limited' ? 'warn' : 'down';
            return { ...cur, apiState: state };
          }
          return this.compute(res.data);
        }),
        catchError(() => {
          const cur = this.view$.value;
          return of({ ...cur, apiState: 'down' as ApiState });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(v => this.view$.next(v));
  }

  private compute(pulse: PulseMetricsResponse): MetricsView {
    const now = Date.now();
    const prev = this.prev;
    const dt = prev ? Math.max(1, (now - prev.at) / 1000) : 0;

    const p95Sec = this.maxP95(pulse);
    const p95Ms = p95Sec != null ? p95Sec * 1000 : null;

    let rps: number | null = null;
    let errRate: number | null = null;
    let rateLimitDelta = 0;

    if (prev) {
      const dReq = this.delta(this.sumKeys(prev.pulse, 'http_requests_total'), this.sumKeys(pulse, 'http_requests_total'));
      const d5xx = this.delta(this.sumKeys(prev.pulse, 'http_errors_total', '5xx'), this.sumKeys(pulse, 'http_errors_total', '5xx'));
      const d429 = this.delta(this.getCounter(prev.pulse, 'rate_limit_hits_total'), this.getCounter(pulse, 'rate_limit_hits_total'));
      rps = dReq / dt;
      errRate = dReq > 0 ? d5xx / dReq : 0;
      rateLimitDelta = d429;
    }

    const apiState = this.classify(p95Ms, errRate, rateLimitDelta);
    const uptime = pulse.metrics.gauges['uptime_seconds'] ?? null;

    const hist = [...this.view$.value.history, { t: now, p95Ms, errRate, rps }].slice(-HISTORY_LEN);

    this.prev = { at: now, pulse };
    return { apiState, p95Ms, error5xxRate: errRate, rps, uptimeSeconds: uptime, rateLimitHitsDelta: rateLimitDelta, lastOkAt: new Date(now), history: hist };
  }

  private classify(p95Ms: number | null, errRate: number | null, rateLimitDelta: number): ApiState {
    if (p95Ms == null) return 'unknown';
    if (p95Ms > 2000 || (errRate != null && errRate > 0.05)) return 'down';
    if (p95Ms >= 500 || (errRate != null && errRate >= 0.01) || rateLimitDelta > 0) return 'warn';
    return 'ok';
  }

  private maxP95(pulse: PulseMetricsResponse): number | null {
    let max: number | null = null;
    for (const [k, v] of Object.entries(pulse.metrics.histograms)) {
      if (k.startsWith('http_request_duration_seconds') && v.p95 > (max ?? -1)) max = v.p95;
    }
    return max;
  }

  private sumKeys(pulse: PulseMetricsResponse, prefix: string, contains?: string): number {
    let s = 0;
    for (const [k, v] of Object.entries(pulse.metrics.counters)) {
      if (k.startsWith(prefix) && (!contains || k.includes(contains))) s += v;
    }
    return s;
  }

  private getCounter(pulse: PulseMetricsResponse, name: string): number {
    return pulse.metrics.counters[name] ?? 0;
  }

  private delta(a: number, b: number): number {
    return Math.max(0, b - a);   // counter может «сброситься» при рестарте — не уходим в минус
  }
}