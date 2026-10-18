import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { AdminDashboardComponent } from '../admin-dashboard/admin-dashboard.component';
import { AdminDisputesComponent } from '../admin-disputes/admin-disputes.component';
import { AdminIdeasComponent } from '../admin-ideas/admin-ideas.component';
import { AdminPlayersComponent } from '../admin-players/admin-players.component';
import { AdminUserReportsComponent } from '../admin-user-reports/admin-user-reports.component';

const routes: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'players', component: AdminPlayersComponent },
  { path: 'statistics', component: AdminDashboardComponent, data: { statisticsPage: true } },
  { path: 'attendance-disputes', component: AdminDisputesComponent },
  { path: 'ideas', component: AdminIdeasComponent },
  { path: 'reports', component: AdminUserReportsComponent }
];

@NgModule({
  declarations: [
    AdminDashboardComponent,
    AdminDisputesComponent,
    AdminIdeasComponent,
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
