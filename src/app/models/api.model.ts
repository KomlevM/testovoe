export type ApiFailure =
  | { kind: 'rate-limited'; retryAfterSeconds: number }
  | { kind: 'server-error'; status: number }
  | { kind: 'network' }
  | { kind: 'unknown'; message: string };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiFailure };