import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Session } from '../session';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { CustomHttpResponse } from '../custom-http-response';

@Component({
    selector: 'app-events2',
    templateUrl: './events2.component.html',
    styleUrls: ['./events2.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class Events2Component implements OnInit {
  session:Session = new Session();
  perfil!:Perfil;
  buttonDisabled: boolean = false;
  showMe:boolean = false;
  showMe2:boolean = false;
  showMe3:boolean = false;
  fileName!: string;
  showLoading:boolean = false;
  profileImage!: File;
  response: any = null;
  subscriptions: Subscription [] = [];
  changetype:boolean = true;
  visible:boolean = true;
  hidden:boolean = true;
  password!: string;
  token: any;
  dark!:boolean;
  username!:any;
  minDate!:any;
  value:string = "Outro";
  registerError:boolean =false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1!:boolean;
  validation!:string;
  private readonly USERNAME:string = "username";

  constructor(private loginPerfilService: LoginperfilService, private authenticationService: AuthenticationService, private activatedRoute:ActivatedRoute) { }
  url = './assets/estadio.jpg';

  ngOnInit(): void {
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log(error));
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.Date();
  }

  public onCreatingNewSession(): void {
    if (this.session.desporto== "" || this.session.dataDeJogo== "" || this.session.jogadores== "" || this.session.jogadores== "" || this.session.localidade== "" || this.session.morada== ""){
      this.validation1 = true;
      this.validation = `Ainda tens espaços em branco`;
    } else if (this.session.foto == ""){
      this.validation1 = true;
      this.validation = `Terás de colocar uma fotografia do local, os jogadores tem que saber onde irão jogar!`;
    } else {
    const formData = this.loginPerfilService.createSessionForm(this.session, this.profileImage);
    this.showLoading = true;
    this.subscriptions.push(
      this.loginPerfilService.createSession(formData).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.showLoading = false;
          this.registerSuccess = true;
        this.registerError = false;
        this.validation1 = false;
        this.successMessage = response.body?.message
        },
        (errorResponse: HttpErrorResponse) => {
          this.errorMessage = errorResponse.error.message;
          this.showLoading = false;
          this.registerError = true;
          this.registerSuccess = false;
          this.validation1 = false;
        }
      )
    );
  }
}

Other(){
  if (this.session.desporto == 'Outro'){
    this.showMe = true;
  } else {
    this.showMe = false;
  }
}

public onSessionImageChange(e: any) {
  if(e.target.files){
  this.fileName = e.target.files[0].name;    
  this.profileImage = e.target.files[0];
    var reader = new FileReader();
    reader.readAsDataURL(e.target.files[0]);
    reader.onload=(event:any)=>{
      this.url=event.target.result;
    }
} 
}
  toogleTag2(){
    this.showMe2=!this.showMe2
  }
  toogleTag3(){
    this.showMe3=!this.showMe3
  }
  Date(){
    var date:any = new Date();
    var toDate:any = date.getDate();
    if (toDate < 10){
      toDate = '0' + toDate;
    }
    var month = date.getMonth() + 1;
    if (month < 10){
      month = '0' + month;
    }
    var year = date.getFullYear();
    var hours:any = date.getHours();
    var minutes:any = date.getMinutes();
    this.minDate = year + "-" + month + "-" + toDate + "T" + hours + ":" + minutes
  }
  values:any
  onChange(values:any){
    var todate:any = new Date();
    var selectDate:any = new Date(values)
    if (todate > selectDate){
      this.validation1 = true;
      this.validation = `Não podes escolher uma data que já passou`;
    }
  }

  closeError(){
    this.registerError = false;
  }
  closeSuccess(){
    this.registerSuccess = false;
  }
  closeValidation(){
    this.validation1 = false;
  }
}
