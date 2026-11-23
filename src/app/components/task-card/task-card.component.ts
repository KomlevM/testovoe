import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { TaskView } from '../../models/task.models';
import { MatDialog } from '@angular/material/dialog';
import { TaskDetailDialogComponent } from '../task-detail-dialog/task-detail-dialog.component';
import { TasksService } from '../../services/tasks.service';
import { parseDtoDate } from '../../normalizers/task-view.normalizer';
import { toSignal } from '@angular/core/rxjs-interop';

type CardBadgeType = 'archive' | 'conflict' | 'overdue' | 'soon' | 'unkown' | 'nodate';

interface CardBadge {
  type: CardBadgeType;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-task-card',
  standalone: false,
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.css',
})
export class TaskCardComponent {
  private readonly tasks = inject(TasksService);
  private readonly dialog = inject(MatDialog);
  private readonly now = signal(Date.now());

  @Input({ required: true }) task!: TaskView;
  @Output() selected = new EventEmitter<TaskView>();
  @Output() commentsRequested = new EventEmitter<TaskView>();

  readonly summarySoonDays = toSignal(this.tasks.summarySoonDays, {
    initialValue: 7,
  });

  readonly isSoon = (t: TaskView): boolean => {
    const due = parseDtoDate(t.due);
    if (!due) return false;
    const diff = due.getTime() - this.now()
    return diff >= 0 && diff <= this.summarySoonDays() * 86_400_000;
  };

  isUnknown(t: TaskView): boolean {
    return Object.values(t).some(v => v === 'Неизвестно');
  }

  get cardBadges(): CardBadge[] {
    const badges: CardBadge[] = [];
    const t = this.task;

    // Слот 1: архивный
    if (t.archived) {
      badges.push({ type: 'archive', icon: 'inventory_2', label: 'Архивный' });
    }

    if(this.isUnknown(t)) {
      badges.push({ type: 'unkown', icon: 'help_outline', label: 'Неизвестные данные' });
    }

    // Слот 2: один датовый по приоритету
    if (t.is_due_date_error) {
      badges.push({ type: 'conflict', icon: 'warning', label: 'Конфликт дат' });
    } 
    if (t.due === null) {
      badges.push({ type: 'nodate', icon: 'event_busy', label: 'Нет срока' });
    } 
    if (t.is_overdue) {
      badges.push({ type: 'overdue', icon: 'schedule', label: 'Просрочено' });
    } 
    if (this.isSoon(t)) {
      badges.push({ type: 'soon', icon: 'hourglass_bottom', label: 'Скоро истекает' });
    }

    return badges;
  }

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
    this.stopProp(event)
    if (this.task.comments.length === 0) return;
    this.commentsRequested.emit(this.task);
  }

  stopProp(event: MouseEvent){
    event.stopPropagation();
    event.preventDefault();
  }

  /** Есть ли значение (для бейджей «Неизвестно» vs «—»). */
  hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
  }
}