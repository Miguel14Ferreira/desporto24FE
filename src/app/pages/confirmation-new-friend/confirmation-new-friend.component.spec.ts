import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmationNewFriendComponent } from './confirmation-new-friend.component';
import { TEST_PROVIDERS } from '../../testing/test-providers';

describe('ConfirmationNewFriendComponent', () => {
  let component: ConfirmationNewFriendComponent;
  let fixture: ComponentFixture<ConfirmationNewFriendComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ConfirmationNewFriendComponent ],
      providers: TEST_PROVIDERS
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfirmationNewFriendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
