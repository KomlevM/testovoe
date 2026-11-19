// task-details-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TaskView } from '../../models/task.models';

export interface TaskDetailsDialogData {
  task: TaskView;
}

@Component({
  selector: 'app-task-details-dialog',
  standalone: false,
  templateUrl: './task-detail-dialog.component.html',
  styleUrls: ['./task-detail-dialog.component.css'],
})
export class TaskDetailDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: TaskDetailsDialogData,
    private readonly dialogRef: MatDialogRef<TaskDetailDialogComponent>,
  ) { }

  get allData(): [key: any] | null {
    return this.data.task.all_data;
  }

  close(): void {
    this.dialogRef.close();
  }
}