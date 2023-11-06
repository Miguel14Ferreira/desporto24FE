import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Perfil } from '../model/perfil';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { ActivatedRoute, ParamMap } from '@angular/router';


@Component({
  selector: 'app-perfis',
  templateUrl: './perfis.component.html',
  styleUrls: ['./perfis.component.css']
})
export class PerfisComponent {
  private titleSubject = new BehaviorSubject<String>('Perfis');
  public titleAction$ = this.titleSubject.asObservable();
  public perfis: Perfil[] = [];
  perfil!: Perfil;
  refreshing!:boolean;
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

  constructor (private loginPerfilService: LoginperfilService,private activatedRoute:ActivatedRoute){}

  ngOnInit(): void{
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.activatedRoute.paramMap.subscribe(
      (params: ParamMap) => {
        this.username = params.get(this.USERNAME);
      }
      )
    this.loginPerfilService.obterUserPeloUsername1(this.username).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
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
  SendFriendRequest(){
    const formData = this.loginPerfilService.addFriendFromData(this.perfil.username,this.selectedPerfil.username);
    this.refreshing = true;
    console.log(this.perfil.username)
    console.log(this.selectedPerfil.username)
    this.subscriptions.push(
      this.loginPerfilService.addFriend(formData).subscribe(
        (response: Perfil) => {
          this.refreshing = false;
          alert(`Foi enviado um novo pedido de amizade a este utilizador!`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
          this.refreshing = false;
        }
      )
    )
  }

  obterPerfis(showNotification: boolean): void{
    this.refreshing = true;
    this.subscriptions.push(
      this.loginPerfilService.obterPerfis().subscribe(
        (response: Perfil[]) => {
          this.refreshing = false;
          this.loginPerfilService.obterPerfis();
          this.perfis = response;
          alert(`Foram encontrados ${response.length} utilizadores`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
          this.refreshing = false;
        }
      )
    )
  }


  onSelectPerfil(selectedPerfil: Perfil):void{
    this.selectedPerfil = selectedPerfil;
    this.show = true;
  }
  
  procurarPerfis(searchTerm: string): void{
    /*
    const results: Perfil[] = [];
    for (const perfil of this.loginPerfilService.obterPerfis()) {
      if (perfil.username.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1 ||
          perfil.fullName.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1){
      results.push(perfil);
      }
    }
    this.perfis = results;
    if(results.length === 0 || !searchTerm){
      this.perfis = this.loginPerfilService.getPerfisFromLocalCache();
    }
    */
  }
}
