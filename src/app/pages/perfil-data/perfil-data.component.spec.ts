import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PerfilDataComponent } from './perfil-data.component';

describe('PerfilDataComponent', () => {
  let component: PerfilDataComponent;
  let fixture: ComponentFixture<PerfilDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PerfilDataComponent ]
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
