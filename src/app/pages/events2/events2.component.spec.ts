import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Events2Component } from './events2.component';

describe('Events2Component', () => {
  let component: Events2Component;
  let fixture: ComponentFixture<Events2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Events2Component ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(Events2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
