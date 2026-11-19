// footer.component.ts
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, shareReplay, switchMap, timer } from 'rxjs';
import { HttpService } from '../../services/http.service';
import { PulseResponse } from '../../models/api.model';

interface PulseState {
  status: 'loading' | 'ok' | 'error';
  data?: PulseResponse;
}

@Component({
  selector: 'app-footer',
  standalone: false,
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
})
export class FooterComponent {
  private readonly http = inject(HttpService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pulse$: Observable<PulseState> = timer(0, 30_000).pipe(
    switchMap(() => this.http.getPulse()),
    map((res): PulseState =>
      res.ok ? { status: 'ok', data: res.data } : { status: 'error' },
    ),
    catchError(() => of<PulseState>({ status: 'error' })),
    shareReplay({ bufferSize: 1, refCount: true }),
    takeUntilDestroyed(this.destroyRef),
  );
}