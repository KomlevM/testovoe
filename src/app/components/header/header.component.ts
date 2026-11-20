import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, combineLatest, map, of, shareReplay, switchMap, take, timer } from 'rxjs';
import { TasksService } from '../../services/tasks.service';
import { HttpService } from '../../services/http.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MonitoringWidgetComponent } from '../monitoring-widget/monitoring-widget.component';
import { MatDialog } from '@angular/material/dialog';

type Freshness = 'unknown' | 'fresh' | 'stale' | 'down';

interface FreshnessState {
  level: Freshness;
  label: string;
  ageSeconds: number | null;
}

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  private readonly tasksService = inject(TasksService);
  private readonly http = inject(HttpService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  /** Статус сервера для бейджа: /health → ok, ошибка → down. */
  readonly freshness$: Observable<FreshnessState> = combineLatest([
    this.tasksService.lastSuccessAt$,
    timer(0, 5_000).pipe(map(() => Date.now())),
  ]).pipe(
    map(([lastAt, now]) => this.toFreshness(lastAt, now)),
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntilDestroyed(this.destroyRef),
  );

  readonly rateLimit$ = this.tasksService.rateLimit$;

  readonly canReload$ = this.tasksService.rateLimit$.pipe(
    map(rl => rl === null),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private toFreshness(lastAt: Date | null, now: number): FreshnessState {
    if (!lastAt) return { level: 'unknown', label: 'нет данных', ageSeconds: null };
    const age = Math.max(0, Math.floor((now - lastAt.getTime()) / 1000));

    if (age < 30) return { level: 'fresh', label: `свежо · ${age}с`, ageSeconds: age };
    if (age < 60) return { level: 'stale', label: `устарело · ${age}с`, ageSeconds: age };
    return { level: 'down', label: `нет связи · ${Math.floor(age / 60)}м`, ageSeconds: age };
  }

  readonly canExport$ = this.tasksService.load$.pipe(
    map(load => load.status === 'ok'),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  ngOnInit(): void {
    this.tasksService.rateLimit$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => console.log('rateLimit:', v));

    this.tasksService.snapshot$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(s => {
      console.log('snapshot:', s.tasks.ok, s.requestedAt);
    });
  }

  reload(): void {
    // если лимит активен — не дёргаем, показываем сообщение
    this.tasksService.rateLimit$.pipe(take(1)).subscribe(rl => {
      if (rl) {
        this.snack.open(
          `Лимит запросов${rl.limit != null ? `: ${rl.remaining} из ${rl.limit}` : ''}. Подождите.`,
          'OK',
          { duration: 3000 },
        );
        return;
      }
      this.tasksService.reloadAll();
    });
  }

  openMetrics(): void {
    this.dialog.open(MonitoringWidgetComponent, {
      width: '640px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      restoreFocus: true,
    });
  }

  exportJson(): void {
    this.tasksService.snapshot$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(snapshot => {
        if (!snapshot.tasks.ok) return;
        const payload = {
          exportedAt: new Date().toISOString(),
          tasks: snapshot.tasks.data.data,
          meta: snapshot.tasks.data.meta,
        };
        this.downloadJson(payload, `tasks-${this.stamp()}.json`);
      });
  }

  private downloadJson(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private stamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
}