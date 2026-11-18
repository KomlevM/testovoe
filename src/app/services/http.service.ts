import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TasksResponse } from '../task.models';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/v2';

  getTasks(page = 1, limit = 50): Observable<TasksResponse> {
    const params = new HttpParams()
      .set('page', page)
      .set('limit', limit);
    return this.http.get<TasksResponse>(`${this.baseUrl}/tasks`, { params });
  }
}
