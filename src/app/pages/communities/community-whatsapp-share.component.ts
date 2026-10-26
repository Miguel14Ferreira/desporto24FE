import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** WhatsApp sharing panel. All permission checks and link/share actions remain with the parent. */
@Component({
  selector: 'app-community-whatsapp-share',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-whatsapp-share.component.html',
  styleUrls: ['./community-whatsapp-share.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityWhatsAppShareComponent {
  @Input() visibility = 'PUBLIC';
  @Input() feedback = '';
  @Output() shareRequested = new EventEmitter<void>();
  @Output() copyRequested = new EventEmitter<void>();
}
