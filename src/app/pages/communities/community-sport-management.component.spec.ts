import { TestBed } from '@angular/core/testing';
import { CommunitySportManagementComponent } from './community-sport-management.component';

describe('CommunitySportManagementComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [CommunitySportManagementComponent]}).compileComponents();
  });
  async function render(values: {
    sports?: string[]; canManage?: boolean; editing?: boolean; saving?: boolean;
    draft?: string[]; suggestions?: string[]; search?: string; message?: string
  } = {}) {
    const fixture = TestBed.createComponent(CommunitySportManagementComponent);
    fixture.componentRef.setInput('sports', values.sports ?? ['Futebol', 'Futsal']);
    fixture.componentRef.setInput('canManage', values.canManage ?? false);
    fixture.componentRef.setInput('editing', values.editing ?? false);
    fixture.componentRef.setInput('saving', values.saving ?? false);
    fixture.componentRef.setInput('draft', values.draft ?? ['Futebol']);
    fixture.componentRef.setInput('suggestions', values.suggestions ?? ['Basquetebol']);
    fixture.componentRef.setInput('search', values.search ?? '');
    fixture.componentRef.setInput('message', values.message ?? '');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('shows sports but never editing controls to members', async () => {
    const root = (await render()).nativeElement as HTMLElement;
    expect(Array.from(root.querySelectorAll('.sport-tags .sport-tag')).map(x => x.textContent?.trim()))
      .toEqual(['Futebol','Futsal']);
    expect(root.querySelector('button')).toBeNull();
    expect(root.querySelector('input')).toBeNull();
  });
  it('preserves fallback, management visibility and feedback', async () => {
    const fixture = await render({sports: [], canManage: true, message: 'Guardado'});
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.sport-blank')).not.toBeNull();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Guardado');
    const edit = jasmine.createSpy('edit');
    fixture.componentInstance.editRequested.subscribe(edit);
    root.querySelector<HTMLButtonElement>('.section-heading button')!.click();
    expect(edit).toHaveBeenCalledTimes(1);
  });
  it('emits add/remove and leaves the draft unchanged', async () => {
    const draft = ['Futebol'];
    const fixture = await render({canManage: true, editing: true, draft});
    const root = fixture.nativeElement as HTMLElement;
    const add = jasmine.createSpy('add'), remove = jasmine.createSpy('remove');
    fixture.componentInstance.addRequested.subscribe(add);
    fixture.componentInstance.removeRequested.subscribe(remove);
    root.querySelector<HTMLButtonElement>('.sport-suggestions button')!.click();
    root.querySelector<HTMLButtonElement>('.sport-tag button')!.click();
    expect(add).toHaveBeenCalledOnceWith('Basquetebol');
    expect(remove).toHaveBeenCalledOnceWith('Futebol');
    expect(draft).toEqual(['Futebol']);
  });
  it('preserves search and save/cancel events', async () => {
    const fixture = await render({canManage: true, editing: true});
    const root = fixture.nativeElement as HTMLElement;
    const search = jasmine.createSpy('search'), save = jasmine.createSpy('save'), cancel = jasmine.createSpy('cancel');
    fixture.componentInstance.searchChange.subscribe(search);
    fixture.componentInstance.saveRequested.subscribe(save);
    fixture.componentInstance.cancelRequested.subscribe(cancel);
    const input = root.querySelector<HTMLInputElement>('#edit-community-sports')!;
    input.value = 'Voleibol';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    await fixture.whenStable();
    const buttons = root.querySelectorAll<HTMLButtonElement>('.sport-edit-actions button');
    buttons[0].click(); buttons[1].click();
    expect(search).toHaveBeenCalledWith('Voleibol');
    expect(save).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('disables all changes during saving', async () => {
    const root = (await render({canManage:true, editing:true, saving:true})).nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('input')?.disabled).toBeTrue();
    expect(Array.from(root.querySelectorAll<HTMLButtonElement>('button')).every(b => b.disabled)).toBeTrue();
  });
});
