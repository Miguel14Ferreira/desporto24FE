import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { DirectChatComponent } from './direct-chat.component';

const routes: Routes = [
  { path: '', component: DirectChatComponent }
];

@NgModule({
  declarations: [DirectChatComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), TranslatePipe]
})
export class DirectChatModule {}
