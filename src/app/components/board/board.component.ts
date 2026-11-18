import { Component, computed, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { TasksService } from '../../services/tasks.service';
import { TaskRaw } from '../../task.models';

// временные типы-заглушки, пока нет models/
interface TaskLike { id: string | number; }
interface ColumnLike { status: string; label: string; tasks: TaskLike[]; }
interface SummaryLike { overdue: number; blocked: number; noAssignee: number; soon: number; }

@Component({
  selector: 'app-board',
  standalone: false,
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.css'],
})
export class BoardComponent {
  private tasksService = inject(TasksService);

  readonly tasks = this.tasksService.tasks;
  readonly loading = this.tasksService.loading;
  readonly error = this.tasksService.error;

  readonly view = signal<'list' | 'kanban'>('kanban');

  @Output() taskSelected = new EventEmitter<TaskRaw>();

  // Группировка ПО СЫРОМУ статусу. Без словаря синонимов — это следующий шаг.
  readonly columns = computed<ColumnLike[]>(() => {
    const map = new Map<string, TaskRaw[]>();
    for (const t of this.tasks()) {
      const key = this.rawStatus(t);
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return Array.from(map.entries())
      .map(([status, tasks]) => ({ status, label: status, tasks }))
      .sort((a, b) => a.status.localeCompare(b.status));
  });

  ngOnInit(): void {
    void this.tasksService.load();
  }

  // безопасное извлечение сырого статуса; пустое → '— без статуса —'
  private rawStatus(t: TaskRaw): string {
    const v = t.status;
    if (v === null || v === undefined) return '— без статуса —';
    const s = String(v).trim();
    return s === '' ? '— без статуса —' : s;
  }
}