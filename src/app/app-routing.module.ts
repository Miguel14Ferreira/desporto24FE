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
  {path:'menu/:username/events',component:EventsComponent},
  {path:'menu/:username/events/menu',redirectTo:'/menu/:username', pathMatch:'full'},
  {path:'menu/login',redirectTo:'/login', pathMatch:'full'},
  {path:'login',component:LoginComponent},
  {path:'login/registerNewUser',component:CreateaccountComponent},
  {path:'menu/:username/createEvent',component:Events2Component},
  {path:'menu/:username/createEvent/menu', redirectTo:'menu/:username',pathMatch:'full'},
  {path:'login/registerNewUser/login', redirectTo:'login',pathMatch:'full'},
  {path:'menu/:username/alterardados',component:AlterardadosComponent},
  {path:'menu/:username/alterardados/menu', redirectTo:'menu/:username',pathMatch:'full'},
  {path:'menu/:username/alterarPassword/menu', redirectTo:'menu/:username',pathMatch:'full'},
  {path:'menu/:username/alterarPassword', component:ChangepasswordComponent},
  {path:'menu/:username/createEvents',component:Events2Component},
  {path:'menu/:username/createEvents/menu',redirectTo:'menu/:username',pathMatch:'full'},
  {path:'login/resetPassword',component:ForgotpComponent},
  {path:'menu/:username/perfis',component:PerfisComponent},
  {path:'menu/:username/perfis/menu',redirectTo:'menu/:username',pathMatch:'full'},
  {path:'login/resetPassword/:token/:username',component:Forgotp2Component, pathMatch:'full'},
  {path:'login/registerNewUser/confirmTokenRegistration/:token', component:ConfirmTokenRegistrationComponent, pathMatch:'full'},
  {path:'confirmEmergencyToken/:token/:username',component:ConfirmEmergencyTokenComponent, pathMatch:'full'},
  {path:'menu/:username/dadosPerfil',component:PerfilDataComponent, pathMatch:'full'},
  {path:'menu/:username/dadosPerfil/menu',redirectTo:'menu/:username',pathMatch:'full'},  
  {path:'menu/:username/dadosPerfil/alterardados',redirectTo:'menu/:username/alterardados',pathMatch:'full'},
  {path:'login/MFAauthentication/:username', component: LoginMFAComponent},
  {path:'menu/:username', component:MenuComponent},
  {path:'login/confirmNewFriend/:token',component:ConfirmationNewFriendComponent},
  {path:'confirmEmergencyToken/resetPassword/:token/:username',component:ResetPwEmergencyComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
