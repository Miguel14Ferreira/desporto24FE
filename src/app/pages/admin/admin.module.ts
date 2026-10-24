import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { AdminDashboardComponent } from '../admin-dashboard/admin-dashboard.component';
import { AdminAuditComponent } from '../admin-audit/admin-audit.component';
import { AdminDisputesComponent } from '../admin-disputes/admin-disputes.component';
import { AdminIdeasComponent } from '../admin-ideas/admin-ideas.component';
import { AdminPlayersComponent } from '../admin-players/admin-players.component';
import { AdminUserReportsComponent } from '../admin-user-reports/admin-user-reports.component';
import { AdminVenueSuggestionsComponent } from '../admin-venue-suggestions/admin-venue-suggestions.component';

const routes: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'statistics', component: AdminAuditComponent },
  // Keep existing links valid while reserving audit-log for a future action history.
  { path: 'audit-log', redirectTo: 'statistics', pathMatch: 'full' },
  { path: 'players', component: AdminPlayersComponent },
  { path: 'attendance-disputes', component: AdminDisputesComponent },
  { path: 'ideas', component: AdminIdeasComponent },
  { path: 'venue-suggestions', component: AdminVenueSuggestionsComponent },
  { path: 'reports', component: AdminUserReportsComponent }
];

@NgModule({
  declarations: [
    AdminDashboardComponent,
    AdminAuditComponent,
    AdminDisputesComponent,
    AdminIdeasComponent,
    AdminVenueSuggestionsComponent,
    AdminPlayersComponent,
    AdminUserReportsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    TranslatePipe
  ]
})
export class AdminModule {}
