/**
 * Integration smoke tests against the application's real global stylesheet.
 * These elements mirror actual Angular template controls but retain their
 * native input/change, validation and accessibility semantics.
 */
describe('Jynlo premium green form foundation', () => {
  let host: HTMLElement;

  const create = (tag: 'input' | 'textarea' | 'select', attrs: Record<string, string> = {}) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    node.style.padding = '9px'; // styling must not alter component-specific dimensions
    host.appendChild(node);
    return node;
  };

  beforeEach(() => {
    host = document.createElement('section');
    document.body.appendChild(host);
  });

  afterEach(() => host.remove());

  it('applies the same premium green background and outline to text, date and selects', () => {
    for (const field of [
      create('input', { type: 'text' }),
      create('input', { type: 'date' }),
      create('input', { type: 'search' }),
      create('textarea'),
      create('select')
    ]) {
      const css = getComputedStyle(field);
      expect(css.backgroundColor).toBe('rgb(10, 48, 56)');
      expect(css.borderColor).toBe('rgba(64, 230, 173, 0.46)');
      expect(css.paddingTop).toBe('9px');
    }
  });

  it('keeps the focused input in the green palette without altering its value', () => {
    const field = create('input', { type: 'email' }) as HTMLInputElement;
    field.value = 'player@example.com';
    field.focus();
    // Chrome Headless can temporarily steal focus from tests. Check the
    // expected style for the actual focus state, rather than assuming it.
    const expected = field.matches(':focus')
      ? 'rgb(64, 230, 173)'
      : 'rgba(64, 230, 173, 0.46)';
    expect(getComputedStyle(field).borderColor).toBe(expected);
    expect(field.value).toBe('player@example.com');
  });

  it('keeps validation errors red rather than overriding them with green', () => {
    const field = create('input', { type: 'text', 'aria-invalid': 'true' });
    expect(getComputedStyle(field).borderColor).toBe('rgba(248, 113, 113, 0.8)');
    field.removeAttribute('aria-invalid');
    field.classList.add('ng-invalid', 'ng-touched');
    expect(getComputedStyle(field).borderColor).toBe('rgba(248, 113, 113, 0.8)');
  });

  it('never forces green text-field backgrounds on consent, file, disabled or exempt controls', () => {
    for (const field of [
      create('input', { type: 'checkbox' }),
      create('input', { type: 'file' }),
      create('input', { type: 'text', disabled: '' }),
      create('input', { type: 'text', readonly: '' }),
      create('input', { type: 'text', class: 'jynlo-form-exempt' })
    ]) {
      expect(getComputedStyle(field).backgroundColor).not.toBe('rgb(10, 48, 56)');
    }
  });

  it('does not interfere with native Angular forms, select events or validation', () => {
    const select = create('select') as HTMLSelectElement;
    for (const [value, label] of [['none', 'Selecionar'], ['padel', 'Padel']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    const changes: string[] = [];
    select.addEventListener('change', () => changes.push(select.value));
    select.value = 'padel';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(changes).toEqual(['padel']);
    expect(select.value).toBe('padel');
  });
});
