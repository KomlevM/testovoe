// models/api.model.ts

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiFailure };

export type ApiFailure =
  | { kind: 'rate-limited'; retryAfterSeconds: number; remaining: number | null }
  | { kind: 'forbidden' }                                    // 403 forbidden
  | { kind: 'not-found'; id?: string }                       // 404 not_found
  | { kind: 'unknown-route'; route?: string }                // 404 unknown_route
  | { kind: 'bad-request'; error: string }                   // 400 invalid_json | body_must_be_object
  | { kind: 'server-error'; status: number }
  | { kind: 'network' }
  | { kind: 'unknown'; message: string };