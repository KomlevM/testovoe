import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, map, shareReplay, timer } from 'rxjs';
import { TasksService, Column, TasksLoad, ALLOWED_LIMITS } from '../../services/tasks.service';
import { FilterOption, SortDir, SortField, TaskView } from '../../models/task.models';
import { ApiFailure } from '../../models/api.model';
import { CommentsDialogComponent } from '../comments-dialog/comments-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-board',
  standalone: false,
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.css'],
})
export class BoardComponent implements OnInit {
  private readonly tasksService = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  readonly load$ = this.tasksService.load$;
  readonly columns$ = this.tasksService.columns$;
  readonly pagination$ = this.tasksService.pagination$;
  readonly allowedLimits = ALLOWED_LIMITS;

  readonly sortFields$: Observable<FilterOption[]> = this.tasksService.filtersResponse$.pipe(
    map(r => (r.ok ? r.data.sort.fields.map(f => ({ id: f.id, label: f.label })) : [])),
  );
  readonly sortDirections$: Observable<FilterOption[]> = this.tasksService.filtersResponse$.pipe(
    map(r => (r.ok ? r.data.sort.directions.map(d => ({ id: d.id, label: d.label })) : [])),
  );
  readonly sortState$ = this.tasksService.state.pipe(
    map(s => ({ field: s.sortField, dir: s.sortDir })),
  );

  showScrollTop = false;
  private readonly SCROLL_TOP_THRESHOLD = 300;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.showScrollTop = window.scrollY > this.SCROLL_TOP_THRESHOLD;
  }

  view: 'list' | 'kanban' = 'kanban';

  /** Задачи текущей страницы (для ленты). data — источник истины. */
  readonly tasks$: Observable<TaskView[]> = this.load$.pipe(
    map(load => (load.status === 'ok' ? load.views : [])),
  );

  readonly error$: Observable<ApiFailure | null> = this.load$.pipe(
    map(load => (load.status === 'error' ? load.error : null)),
  );

  ngOnInit(): void {
    this.tasksService.reloadAll();
  }

  setView(v: 'list' | 'kanban'): void {
    this.view = v;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  reload(): void {
    this.tasksService.reloadAll();
  }

  openTask(task: TaskView): void {
    // TODO: открыть task-drawer
  }

  openComments(task: TaskView): void {
    this.dialog.open(CommentsDialogComponent, {
      data: { task },
      width: '560px',
      maxHeight: '80vh',
    });
  }

  setPage(page: number): void { this.tasksService.setPage(page); }
  setLimit(limit: number): void { this.tasksService.setLimit(limit); }
  setSort(field: SortField, dir: SortDir): void { this.tasksService.setSort(field, dir); }
}