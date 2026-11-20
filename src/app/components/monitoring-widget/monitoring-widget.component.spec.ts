import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonitoringWidgetComponent } from './monitoring-widget.component';

describe('MonitoringWidgetComponent', () => {
  let component: MonitoringWidgetComponent;
  let fixture: ComponentFixture<MonitoringWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MonitoringWidgetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonitoringWidgetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
