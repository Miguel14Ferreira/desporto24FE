import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './sharepage/navbar/navbar.component';
import { FooterComponent } from './sharepage/footer/footer.component';
import { HomeComponent } from './pages/home/home.component';
import { EventsComponent } from './pages/events/events.component';
import { LoginComponent } from './pages/login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { ClasseventsComponent } from './pages/classevents/classevents.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CreateaccountComponent } from './pages/createaccount/createaccount.component';
import { Events2Component } from './pages/events2/events2.component';
import { AlterardadosComponent } from './pages/alterardados/alterardados.component';
import { ChangepasswordComponent } from './pages/changepassword/changepassword.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ContactComponent } from './pages/contact/contact.component';
import { ForgotpComponent } from './pages/forgotp/forgotp.component';
import { LoginperfilService } from './services/loginperfil.service';
import { AuthInterceptor } from './auth.interceptor';
import { AuthenticationGuard } from './guard/authentication.guard';
import { NotificationModule } from './notification.module';
import { NotificationService } from './services/notification.service';
import { PerfisComponent } from './pages/perfis/perfis.component';
import { AuthenticationService } from './services/authethication.service';
import { AboutComponent } from './pages/about/about.component';
import { Forgotp2Component } from './pages/forgotp2/forgotp2.component';
import { ConfirmTokenRegistrationComponent } from './pages/confirm-token-registration/confirm-token-registration.component';
import { ConfirmEmergencyTokenComponent } from './pages/confirm-emergency-token/confirm-emergency-token.component';
import { PerfilDataComponent } from './pages/perfil-data/perfil-data.component';
import { LoginMFAComponent } from './pages/login-mfa/login-mfa.component';
import { ConfirmationNewFriendComponent } from './pages/confirmation-new-friend/confirmation-new-friend.component';
import { ResetPwEmergencyComponent } from './pages/reset-pw-emergency/reset-pw-emergency.component';

@NgModule({
  declarations: [
    AppComponent,
    AboutComponent,
    NavbarComponent,
    FooterComponent,
    HomeComponent,
    EventsComponent,
    LoginComponent,
    MenuComponent,
    LoginMFAComponent,
    LoginComponent,
    ClasseventsComponent,
    CreateaccountComponent,
    PerfisComponent,
    Events2Component,
    AlterardadosComponent,
    ChangepasswordComponent,
    ContactComponent,
    ForgotpComponent,
    PerfilDataComponent,
    Forgotp2Component,
    ConfirmTokenRegistrationComponent,
    ConfirmEmergencyTokenComponent,
    ConfirmationNewFriendComponent,
    ResetPwEmergencyComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    NotificationModule
  ],
  providers: [NotificationService, AuthenticationGuard, AuthenticationService, LoginperfilService, {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true}],
  bootstrap: [AppComponent]
})
export class AppModule { }
