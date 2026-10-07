import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { SessionDetailsComponent } from './session-details.component';

const routes: Routes = [
  { path: '', component: SessionDetailsComponent }
];

@NgModule({
  declarations: [SessionDetailsComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule.forChild(routes), TranslatePipe]
})
export class SessionDetailsModule {}
