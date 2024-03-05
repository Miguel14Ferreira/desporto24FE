import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockaccComponent } from './blockacc.component';

describe('BlockaccComponent', () => {
  let component: BlockaccComponent;
  let fixture: ComponentFixture<BlockaccComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BlockaccComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlockaccComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
