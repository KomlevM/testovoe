import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FooterComponent } from './components/footer/footer.component';
import { FilterPanelComponent } from './components/filter-panel/filter-panel.component';
import { HeaderComponent } from './components/header/header.component';
import { BoardComponent } from './components/board/board.component';
import { TaskCardComponent } from './components/task-card/task-card.component';
import { CommentsDialogComponent } from './components/comments-dialog/comments-dialog.component';
import { SummaryComponent } from './components/summary/summary.component';
import { TaskDetailDialogComponent } from './components/task-detail-dialog/task-detail-dialog.component';

import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialogActions } from '@angular/material/dialog';
import { MatIconModule, MatIcon } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';   // для drawer
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';   // header
import { MatBadgeModule } from '@angular/material/badge';       // счётчики
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MonitoringWidgetComponent } from './components/monitoring-widget/monitoring-widget.component';       // счётчики

@NgModule({
  declarations: [
    AppComponent,
    FooterComponent,
    FilterPanelComponent,
    HeaderComponent,
    BoardComponent,
    TaskCardComponent,
    CommentsDialogComponent,
    SummaryComponent,
    TaskDetailDialogComponent,
    MonitoringWidgetComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    MatButtonModule,
    MatSidenavModule,
    MatToolbarModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatButtonToggleModule,
    MatCardModule,
    MatInputModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule
],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
