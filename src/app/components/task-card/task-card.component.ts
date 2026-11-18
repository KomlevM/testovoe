import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-task-card',
  standalone: false,
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.css'
})
export class TaskCardComponent {
  @Input() task!: any;          // <-- вот это
  @Output() selected = new EventEmitter<any>();

  onSelect(): void {
    this.selected.emit(this.task);
  }

  // безопасное отображение «грязного» значения: пустое → прочерк
  display(value: unknown): string {
    if (value === null || value === undefined) return '—';
    const s = String(value).trim();
    return s === '' ? '—' : s;
  }
}
