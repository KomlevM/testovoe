import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { TaskView } from '../../models/task.models';
import { MatDialog } from '@angular/material/dialog';
import { TaskDetailDialogComponent } from '../task-detail-dialog/task-detail-dialog.component';

@Component({
  selector: 'app-task-card',
  standalone: false,
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.css',
})
export class TaskCardComponent {
  @Input({ required: true }) task!: TaskView;
  @Output() selected = new EventEmitter<TaskView>();
  @Output() commentsRequested = new EventEmitter<TaskView>();
  
  private readonly dialog = inject(MatDialog);

  onSelect(): void {
    this.dialog.open(TaskDetailDialogComponent, {
      data: { task: this.task },
      width: '720px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      restoreFocus: true,
    });
  }

  /** Безопасное отображение: null/undefined/'' → «—», иначе строка. */
  display(value: unknown): string {
    if (value === null || value === undefined) return '—';
    const s = String(value).trim();
    return s === '' ? '—' : s;
  }

  onCommentsClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.task.comments.length === 0) return;
    this.commentsRequested.emit(this.task);
  }

  /** Есть ли значение (для бейджей «Неизвестно» vs «—»). */
  hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
  }

  isUnknown(value: unknown): boolean {
    return value === 'Неизвестно';
  }
}