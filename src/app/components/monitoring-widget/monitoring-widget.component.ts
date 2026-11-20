// monitoring-widget.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetricsService } from '../../services/metric.service';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-monitoring-widget',
  standalone: false,
  templateUrl: './monitoring-widget.component.html',
  styleUrls: ['./monitoring-widget.component.css'],
})
export class MonitoringWidgetComponent {
  readonly metrics$ = inject(MetricsService).metrics$;

  constructor(private readonly dialogRef: MatDialogRef<MonitoringWidgetComponent>) { }

  close(): void { this.dialogRef.close(); }

  fmtMs(v: number | null): string { return v == null ? '—' : `${Math.round(v)}ms`; }
  fmtPct(v: number | null): string { return v == null ? '—' : `${(v * 100).toFixed(2)}%`; }
  fmtRps(v: number | null): string { return v == null ? '—' : v.toFixed(1); }
  fmtUptime(s: number | null): string {
    if (s == null) return '—';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return `${h}ч ${m}м`;
  }
  stateLabel(s: string): string {
    return s === 'ok' ? 'работает' : s === 'warn' ? 'деградация' : s === 'down' ? 'недоступен' : 'нет данных';
  }
  stateClass(s: string): string { return `api-state api-state--${s}`; }

  sparkPoints(history: { p95Ms: number | null; errRate: number | null; rps: number | null }[], key: 'p95Ms' | 'errRate' | 'rps'): string {
    const vals = history.map(h => h[key]).filter((v): v is number => v != null);
    if (vals.length < 2) return '';
    const max = Math.max(...vals, 1e-9);
    const step = 100 / (vals.length - 1);
    return vals.map((v, i) => `${(i * step).toFixed(2)},${(24 - (v / max) * 24).toFixed(2)}`).join(' ');
  }
}