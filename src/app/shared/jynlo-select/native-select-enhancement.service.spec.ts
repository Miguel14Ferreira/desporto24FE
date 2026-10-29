import { TestBed } from '@angular/core/testing';
import { NativeSelectEnhancementService } from './native-select-enhancement.service';

describe('NativeSelectEnhancementService (global Angular-compatible dropdown)', () => {
  let service: NativeSelectEnhancementService;
  let app: HTMLElement;
  let select: HTMLSelectElement;

  function setOptions(): void {
    select.innerHTML = '';
    const all = document.createElement('option');
    all.value = '0: null'; // the encoded identity used by Angular [ngValue]="null"
    all.textContent = 'Todo o histórico';
    const active = document.createElement('option');
    active.value = '1: 4'; // the encoded identity used by Angular [ngValue]="4"
    active.textContent = 'Época 2026 · Ativa';
    select.append(all, active);
    select.value = '0: null';
  }

  function open(): HTMLElement {
    select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    select.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const menu = document.querySelector<HTMLElement>('.jynlo-native-select__popover');
    expect(menu).not.toBeNull();
    return menu!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NativeSelectEnhancementService);
    app = document.createElement('app-root');
    document.body.appendChild(app);
    select = document.createElement('select');
    select.name = 'season';
    select.style.cssText = 'display:block;width:260px;height:42px;';
    setOptions();
    app.appendChild(select);
    service.start();
  });

  afterEach(() => {
    service.stop();
    app.remove();
  });

  it('turns a native season dropdown into a green list without removing its real select', () => {
    const menu = open();
    expect(menu.getAttribute('role')).toBe('listbox');
    expect(menu.querySelectorAll('.jynlo-native-select__option').length).toBe(2);
    expect(menu.textContent).toContain('Todo o histórico');
    expect(menu.textContent).toContain('Época 2026');
    expect(app.querySelector('select')).toBe(select);
    expect(select.value).toBe('0: null');
    expect(select.classList.contains('jynlo-native-select--open')).toBeTrue();
  });

  it('preserves Angular ngValue identity and emits one input/change on selection', () => {
    const changes: string[] = [];
    const inputs: string[] = [];
    select.addEventListener('change', () => changes.push(select.value));
    select.addEventListener('input', () => inputs.push(select.value));
    const menu = open();
    const options = menu.querySelectorAll<HTMLButtonElement>('.jynlo-native-select__option');
    options[1].click();
    expect(select.value).toBe('1: 4');
    expect(select.selectedIndex).toBe(1);
    expect(changes).toEqual(['1: 4']);
    expect(inputs).toEqual(['1: 4']);
    expect(document.querySelector('.jynlo-native-select__popover')).toBeNull();
  });

  it('does not fire a redundant change when the already selected option is picked', () => {
    const change = jasmine.createSpy('change');
    select.addEventListener('change', change);
    open().querySelector<HTMLButtonElement>('.jynlo-native-select__option')!.click();
    expect(change).not.toHaveBeenCalled();
  });

  it('keeps disabled and exempt selects native without opening an overlay', () => {
    select.disabled = true;
    select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    expect(document.querySelector('.jynlo-native-select__popover')).toBeNull();
    select.disabled = false;
    select.classList.add('jynlo-select-native-exempt');
    select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    expect(document.querySelector('.jynlo-native-select__popover')).toBeNull();
  });

  it('supports dynamically arriving options and preserves the original option selection', async () => {
    const menu = open();
    const third = document.createElement('option');
    third.value = '2: 5';
    third.textContent = 'Época 2027';
    select.appendChild(third);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(menu.querySelectorAll('.jynlo-native-select__option').length).toBe(3);
    const options = menu.querySelectorAll<HTMLButtonElement>('.jynlo-native-select__option');
    options[2].click();
    expect(select.value).toBe('2: 5');
    expect(select.options.length).toBe(3);
  });

  it('handles keyboard Escape without changing or submitting the original form', () => {
    select.focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    select.dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(document.querySelector('.jynlo-native-select__popover')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.querySelector('.jynlo-native-select__popover')).toBeNull();
    expect(select.value).toBe('0: null');
  });

  it('makes large dropdowns searchable, with diacritics-insensitive filtering', () => {
    for (let i = 0; i < 12; i++) {
      const option = document.createElement('option');
      option.value = String(i + 3);
      option.textContent = 'Opção ' + i;
      select.appendChild(option);
    }
    const special = document.createElement('option');
    special.value = 'filtered';
    special.textContent = 'Época histórica';
    select.appendChild(special);
    const menu = open();
    const search = menu.querySelector<HTMLInputElement>('.jynlo-native-select__search')!;
    expect(search).not.toBeNull();
    search.value = 'historica';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const buttons = menu.querySelectorAll<HTMLButtonElement>('.jynlo-native-select__option');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('histórica');
    buttons[0].click();
    expect(select.value).toBe('filtered');
  });

  it('closes on outside pointer press and on route removal', () => {
    open();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(document.querySelector('.jynlo-native-select__popover')).toBeNull();
    open();
    select.remove();
    window.dispatchEvent(new Event('resize'));
    expect(document.querySelector('.jynlo-native-select__popover')).toBeNull();
  });

  it('never enhances multiple selects or explicitly sized listboxes', () => {
    select.multiple = true;
    select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    expect(document.querySelector('.jynlo-native-select__popover')).toBeNull();
    select.multiple = false;
    select.setAttribute('size', '5');
    select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    expect(document.querySelector('.jynlo-native-select__popover')).toBeNull();
  });
});
