import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Forgotp2Component } from './forgotp2.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('Forgotp2Component', () => {
  let component: Forgotp2Component;
  let fixture: ComponentFixture<Forgotp2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ Forgotp2Component ],
      imports: TEST_IMPORTS,
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(Forgotp2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});