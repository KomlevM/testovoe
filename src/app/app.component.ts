import { Component } from '@angular/core';
import { TaskRaw } from './task.models';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'testovoe';
  onTaskSelected(task: TaskRaw): void {
    // пока заглушка: drawer подключим следующим шагом
    console.log('selected', task);
  }
}
