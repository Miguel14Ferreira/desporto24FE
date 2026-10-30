import { TestBed } from '@angular/core/testing';
import { GifChoice } from './gif-picker.client';
import { InboxEmojiGifPickerComponent } from './inbox-emoji-gif-picker.component';

describe('InboxEmojiGifPickerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[InboxEmojiGifPickerComponent]}).compileComponents();
  });
  async function render(inputs: Partial<InboxEmojiGifPickerComponent> = {}) {
    const fixture=TestBed.createComponent(InboxEmojiGifPickerComponent);
    fixture.componentRef.setInput('composerEmojis',['😀','❤️']);
    fixture.componentRef.setInput('gifCategories',[{phrase:'desporto',icon:'⚽'}]);
    for (const [key,value] of Object.entries(inputs)) fixture.componentRef.setInput(key,value);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    return fixture;
  }
  it('retains the native dialog tabs and emoji insertion event, without sending anything',async()=>{
    const f=await render();
    const root=f.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role=tab]').length).toBe(1);
    expect(root.querySelector('[role=tab]')?.getAttribute('aria-selected')).toBe('true');
    const chosen=jasmine.createSpy('emoji');
    f.componentInstance.emojiSelected.subscribe(chosen);
    const items=root.querySelectorAll<HTMLButtonElement>('.inbox-picker-emoji-grid button');
    expect(items.length).toBe(2);
    items[1].click();
    expect(chosen).toHaveBeenCalledOnceWith('❤️');
  });
  it('switches tabs and closes only via separate parent intentions',async()=>{
    const f=await render({attachmentControlsReady:true});
    const change=jasmine.createSpy('tab'),close=jasmine.createSpy('close');
    f.componentInstance.tabSelected.subscribe(change);
    f.componentInstance.closeRequested.subscribe(close);
    const root=f.nativeElement as HTMLElement;
    const tabs=root.querySelectorAll<HTMLButtonElement>('[role=tab]');
    expect(tabs.length).toBe(2);
    tabs[1].click();expect(change).toHaveBeenCalledOnceWith('gif');
    root.querySelector<HTMLButtonElement>('.inbox-picker-close')!.click();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('retains disabled GIF search controls while provider status is unknown',async()=>{
    const f=await render({pickerTab:'gif',attachmentControlsReady:true,gifAvailable:null});
    const root=f.nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('input[name=gifSearch]')?.disabled).toBeTrue();
    expect(root.querySelector<HTMLButtonElement>('.inbox-picker-categories button')?.disabled).toBeTrue();
    expect(root.querySelector('[role=group][aria-label]')).not.toBeNull();
  });
  it('forwards GIF search, category selection, result identity and pagination',async()=>{
    const gif:GifChoice={id:'gif-7',title:'Golo!',previewUrl:'https://media.giphy.com/media/gif-7/giphy.gif',downloadUrl:'https://media.giphy.com/media/gif-7/giphy.gif',size:1000,pageUrl:'https://giphy.com/gifs/gif-7',creator:'GIPHY'};
    const f=await render({pickerTab:'gif',attachmentControlsReady:true,gifAvailable:true,
      gifResults:[gif],gifHasMore:true});
    const q=jasmine.createSpy('query'),cat=jasmine.createSpy('category'),
          selected=jasmine.createSpy('gif'),more=jasmine.createSpy('more');
    f.componentInstance.queryChanged.subscribe(q);
    f.componentInstance.categorySelected.subscribe(cat);
    f.componentInstance.gifSelected.subscribe(selected);
    f.componentInstance.moreRequested.subscribe(more);
    const root=f.nativeElement as HTMLElement;
    const input=root.querySelector<HTMLInputElement>('input[name=gifSearch]')!;
    input.value='final';input.dispatchEvent(new Event('input',{bubbles:true}));
    await f.whenStable();
    expect(q).toHaveBeenCalledWith('final');
    root.querySelector<HTMLButtonElement>('.inbox-picker-categories button')!.click();
    expect(cat).toHaveBeenCalledOnceWith('desporto');
    root.querySelector<HTMLButtonElement>('.inbox-gif-tile-select')!.click();
    expect(selected).toHaveBeenCalledOnceWith(gif);
    root.querySelector<HTMLButtonElement>('.inbox-picker-more')!.click();
    expect(more).toHaveBeenCalledOnceWith(1);
  });
  it('emits GIF upload intent without manipulating files or closing a chat itself',async()=>{
    const f=await render({pickerTab:'gif',attachmentControlsReady:true,gifAvailable:false});
    const spy=jasmine.createSpy('upload');
    f.componentInstance.uploadRequested.subscribe(spy);
    const root=f.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.inbox-picker-footer button')!.click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLInputElement>('input[type=file]')).toBeNull();
  });
});
