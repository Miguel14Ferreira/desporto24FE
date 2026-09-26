import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from './pages/about/about.component';
import { AlterardadosComponent } from './pages/alterardados/alterardados.component';
import { ChangepasswordComponent } from './pages/changepassword/changepassword.component';
import { ContactComponent } from './pages/contact/contact.component';
import { CreateaccountComponent } from './pages/createaccount/createaccount.component';
import { EventsComponent } from './pages/events/events.component';
import { Events2Component } from './pages/events2/events2.component';
import { ForgotpComponent } from './pages/forgotp/forgotp.component';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { PerfisComponent } from './pages/perfis/perfis.component'; 
import { Forgotp2Component } from './pages/forgotp2/forgotp2.component';
import { ConfirmTokenRegistrationComponent } from './pages/confirm-token-registration/confirm-token-registration.component';
import { PerfilDataComponent } from './pages/perfil-data/perfil-data.component';
import { LoginMFAComponent } from './pages/login-mfa/login-mfa.component';
import { SessionDetailsComponent } from './pages/session-details/session-details.component';
import { MySessionsComponent } from './pages/my-sessions/my-sessions.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { FriendsComponent } from './pages/friends/friends.component';
import { DirectChatComponent } from './pages/direct-chat/direct-chat.component';
import { AuthenticationGuard } from './guard/authentication.guard';
import { AdminGuard } from './guard/admin.guard';
import { AdminDisputesComponent } from './pages/admin-disputes/admin-disputes.component';

const routes: Routes = [
  {path:'', redirectTo:'home',pathMatch:'full'},
  {path:'home',component:HomeComponent},
  {path:'about',component:AboutComponent},
  {path:'contact',component:ContactComponent},
  {path:'menu/events/menu',redirectTo:'/menu', pathMatch:'full'},
  {path:'menu/my-sessions',component:MySessionsComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/events/:id',component:SessionDetailsComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/events',component:EventsComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/login',redirectTo:'/login', pathMatch:'full'},
  {path:'login',component:LoginComponent},
  {path:'login/registerNewUser',component:CreateaccountComponent},
  {path:'menu/createEvent',component:Events2Component,canActivate:[AuthenticationGuard]},
  {path:'menu/createEvent/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'login/registerNewUser/login', redirectTo:'login',pathMatch:'full'},
  {path:'menu/alterardados',component:AlterardadosComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/alterardados/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'menu/alterarPassword/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'menu/alterarPassword', component:ChangepasswordComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/createEvents',component:Events2Component,canActivate:[AuthenticationGuard]},
  {path:'menu/createEvents/menu',redirectTo:'menu',pathMatch:'full'},
  {path:'login/resetPassword',component:ForgotpComponent},
  {path:'menu/perfis',component:PerfisComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/perfis/menu',redirectTo:'menu',pathMatch:'full'},
  {path:'login/resetPassword/:token',component:Forgotp2Component, pathMatch:'full'},
  {path:'login/resetPassword/:token/:username',component:Forgotp2Component, pathMatch:'full'},
  {path:'login/registerNewUser/confirmTokenRegistration/:token', component:ConfirmTokenRegistrationComponent, pathMatch:'full'},
  {path:'menu/dadosPerfil',component:PerfilDataComponent,canActivate:[AuthenticationGuard], pathMatch:'full'},
  {path:'menu/dadosPerfil/menu',redirectTo:'menu',pathMatch:'full'},  
  {path:'menu/dadosPerfil/alterardados',redirectTo:'menu/alterardados',pathMatch:'full'},
  {path:'login/MFAauthentication/:username', component: LoginMFAComponent},
  {path:'menu', component:MenuComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/friendList',component:FriendsComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/friendList/chat/:username',component:DirectChatComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/friendList/chat/:username1/:username2',component:DirectChatComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/notifications',component:NotificationsComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/notifications/:id',component:NotificationsComponent,canActivate:[AuthenticationGuard]},
  {path:'menu/admin/attendance-disputes',component:AdminDisputesComponent,canActivate:[AuthenticationGuard,AdminGuard]},
  {path:'menu/terminarSessao',redirectTo:'menu',pathMatch:'full'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
