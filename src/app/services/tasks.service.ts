import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskRaw } from '../task.models';
import { HttpService } from './http.service';

@Injectable({
  providedIn: 'root'
})
export class TasksService {
  private http = inject(HttpService);

  private readonly _tasks = signal<TaskRaw[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly tasks = this._tasks.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async load(page = 1, limit = 50): Promise<void> {
  this._loading.set(true);
  this._error.set(null);
  try {
    const res = await firstValueFrom(this.http.getTasks(page, limit));
    this._tasks.set(res.items);
  } catch (e: unknown) {
    this._error.set(e instanceof Error ? e.message : 'load failed');
  } finally {
    this._loading.set(false);
  }
}
}
