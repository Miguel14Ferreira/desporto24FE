import { TestBed } from '@angular/core/testing';
import { CommunityPhotoCoverComponent } from './community-photo-cover.component';

describe('CommunityPhotoCoverComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommunityPhotoCoverComponent] }).compileComponents();
  });
  function render(options: Partial<CommunityPhotoCoverComponent> = {}) {
    const fixture=TestBed.createComponent(CommunityPhotoCoverComponent);
    fixture.componentRef.setInput('name','Grupo Futebol');
    fixture.componentRef.setInput('initials','GF');
    for (const [key,value] of Object.entries(options)) fixture.componentRef.setInput(key,value);
    fixture.detectChanges();
    return fixture;
  }
  it('keeps accessible full-size cover, show-all backdrop and focus transforms', () => {
    const root=render({photoUrl:'https://example.org/photo.webp',fit:'contain',
      position:'45% 30%',origin:'45% 30%',zoom:'scale(1.3)',showAll:true}).nativeElement as HTMLElement;
    const imgs=root.querySelectorAll<HTMLImageElement>('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute('aria-hidden')).toBe('true');
    expect(imgs[1].alt).toBe('Grupo Futebol');
    expect(imgs[1].style.objectFit).toBe('contain');
    expect(imgs[1].style.objectPosition).toBe('45% 30%');
    expect(imgs[1].style.transform).toBe('scale(1.3)');
  });
  it('keeps initials in a photo-less community without member edit buttons', () => {
    const root=render({photoUrl:null,canManage:false}).nativeElement as HTMLElement;
    expect(root.querySelectorAll('img').length).toBe(0);
    expect(root.querySelector('.community-avatar')?.textContent).toContain('GF');
    expect(root.querySelector('button,input')).toBeNull();
  });
  it('preserves GIF display and animated cover identity', () => {
    const root=render({photoUrl:'https://example.org/cover.gif',animated:true}).nativeElement as HTMLElement;
    expect(root.querySelector('.community-avatar--animated')).not.toBeNull();
    expect(root.querySelectorAll('img').length).toBe(1);
  });
  it('emits distinct upload, crop and remove intentions for managers', () => {
    const f=render({photoUrl:'https://example.org/pic.jpg',canManage:true}),root=f.nativeElement as HTMLElement;
    const upload=jasmine.createSpy('upload'),crop=jasmine.createSpy('crop'),remove=jasmine.createSpy('remove');
    f.componentInstance.photoSelected.subscribe(upload);
    f.componentInstance.adjustRequested.subscribe(crop);
    f.componentInstance.removeRequested.subscribe(remove);
    const buttons=root.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBe(2);
    buttons[0].click();buttons[1].click();
    const input=root.querySelector<HTMLInputElement>('input[type=file]')!;
    input.dispatchEvent(new Event('change'));
    expect(crop).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(input.accept).toContain('image/gif');
  });
  it('blocks upload/edit/delete during persistence without removing the image', () => {
    const root=render({photoUrl:'https://example.org/pic.jpg',canManage:true,updating:true}).nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('input[type=file]')?.disabled).toBeTrue();
    expect(Array.from(root.querySelectorAll<HTMLButtonElement>('button')).every(b=>b.disabled)).toBeTrue();
    expect(root.querySelector('img')).not.toBeNull();
  });
});
