import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClasseventsComponent } from './classevents.component';

describe('ClasseventsComponent', () => {
  let component: ClasseventsComponent;
  let fixture: ComponentFixture<ClasseventsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClasseventsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClasseventsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
