import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Events2Component } from './events2.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('Events2Component', () => {
  let component: Events2Component;
  let fixture: ComponentFixture<Events2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Events2Component ],
      imports: TEST_IMPORTS,
      providers: TEST_PROVIDERS
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