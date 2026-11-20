// metrics.model.ts
export interface CounterMap { [key: string]: number; }

export interface HistogramValue {
  count: number;
  sum: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface PulseMetrics {
  counters: CounterMap;
  histograms: { [key: string]: HistogramValue };
  gauges: { uptime_seconds?: number; [key: string]: number | undefined };
}

export interface PulseMetricsResponse {
  service: string;
  heartbeat: string;
  version: string;
  utc_time: string;
  metrics: PulseMetrics;
}

export type ApiState = 'ok' | 'warn' | 'down' | 'unknown';

export interface MetricsView {
  apiState: ApiState;
  p95Ms: number | null;
  error5xxRate: number | null;   // 0..1
  rps: number | null;
  uptimeSeconds: number | null;
  rateLimitHitsDelta: number;    // растёт ли
  lastOkAt: Date | null;
  history: { t: number; p95Ms: number | null; errRate: number | null; rps: number | null }[];
}