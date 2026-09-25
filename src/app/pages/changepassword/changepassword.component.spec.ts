import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChangepasswordComponent } from './changepassword.component';
import { TEST_PROVIDERS } from '../../testing/test-providers';

describe('ChangepasswordComponent', () => {
  let component: ChangepasswordComponent;
  let fixture: ComponentFixture<ChangepasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChangepasswordComponent ],
      providers: TEST_PROVIDERS
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChangepasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
