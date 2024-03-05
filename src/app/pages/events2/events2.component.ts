import { Component, OnInit } from '@angular/core';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Session } from '../session';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, ParamMap } from '@angular/router';

@Component({
  selector: 'app-events2',
  templateUrl: './events2.component.html',
  styleUrls: ['./events2.component.css']
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
  private readonly USERNAME:string = "username";

  constructor(private loginPerfilService: LoginperfilService, private authenticationService: AuthenticationService, private activatedRoute:ActivatedRoute) { }
  url = './assets/estadio.jpg';

  ngOnInit(): void {
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
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
        alert(`Ainda tens espaços em branco!`)
    } else if (this.session.foto == ""){
      alert(`Terás de colocar uma fotografia do local, os jogadores tem que saber onde irão jogar!`)
    } else {
    const formData = this.loginPerfilService.createSessionForm(this.session, this.profileImage);
    this.showLoading = true;
    this.subscriptions.push(
      this.loginPerfilService.createSession(formData).subscribe(
        (response: Session) => {
          this.showLoading = false;
          alert(`Está criada a tua nova sessão`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro`);
          this.showLoading = false;
        }
      )
    );
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
  toogleTag(){
    this.showMe=!this.showMe
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
    console.log(this.minDate);
  }
  values:any
  onChange(values:any){
    var todate:any = new Date();
    var selectDate:any = new Date(values)
    if (todate > selectDate){
      alert("Não podes escolher uma data que já passou")
    }
    console.log(selectDate);
  }
}
