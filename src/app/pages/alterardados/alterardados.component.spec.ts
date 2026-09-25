import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlterardadosComponent } from './alterardados.component';
import { TEST_PROVIDERS } from '../../testing/test-providers';

describe('AlterardadosComponent', () => {
  let component: AlterardadosComponent;
  let fixture: ComponentFixture<AlterardadosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AlterardadosComponent ],
      providers: TEST_PROVIDERS
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AlterardadosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
