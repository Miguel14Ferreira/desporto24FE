import { Component, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { BehaviorSubject, Observable, Subscription, catchError, map, of, startWith, switchMap } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Token } from '../model/token';

@Component({
  selector: 'app-confirm-token-registration',
  templateUrl: './confirm-token-registration.component.html',
  styleUrls: ['./confirm-token-registration.component.css']
})
export class ConfirmTokenRegistrationComponent implements OnInit {
  perfil = new Perfil();
  showScreen!: boolean;
  showScreen2! :boolean;
  showScreen3! :boolean;
  username!: string;
  password!: string;
  showLoading!: boolean;
  token!: any;
  token2!: any;
  email!: string;
  fileName!: string;
  profileImage!: File;
  subscriptions: Subscription[] = [];
  dark!:boolean;
  private readonly ACCOUNT_KEY: string = 'token' ;
  constructor(private router:Router,  private authservice:AuthenticationService, private loginService:LoginperfilService, private activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.showScreen = true;
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.activatedRoute.paramMap.subscribe(
      (params: ParamMap) => {
        this.token = params.get(this.ACCOUNT_KEY);
      }
      )
      this.showLoading = true;
    this.subscriptions.push(
    this.authservice.activatePerfil(this.token).subscribe(
      (response: Token) => {
        console.log(response);
        this.showLoading = false;
        this.showScreen2 = true;
        this.showScreen = false;
      },
      (errorResponse: HttpErrorResponse) => {
        console.log(errorResponse);
        this.showScreen = false;
        this.showLoading = false;
        this.showScreen3 = true;
      }
    )
    )
  }

  goToLogin(){
    this.router.navigate(['/login']);
  }
}


