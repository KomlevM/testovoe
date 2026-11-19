import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { map } from 'rxjs';
import { TasksService, MetricFilterKey, SummaryLoad } from '../../services/tasks.service';
import { FiltersState, SummaryResponse } from '../../models/task.models';
import { ApiResult } from '../../models/api.model';

interface MetricTile {
  key: MetricFilterKey;
  label: string;
  value: (s: SummaryResponse) => number;
}

@Component({
  selector: 'app-summary',
  standalone: false,
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.css'],
})
export class SummaryComponent {
  private readonly tasksService = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);

  readonly summary$ = this.tasksService.summary$;
  readonly filters$ = this.tasksService.state.pipe(map(s => s.filters));
  readonly summarySoonDays$ = this.tasksService.summarySoonDays;
  readonly soonDaysControl = new FormControl<number>(7, { nonNullable: true });

  readonly metricTiles: MetricTile[] = [
    { key: 'overdue', label: 'Просрочено', value: s => s.overdue },
    // { key: 'no_assignee', label: 'Нет исполнителя', value: s => s.no_assignee },
    { key: 'unknown_data', label: 'Неизвестные данные', value: s => s.unknown_data },
    { key: 'no_due', label: 'Без срока', value: s => s.no_due },
    // { key: 'no_priority', label: 'Без приоритета', value: s => s.no_priority },
    { key: 'is_due_date_error', label: 'Срок раньше создания', value: s => s.is_due_date_error },
    { key: 'due_within_days', label: 'Скоро', value: s => s.due_soon },
  ];

  constructor() {
    // синхронизация: если N в сервисе поменялось (например, из другого места) — обновить поле
    this.tasksService.summarySoonDays
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(n => {
        if (this.soonDaysControl.value !== n) {
          this.soonDaysControl.setValue(n, { emitEvent: false });
        }
      });

    // ввод пользователя → сервис
    this.soonDaysControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(days => {
        const n = Number.isFinite(Number(days)) ? Math.max(0, Math.floor(Number(days))) : 7;
        this.tasksService.setSummarySoonDays(n);
      });
  }

  metricValue(res: SummaryLoad | null, tile: MetricTile): number {
    return res && res.status === 'ok' ? tile.value(res.data) : 0;
  }

  isActive(filters: FiltersState, key: MetricFilterKey): boolean {
    return key === 'due_within_days'
      ? filters.due_within_days != null
      : filters[key] === true;
  }

  onMetricClick(filters: FiltersState, key: MetricFilterKey): void {
    const active = this.isActive(filters, key);
    this.tasksService.setMetricFilter(active ? null : key);
  }
}