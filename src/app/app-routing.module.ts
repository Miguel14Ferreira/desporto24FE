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
import { ConfirmEmergencyTokenComponent } from './pages/confirm-emergency-token/confirm-emergency-token.component';
import { PerfilDataComponent } from './pages/perfil-data/perfil-data.component';
import { LoginMFAComponent } from './pages/login-mfa/login-mfa.component';
import { ConfirmationNewFriendComponent } from './pages/confirmation-new-friend/confirmation-new-friend.component';
import { ResetPwEmergencyComponent } from './pages/reset-pw-emergency/reset-pw-emergency.component';

const routes: Routes = [
  {path:'', redirectTo:'home',pathMatch:'full'},
  {path:'home',component:HomeComponent},
  {path:'about',component:AboutComponent},
  {path:'contact',component:ContactComponent},
  {path:'menu/events',component:EventsComponent},
  {path:'menu/events/menu',redirectTo:'/menu', pathMatch:'full'},
  {path:'menu/login',redirectTo:'/login', pathMatch:'full'},
  {path:'login',component:LoginComponent},
  {path:'login/registerNewUser',component:CreateaccountComponent},
  {path:'menu/createEvent',component:Events2Component},
  {path:'menu/createEvent/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'login/registerNewUser/login', redirectTo:'login',pathMatch:'full'},
  {path:'menu/alterardados',component:AlterardadosComponent},
  {path:'menu/alterardados/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'menu/alterarPassword/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'menu/alterarPassword', component:ChangepasswordComponent},
  {path:'menu/createEvents',component:Events2Component},
  {path:'menu/createEvents/menu',redirectTo:'menu',pathMatch:'full'},
  {path:'login/resetPassword',component:ForgotpComponent},
  {path:'menu/perfis',component:PerfisComponent},
  {path:'menu/perfis/menu',redirectTo:'menu',pathMatch:'full'},
  {path:'login/resetPassword/:token/:username',component:Forgotp2Component, pathMatch:'full'},
  {path:'login/registerNewUser/confirmTokenRegistration/:token', component:ConfirmTokenRegistrationComponent, pathMatch:'full'},
  {path:'confirmEmergencyToken/:token/:username',component:ConfirmEmergencyTokenComponent, pathMatch:'full'},
  {path:'menu/dadosPerfil',component:PerfilDataComponent, pathMatch:'full'},
  {path:'menu/dadosPerfil/menu',redirectTo:'menu',pathMatch:'full'},  
  {path:'menu/dadosPerfil/alterardados',redirectTo:'menu/alterardados',pathMatch:'full'},
  {path:'login/MFAauthentication/:username', component: LoginMFAComponent},
  {path:'menu', component:MenuComponent},
  {path:'menu/friendList',redirectTo:'menu',pathMatch:'full'},
  {path:'menu/friendList/chat/:username1/:username2',redirectTo:'menu',pathMatch:'full'},
  {path:'menu/notifications/:id',redirectTo:'menu',pathMatch:'full'},
  {path:'menu/terminarSessao',redirectTo:'menu',pathMatch:'full'},
  {path:'login/confirmNewFriend/:token',component:ConfirmationNewFriendComponent},
  {path:'confirmEmergencyToken/resetPassword/:token/:username',component:ResetPwEmergencyComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
