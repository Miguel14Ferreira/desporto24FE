import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityCreateComponent } from '../community-create/community-create.component';
import { CommunityInviteStepComponent } from '../community-create/community-invite-step.component';
import { CommunitiesComponent } from './communities.component';

const routes: Routes = [
  { path: '', component: CommunitiesComponent },
  { path: 'create', component: CommunityCreateComponent },
  { path: ':id/invite', component: CommunityInviteStepComponent },
  { path: ':id', component: CommunitiesComponent }
];

@NgModule({
  declarations: [CommunitiesComponent, CommunityCreateComponent, CommunityInviteStepComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), TranslatePipe]
})
export class CommunitiesModule {}
