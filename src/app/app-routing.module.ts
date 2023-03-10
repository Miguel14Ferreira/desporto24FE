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
import { PerfisComponent } from './perfis/perfis.component'; 

const routes: Routes = [
  {path:'',component:HomeComponent},
  {path:'about',component:AboutComponent},
  {path:'contacts',component:ContactComponent},
  {path:'menu/events',component:EventsComponent},
  {path:'menu/events/menu',redirectTo:'/menu', pathMatch:'full'},
  {path:'menu/login',redirectTo:'/login', pathMatch:'full'},
  {path:'login',component:LoginComponent},
  {path:'menu',component:MenuComponent},
  {path:'login/registerNewUser',component:CreateaccountComponent},
  {path:'menu/createvent',component:CreateventComponent},
  {path:'login/registerNewUser/login', redirectTo:'login',pathMatch:'full'},
  {path:'menu/alterardados/:id',component:AlterardadosComponent},
  {path:'menu/alterardados/:id/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'menu/alterarPassword/:id/menu', redirectTo:'menu',pathMatch:'full'},
  {path:'menu/alterarPassword/:id', component:ChangepasswordComponent},
  {path:'menu/events/events2',component:Events2Component},
  {path:'menu/events/events2/events',redirectTo:'events',pathMatch:'full'},
  {path:'login/forgotp',component:ForgotpComponent},
  {path:'menu/perfis',component:PerfisComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
