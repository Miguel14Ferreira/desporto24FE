import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityCreateComponent } from '../community-create/community-create.component';
import { CommunityInviteStepComponent } from '../community-create/community-invite-step.component';
import { CommunitiesComponent } from './communities.component';
import { ChatReactionsComponent } from '../../shared/chat-reactions/chat-reactions.component';
import { CommunityTournamentsComponent } from './community-tournaments.component';
import { KartingPodiumComponent } from './karting-podium.component';
import { KartingPalmaresComponent } from './karting-palmares.component';
import { KartingRaceTableComponent } from './karting-race-table.component';

const routes: Routes = [
  { path: '', component: CommunitiesComponent },
  { path: 'create', component: CommunityCreateComponent },
  { path: ':id/invite', component: CommunityInviteStepComponent },
  { path: ':id', component: CommunitiesComponent }
];

@NgModule({
  declarations: [
    CommunitiesComponent, CommunityCreateComponent, CommunityInviteStepComponent,
    CommunityTournamentsComponent
  ],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), TranslatePipe, ChatReactionsComponent, KartingPodiumComponent, KartingPalmaresComponent, KartingRaceTableComponent]
})
export class CommunitiesModule {}
