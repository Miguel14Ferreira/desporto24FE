import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Events3Component } from './events3.component';

describe('Events3Component', () => {
  let component: Events3Component;
  let fixture: ComponentFixture<Events3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Events3Component ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(Events3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
