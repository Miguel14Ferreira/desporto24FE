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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { CreateaccountComponent } from './pages/createaccount/createaccount.component';
import { Events2Component } from './pages/events2/events2.component';
import { AlterardadosComponent } from './pages/alterardados/alterardados.component';
import { ChangepasswordComponent } from './pages/changepassword/changepassword.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ContactComponent } from './pages/contact/contact.component';
import { ForgotpComponent } from './pages/forgotp/forgotp.component';
import { AuthInterceptor } from './auth.interceptor';
import { AuthenticationGuard } from './guard/authentication.guard';
import { PerfisComponent } from './pages/perfis/perfis.component';
import { AuthenticationService } from './services/authethication.service';
import { AboutComponent } from './pages/about/about.component';
import { Forgotp2Component } from './pages/forgotp2/forgotp2.component';
import { ConfirmTokenRegistrationComponent } from './pages/confirm-token-registration/confirm-token-registration.component';
import { PerfilDataComponent } from './pages/perfil-data/perfil-data.component';
import { LoginMFAComponent } from './pages/login-mfa/login-mfa.component';
import { SessionDetailsComponent } from './pages/session-details/session-details.component';
import { MySessionsComponent } from './pages/my-sessions/my-sessions.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { FriendsComponent } from './pages/friends/friends.component';
import { DirectChatComponent } from './pages/direct-chat/direct-chat.component';
import { AdminDisputesComponent } from './pages/admin-disputes/admin-disputes.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { GoogleOnboardingComponent } from './pages/google-onboarding/google-onboarding.component';
import { CommunitiesComponent } from './pages/communities/communities.component';
import { CommunityCreateComponent } from './pages/community-create/community-create.component';
import { AdminIdeasComponent } from './pages/admin-ideas/admin-ideas.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { SocialFeedComponent } from './pages/social-feed/social-feed.component';
import { DiscoverComponent } from './pages/discover/discover.component';
import { VenueDetailsComponent } from './pages/venue-details/venue-details.component';
import { TranslatePipe } from './i18n/translate.pipe';

@NgModule({ declarations: [
        AppComponent,
        AboutComponent,
        NavbarComponent,
        FooterComponent,
        HomeComponent,
        EventsComponent,
        LoginComponent,
        MenuComponent,
        LoginMFAComponent,
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
        SessionDetailsComponent,
        MySessionsComponent,
        NotificationsComponent,
        FriendsComponent,
        DirectChatComponent,
        AdminDisputesComponent,
        AdminDashboardComponent,
        AdminIdeasComponent,
        GoogleOnboardingComponent,
        CommunitiesComponent,
        CommunityCreateComponent,
        NotFoundComponent,
        SocialFeedComponent,
        DiscoverComponent,
        VenueDetailsComponent,
        TranslatePipe
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        FormsModule,
        ReactiveFormsModule,
        BrowserAnimationsModule], providers: [AuthenticationGuard, AuthenticationService, { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }, provideHttpClient(withXhr(), withInterceptorsFromDi())] })
export class AppModule { }
