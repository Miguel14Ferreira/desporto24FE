import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmationNewFriendComponent } from './confirmation-new-friend.component';

describe('ConfirmationNewFriendComponent', () => {
  let component: ConfirmationNewFriendComponent;
  let fixture: ComponentFixture<ConfirmationNewFriendComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ConfirmationNewFriendComponent ]
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
