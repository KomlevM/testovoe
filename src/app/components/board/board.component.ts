import { Component, computed, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { TasksService } from '../../services/tasks.service';
import { TaskRaw } from '../../models/task.models';
import { Observable } from 'rxjs';
import { ApiFailure } from '../../models/api.model';

// временные типы-заглушки, пока нет models/
interface TaskLike { id: string | number; }
interface Column { status: string; label: string; tasks: TaskLike[]; }
interface SummaryLike { overdue: number; blocked: number; noAssignee: number; soon: number; }

@Component({
  selector: 'app-board',
  standalone: false,
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.css'],
})
export class BoardComponent {
  private tasksService = inject(TasksService);

  readonly tasks$: Observable<TaskRaw[]> = this.tasksService.visibleTasks$;
  readonly columns$: Observable<Column[]> = this.tasksService.columns$;
  readonly error$: Observable<ApiFailure | null> = this.tasksService.error$;

  view: 'list' | 'kanban' = 'kanban';

  ngOnInit(): void {
    this.tasksService.reload();
  }

  setView(v: 'list' | 'kanban'): void {
    this.view = v;
  }

  reload(): void {
    this.tasksService.reload();
  }
}