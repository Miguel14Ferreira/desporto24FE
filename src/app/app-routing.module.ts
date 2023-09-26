import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutComponent } from './pages/about/about.component';
import { AlterardadosComponent } from './pages/alterardados/alterardados.component';
import { ChangepasswordComponent } from './pages/changepassword/changepassword.component';
import { ContactComponent } from './pages/contact/contact.component';
import { CreateaccountComponent } from './pages/createaccount/createaccount.component';
import { CreateventComponent } from './pages/createvent/createvent.component';
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

const routes: Routes = [
  {path:'', redirectTo:'home',pathMatch:'full'},
  {path:'home',component:HomeComponent},
  {path:'about',component:AboutComponent},
  {path:'contact',component:ContactComponent},
  {path:'menu/events',component:EventsComponent},
  {path:'menu/events/menu',redirectTo:'/menu', pathMatch:'full'},
  {path:'menu/login',redirectTo:'/login', pathMatch:'full'},
  {path:'login',component:LoginComponent},
  {path:'menu/:username',component:MenuComponent},
  {path:'login/registerNewUser',component:CreateaccountComponent},
  {path:'menu/createvent',component:CreateventComponent},
  {path:'login/registerNewUser/login', redirectTo:'login',pathMatch:'full'},
  {path:'menu/alterardados',component:AlterardadosComponent},
  {path:'menu/alterardados/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'menu/alterarPassword/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'menu/alterarPassword', component:ChangepasswordComponent},
  {path:'menu/createEvents',component:Events2Component},
  {path:'menu/createEvents/menu',redirectTo:'menu',pathMatch:'full'},
  {path:'login/resetPassword',component:ForgotpComponent},
  {path:'menu/:username/perfis',component:PerfisComponent},
  {path:'menu/:username/perfis/menu',redirectTo:'menu/:username',pathMatch:'full'},
  {path:'login/resetPassword/:token',component:Forgotp2Component, pathMatch:'full'},
  {path:'login/registerNewUser/confirmTokenRegistration/:token', component:ConfirmTokenRegistrationComponent, pathMatch:'full'},
  {path:'confirmEmergencyToken',component:ConfirmEmergencyTokenComponent, pathMatch:'full'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
