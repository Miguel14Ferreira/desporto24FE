import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityStanding } from '../model/community-group';
import { communityComparisonKey } from './community-player-comparison';

interface PlayerChoice {
  key: string;
  row: CommunityStanding;
  index: number;
}

/**
 * A reusable-looking but deliberately scoped picker for community player
 * comparison. Keep index-based identities, including unlinked Excel players.
 * A future global design system can adopt its visual treatment once approved.
 */
@Component({
  selector: 'app-community-compare-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './community-compare-picker.component.html',
  styleUrls: ['./community-compare-picker.component.css']
})
export class CommunityComparePickerComponent {
  @Input() rows: readonly CommunityStanding[] = [];
  @Input() selectedKey = '';
  @Input() label = '';
  @Input() side: 'A' | 'B' = 'A';
  @Output() selectionChange = new EventEmitter<string>();
  @Output() clearRequested = new EventEmitter<void>();

  @ViewChild('root') root?: ElementRef<HTMLElement>;
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('search') search?: ElementRef<HTMLInputElement>;
  @ViewChildren('optionButton') options!: QueryList<ElementRef<HTMLButtonElement>>;

  open = false;
  searchTerm = '';

  get selection(): PlayerChoice | undefined {
    const index = this.rows.findIndex((_, idx) => communityComparisonKey(idx) === this.selectedKey);
    return index < 0 ? undefined : {key:this.selectedKey,row:this.rows[index],index};
  }

  get filteredPlayers(): PlayerChoice[] {
    const fold = (text: string) => text.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const term = fold(this.searchTerm.trim());
    return this.rows.map((row, index) => ({row,index,key:communityComparisonKey(index)}))
      .filter(item => !term || fold(item.row.fullName || item.row.username || '').includes(term));
  }

  playerName(row: CommunityStanding): string {
    return row.fullName || row.username || '#' + row.position;
  }

  toggle(): void {
    if (this.open) { this.close(); return; }
    this.open = true;
    this.searchTerm = '';
    setTimeout(() => this.search?.nativeElement.focus(), 0);
  }

  choose(key: string): void {
    this.selectionChange.emit(key);
    this.close();
  }

  clear(): void {
    this.close();
    this.clearRequested.emit();
  }

  close(): void {
    this.open = false;
    this.searchTerm = '';
  }

  @HostListener('document:click', ['$event'])
  outsideClick(event: MouseEvent): void {
    if (this.open && !this.root?.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  escape(event: Event): void {
    if (!this.open) return;
    event.preventDefault();
    this.close();
    this.trigger?.nativeElement.focus();
  }

  searchKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    this.options?.first?.nativeElement.focus();
  }

  optionKey(event: KeyboardEvent, index: number): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const choices = this.options.toArray();
    choices[(index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]
      ?.nativeElement.focus();
  }
}
