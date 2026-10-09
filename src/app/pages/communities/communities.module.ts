import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityCreateComponent } from '../community-create/community-create.component';
import { CommunitiesComponent } from './communities.component';

const routes: Routes = [
  { path: '', component: CommunitiesComponent },
  { path: 'create', component: CommunityCreateComponent },
  { path: ':id', component: CommunitiesComponent }
];

@NgModule({
  declarations: [CommunitiesComponent, CommunityCreateComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), TranslatePipe]
})
export class CommunitiesModule {}
