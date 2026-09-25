import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PerfilDataComponent } from './perfil-data.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('PerfilDataComponent', () => {
  let component: PerfilDataComponent;
  let fixture: ComponentFixture<PerfilDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PerfilDataComponent ],
      imports: TEST_IMPORTS,
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(PerfilDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});