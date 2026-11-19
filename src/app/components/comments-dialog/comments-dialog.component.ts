import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TaskView } from '../../models/task.models';

export interface CommentsDialogData {
  task: TaskView;
}

@Component({
  selector: 'app-comments-dialog',
  standalone: false,
  templateUrl: './comments-dialog.component.html',
  styleUrls: ['./comments-dialog.component.css'],
})
export class CommentsDialogComponent {
  constructor(
    public readonly dialogRef: MatDialogRef<CommentsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: CommentsDialogData,
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  display(value: unknown): string {
    if (value === null || value === undefined) return '—';
    const s = String(value).trim();
    return s === '' ? '—' : s;
  }
}