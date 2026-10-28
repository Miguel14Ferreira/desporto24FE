import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface JynloSelectOption {
  value: string;
  label: string;
}

/**
 * Reusable searchable premium select. Implements the Angular forms contract so
 * registration and profile fields retain their exact persisted string values.
 * Never translates labels into values or changes required/disabled semantics.
 */
@Component({
  selector: 'app-jynlo-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jynlo-select.component.html',
  styleUrls: ['./jynlo-select.component.css'],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => JynloSelectComponent), multi: true}]
})
export class JynloSelectComponent implements ControlValueAccessor {
  @Input() options: readonly JynloSelectOption[] = [];
  @Input() placeholder = 'Selecionar';
  @Input() ariaLabel = '';
  @Input() searchable = false;
  @Input() invalid = false;
  @Input() required = false;
  // NgModel owns the [disabled] input and calls setDisabledState() through
  // ControlValueAccessor. A second @Input('disabled') on this component can
  // race the NgModel directive and incorrectly leave the trigger enabled.
  disabled = false;
  @Input() accent: 'teal' | 'violet' = 'teal';
  @Output() picked = new EventEmitter<string>();

  @ViewChild('root') root?: ElementRef<HTMLElement>;
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('filterInput') filterInput?: ElementRef<HTMLInputElement>;
  @ViewChildren('optionButton') optionButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  private static nextId = 0;
  readonly listId = 'jynlo-select-list-' + (++JynloSelectComponent.nextId);
  value = '';
  open = false;
  query = '';

  private change: (value: string) => void = () => {};
  private touched: () => void = () => {};

  writeValue(value: unknown): void {
    this.value = typeof value === 'string' ? value : (value == null ? '' : String(value));
  }
  registerOnChange(fn: (value: string) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    if (disabled) this.close();
  }

  get selected(): JynloSelectOption | undefined {
    return this.options.find(option => option.value === this.value);
  }

  get visibleOptions(): readonly JynloSelectOption[] {
    const normalized = (value: string) => value.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const filter = normalized(this.query.trim());
    return filter
      ? this.options.filter(option => normalized(option.label).includes(filter))
      : this.options;
  }

  toggle(): void {
    if (this.disabled) return;
    if (this.open) { this.close(); return; }
    this.open = true;
    this.query = '';
    if (this.searchable) {
      setTimeout(() => { if (this.open) this.filterInput?.nativeElement.focus(); }, 0);
    }
  }

  choose(value: string): void {
    if (this.disabled) return;
    this.value = value;
    this.change(value);
    this.picked.emit(value);
    this.touched();
    this.close();
    this.trigger?.nativeElement.focus();
  }

  close(): void {
    this.open = false;
    this.query = '';
  }

  @HostListener('document:click', ['$event'])
  outsideClick(event: MouseEvent): void {
    if (this.open && !this.root?.nativeElement.contains(event.target as Node)) {
      this.close();
      this.touched();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  escape(event: Event): void {
    if (!this.open) return;
    event.preventDefault();
    this.close();
    this.touched();
    this.trigger?.nativeElement.focus();
  }

  triggerKey(event: KeyboardEvent): void {
    if (this.disabled || !['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (!this.open) this.toggle();
    if (!this.searchable) {
      setTimeout(() => {
        const buttons = this.optionButtons?.toArray() || [];
        (event.key === 'ArrowUp' ? buttons[buttons.length - 1] : buttons[0])?.nativeElement.focus();
      }, 0);
    }
  }

  searchKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    this.optionButtons?.first?.nativeElement.focus();
  }

  optionKey(event: KeyboardEvent, index: number): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = this.optionButtons?.toArray() || [];
    if (!buttons.length) return;
    event.preventDefault();
    buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]
      .nativeElement.focus();
  }
}
