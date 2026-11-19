import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, debounceTime, map, shareReplay, startWith } from 'rxjs';
import {
  EMPTY_FILTERS, FilterOption, FiltersResponse, FiltersState,
} from '../../models/task.models';
import { TasksService } from '../../services/tasks.service';
import { ApiResult } from '../../models/api.model';

interface Option { value: string | number; label: string; }

@Component({
  selector: 'app-filter-panel',
  standalone: false,
  templateUrl: './filter-panel.component.html',
  styleUrls: ['./filter-panel.component.css'],
})
export class FilterPanelComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tasksService = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);

  // СНАЧАЛА — источник, от которого зависят остальные
  private readonly filtersResponse$: Observable<ApiResult<FiltersResponse>> =
    this.tasksService.filtersResponse$.pipe(shareReplay({ bufferSize: 1, refCount: true }));

  // ПОТОМ — производные
  readonly statusOptions$: Observable<Option[]> = this.optionsFrom('statuses');
  readonly priorityOptions$: Observable<Option[]> = this.optionsFrom('priorities');
  readonly projectOptions$: Observable<Option[]> = this.optionsFrom('projects');
  readonly assigneeOptions$: Observable<Option[]> = this.optionsFrom('assignees');
  readonly tagOptions$: Observable<Option[]> = this.optionsFrom('tags');
  readonly dueWithinDaysBounds$ = this.filtersResponse$.pipe(
    map(r => (r.ok ? r.data.due_within_days : { min: 0, max: 365, default: 7 })),
  );

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      status: [[]],
      priority: [[]],
      project: [[]],
      assignee: [[]],
      tag: [[]],
      archived: [false],
      // due_within_days: [null as number | null],
    });

    this.form.valueChanges.pipe(
      startWith(this.form.value),
      debounceTime(300),           // числовое поле не должно дёргать бэк на каждый символ
      map(v => this.toFiltersState(v)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(partial => this.tasksService.setFilters(partial));
  }

  toggleArchived(): void {
    const ctrl = this.form.get('archived');
    if (!ctrl) return;
    ctrl.setValue(!ctrl.value);
  }

  reset(): void {
    this.form.reset({
      status: [], priority: [], project: [], assignee: [], tag: [], archived: false,
    });
  }

  private optionsFrom(key: 'statuses' | 'priorities' | 'projects' | 'assignees' | 'tags'): Observable<Option[]> {
    return this.filtersResponse$.pipe(
      map(r => (r.ok ? r.data[key].map((o: FilterOption) => ({ value: o.id, label: o.label })) : [])),
    );
  }

  private toFiltersState(v: {
    status: Array<string | number>;
    priority: Array<string | number>;
    project: Array<string | number>;
    assignee: Array<string | number>;
    tag: Array<string | number>;
    archived: boolean;
  }): Partial<FiltersState> {
    return {
      status: v.status.map(String),
      priority: v.priority.map(String),
      project: v.project.map(String),
      assignee: v.assignee.map(String),
      tag: v.tag.map(String),        // ← было String
      archived: v.archived === true,
    };
  }
}