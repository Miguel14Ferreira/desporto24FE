import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { Perfil } from '../model/perfil';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { CustomHttpResponse } from '../custom-http-response';


@Component({
    selector: 'app-perfis',
    templateUrl: './perfis.component.html',
    styleUrls: ['./perfis.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PerfisComponent {
  private titleSubject = new BehaviorSubject<String>('Perfis');
  public titleAction$ = this.titleSubject.asObservable();
  public perfis: Perfil[] = [];
  perfil!: Perfil;
  showLoading!:boolean;
  locked!:boolean;
  subscriptions: Subscription[] = [];
  selectedPerfil!: Perfil;
  show!:boolean;
  response!: any;
  buttonId!: any;
  dark!:boolean;
  addFriend!:boolean;
  username!:any;
  private readonly USERNAME:string = 'username';
  showTable!:boolean;
  registerError:boolean=false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1:boolean=false;
  validation!:any;
  showOptions!:boolean;

  constructor (private router:Router,private loginPerfilService: LoginperfilService,private activatedRoute:ActivatedRoute, private authenticationService:AuthenticationService){}

  ngOnInit(): void{
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log(error));
  }

  fecharPerfil(){
    this.show = false;
  }

  AddFriend(){
    this.addFriend = true;
  }
  NaoAdd(){
    this.addFriend = false;
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
  
  SendFriendRequest(){
    const formData = this.loginPerfilService.addFriendFromData(this.perfil.username,this.selectedPerfil.username);
    this.showLoading = true;
    this.subscriptions.push(
      this.loginPerfilService.addFriend(formData).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.showLoading = false;
          this.registerSuccess = true;
          this.successMessage = response.body?.message;
          this.registerError = false;
          this.validation1 = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.registerError = true;
          this.errorMessage = errorResponse.error.message;
          this.validation1 = false;
          this.showLoading = false;
        }
      )
    )
  }

  obterPerfis(searchTerm: string): void{
    if (searchTerm == ""){
      this.validation1 = true;
    this.registerError = false;
    this.validation = `Terás de preencher o campo de pesquisa para pesquisar.`;
    } else  {
    this.showLoading = true;
    this.subscriptions.push(
      this.loginPerfilService.obterPerfis(searchTerm).subscribe(
        (response: Perfil[]) => {
          this.showTable = true;
          this.showLoading = false;
          this.perfis = response;
          if (this.perfis.length == 0){
            this.validation1 = false;
            this.showTable = false
            this.registerError = true;
          this.errorMessage = `Não foi encontrado nenhum perfil com esse nome de utilizador`
          }
        },
        (errorResponse: HttpErrorResponse) => {
          this.validation1 = false;
          this.registerError = false;
          this.errorMessage = errorResponse.error.message;
          this.showLoading = false;
        }
      )
    )
      }
    }
      
  Menu(){
    this.router.navigate([`/menu`]);
  }


  onSelectPerfil(selectedPerfil: Perfil):void{
    this.selectedPerfil = selectedPerfil;
    this.show = true;
    if (this.perfil.username == this.selectedPerfil.username){
      this.showOptions = false;
    } else {
      this.showOptions = true;
    }
  }
}
