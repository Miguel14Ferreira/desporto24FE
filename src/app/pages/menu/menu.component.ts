import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { Perfil } from '../model/perfil';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { Observable, Subscription, interval } from 'rxjs';
import { Session } from '../session';
import { FriendRequest } from '../model/friendRequest';
import { Notification } from '../model/notification';
import { Chat } from '../model/chat';
import { CustomHttpResponse } from '../custom-http-response';
import { Friend } from '../model/friend';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  public sessoes : Session [] = [];
  perfis : Perfil[] = [];
  chats : Chat[] = [];
  enviarMensagem : Chat = new Chat();
  Notifications : Notification[] = []; 
  Notification!: Notification;
  chatFriend:Friend = new Friend();
  fileName!: string;
  profileImage!: File;
  url:any;
  changetype:boolean = true;
  visible:boolean = true;
  username!: any;
  password!: string;
  showLoading!: boolean;
  showImage!: boolean;
  token: any;
  showPerfil!: boolean;
  subscriptions: Subscription[] = [];
  id!:number;
  perfil!:Perfil;
  editPerfil:Perfil = new Perfil();
  refreshing!:boolean;
  public friendList: FriendRequest[] = [];
  friend!: FriendRequest;
  locked!:boolean;
  selectedSessao!: Session;
  subscription!: Subscription;
  show!:boolean;
  buttonId!: any;
  sessao!: Session;
  showMenu!: boolean;
  logOut!:boolean;
  dark!:boolean;
  block!:boolean;
  amigos!:boolean;
  selectedPerfil!: Perfil;
  selectedNotification!: Notification;
  showNotification!:boolean;
  bloquear!:boolean;
  showNotificationMessage!:boolean;
  showNotificationFriendRequestMessage!:boolean;
  showNotificationUpdatePerfil!:boolean;
  chat!:boolean;
  online!:boolean;
  variable!:ReturnType<typeof setTimeout>;
  registerError:boolean =false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1:boolean=false;
  validation!:any;
  showScreen2!:boolean;
  moreThan1Notifications!:boolean;
  desbloquear!:boolean;
  removerAmigo!:boolean;
  newNotification!:boolean;
  emptyFriendList!:boolean;
  public readonly EMPTY_FRIENDLIST: string = 'De momento não tens quaisquer amigos, clica em procurar jogadores para encontrares jogadores para adicioná-los à tua lista de amigos.';
  public readonly EMPTY_NOTIFICATIONS: string = 'De momento não tens quaisquer notificações.';
  public readonly DESPORTO24: string = 'DESPORTO24';
  public readonly FRIENDLIST: string = 'Lista de amigos';
  public readonly CHANGEPROFILEDATA: string = 'Alterar dados do perfil';
  public readonly CHANGEPROFILEPASSWORD: string = 'Alterar nome de utilizador/password';
  public readonly PROFILEDATA: string = 'Ver dados do meu perfil';
  public readonly SEARCH_PLAYERS: string = 'Procurar Utilizadores';
  public readonly CREATE_SESSION: string = 'Criar Sessão';
  public readonly LOG_OFF: string = 'Terminar Sessão';
  public readonly AVAILABLE_SESSIONS: string = 'Sessões disponíveis';
  public readonly GAME_PIC: string = 'Foto do local de jogo';
  public readonly GAME_CREATED_BY: string = 'Jogo criado por';
  public readonly GAME_NUMBER_PLAYERS: string = 'Nº de jogadores';
  public readonly GAME_DATE: string = 'Data de jogo';
  public readonly GAME_LOCAL: string = 'Localidade';

  constructor(private authenticationService:AuthenticationService,private router:Router,private loginPerfilService: LoginperfilService) {
   }


  ngOnInit(): void {
    /*if (this.selectedSessao.private == "true"){
      this.locked = true;
    } else {
      this.locked = false;
    }
    */
    this.authenticationService.isLoggedIn()
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log(error));
    localStorage.removeItem('MFA');
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.loginPerfilService.obterNotificacoesDoPerfil(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.Notifications = data;
      if (this.Notifications.length > 0){
        this.newNotification = true;
      } else {
        this.newNotification = false;
      }
        }, error => console.log(error));
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

  fecharPerfil(){
    this.showPerfil = false;
  }
  fecharMensagem(){
    this.showNotificationMessage = false;
    this.showNotificationFriendRequestMessage = false;
    this.showNotificationUpdatePerfil = false;
    window.history.replaceState({},'',`/menu`)
  }

  bloquearConta(){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.deactivatePerfilEmergency(this.perfil.email).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.refreshing = false;
          this.validation1 = true;
          this.validation = response.body?.message;
          this.authenticationService.logOut();
          this.router.navigateByUrl('menu/blockAcc');
        },
        (errorResponse: HttpErrorResponse) => {
          this.registerError = true;
          this.errorMessage = errorResponse.error.message;
          this.refreshing = false;
        }
      ))
      }

  onSelectPerfil(selectedPerfil: Perfil):void{
    this.selectedPerfil = selectedPerfil;
    this.showPerfil = true;
    this.loginPerfilService.getChat(this.authenticationService.loggedInPerfilname,selectedPerfil.username).subscribe( data => {
      this.chatFriend = data;
      if (this.chatFriend.whoBlocked == this.perfil.username){
        this.block = false;
      } else {
        this.block = true;
      }
    }, error => console.log(error));
  }
  onSelectedNotification(selectedNotification: Notification):void{
    window.history.replaceState({},'',`/menu/notifications/${selectedNotification.id}`)
    this.selectedNotification = selectedNotification;
    if (selectedNotification.normalMessage == true){
    this.showNotificationMessage = true;
    this.showNotificationFriendRequestMessage = false;
    this.showNotificationUpdatePerfil = false;
    } else if(selectedNotification.friendRequest == true){
      this.showNotificationMessage = false;
      this.showNotificationFriendRequestMessage = true;
      this.showNotificationUpdatePerfil = false;
    } else if (selectedNotification.updatePerfil == true){
      this.showNotificationMessage = false;
      this.showNotificationFriendRequestMessage = false;
      this.showNotificationUpdatePerfil = true;
    }
  }
  
  abrirChat(){
    this.chat = true;
    this.amigos = false;
    this.showPerfil = false;
    const sender = this.perfil.username;
    const recipient = this.selectedPerfil.username;
        window.history.replaceState({},'',`/menu/friendList/chat/`+sender+"/"+recipient)
       this.variable = setInterval(() => {
       this.subscriptions.push(
         this.authenticationService.getChat(sender,recipient).subscribe(
           (response: Chat[]) => {
             this.chats = response;
             this.refreshing = false;
            },
           (errorResponse: HttpErrorResponse) => {
            this.registerError = true;
            this.errorMessage = errorResponse.error.message;
             this.refreshing = false;
           }
         )
       )
     },1000);
     if(this.selectedPerfil.status == 'ONLINE'){
      this.online = true;
    } else {
      this.online = false;
    }
}

  fecharChat(){
    this.chat = false;
    window.history.replaceState({},'',`/menu/friendList`)
    clearInterval(this.variable);
  }

  enviarMensagemChat(chat:Chat){
     chat.text = this.enviarMensagem.text;
     this.enviarMensagem.username1 = this.perfil.username
     this.enviarMensagem.username2 = this.selectedPerfil.username;
    this.subscriptions.push(
      this.authenticationService.sendChatMessagem(this.enviarMensagem).subscribe(
        () => {
          this.refreshing = false;
          const sender = this.perfil.username;
          const recipient = this.selectedPerfil.username;
          this.authenticationService.getChat(sender,recipient).subscribe(
            (response: Chat[])=>{
              this.chats = response;
              this.refreshing = false;
              (document.getElementById('mensagensChatEnvio') as HTMLInputElement).value = "";
            }
          )
        },
        (errorResponse: HttpErrorResponse) => {
          this.registerError = true;
          this.errorMessage = errorResponse.error.message;
          this.refreshing = false;
        }
      )
    )
  } 

  NomeUtilizador(){
    return this.perfil.username;
  }
  alterarDados(){
    this.router.navigate([`menu/alterardados`]);
  }
  alterarPassword(){
    this.router.navigate([`menu/alterarPassword`]);
  }
  Utilizadores(){
    this.router.navigate([`menu/perfis`]);
  }
  verDadosPerfil(){
    this.router.navigate([`menu/dadosPerfil`]);
  }
  CriarSessao(){
    this.router.navigate([`menu/createEvent`]);
  }
  Amigos(){
    this.amigos = true;
    this.logOut = false;
    this.loginPerfilService.friendList(this.perfil.username).subscribe(
      (response: Perfil[]) => {
        this.perfis = response;
        window.history.replaceState({},'',`/menu/friendList`)
        if (response.length = 0){
          this.emptyFriendList = true;
        } else {
          this.emptyFriendList = false;
        }
      },
      (errorResponse: HttpErrorResponse) => {
        this.registerError = true;
        this.errorMessage = errorResponse.error.message;
      }
    )
  }
  eliminarNotificacao(selectedNotification: Notification){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.deleteNotification(selectedNotification.id).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.refreshing = false;
          this.successMessage = response.body?.message;
          this.registerSuccess = true;
          this.showNotificationMessage = false;
          this.showNotificationFriendRequestMessage = false;
          this.showNotificationUpdatePerfil = false;
          window.history.replaceState({},'',`/menu`)
        },
        (errorResponse: HttpErrorResponse) => {
          this.registerError = true;
          this.errorMessage = errorResponse.error.message;
          this.refreshing = false;
        }
      )
    )
  }
  rejeitarAmigo(selectedNotification: Notification){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.deleteNotification(selectedNotification.id).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.refreshing = false;
          this.validation1 = true;
          this.validation = response.body?.message;
          this.showNotification = false;
          this.showNotificationFriendRequestMessage = false;
          window.history.replaceState({},'',`/menu/${this.perfil.username}`)
        },
        (errorResponse: HttpErrorResponse) => {
          this.registerError = true;
          this.errorMessage = errorResponse.error.message;
          this.refreshing = false;
        }
      )
    )
  }
  aceitarAmigo(selectedNotification: Notification){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.acceptFriendRequest(selectedNotification.id,selectedNotification.token).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.refreshing = false;
          this.registerSuccess = true;
          this.successMessage = response.body?.message;
          this.showNotification = false;
          this.showNotificationFriendRequestMessage = false;
          window.history.replaceState({},'',`/menu`)
        },
        (errorResponse: HttpErrorResponse) => {
          this.registerError = true;
          this.errorMessage = errorResponse.error.message;
          this.refreshing = false;
        }
      )
    )
  }
  remove(){
    this.removerAmigo = true;
    window.history.replaceState({},'',`/menu/friendList/removeFriend`)
  }
  dontRemove(){
    this.removerAmigo = false;
    window.history.replaceState({},'',`/menu/friendList`)
  }
  removeFriend(){
    const formData = this.loginPerfilService.removeFriendFromData(this.perfil.username,this.selectedPerfil.username);
    this.refreshing = true;
    this.subscriptions.push(
      this.loginPerfilService.removeFriend(formData).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.refreshing = false;
          this.validation1 = true;
          this.validation = response.body?.message;
          this.removerAmigo = false;
          this.amigos = false;
          this.showPerfil = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.errorMessage = errorResponse.error.message;
          this.registerError = true;
          this.refreshing = false;
        }
      )
    )
  }
  naoBloquear(){
    this.bloquear = false;
    window.history.replaceState({},'',`/menu/friendList`)
  }
  naoDesbloquear(){
    this.desbloquear = false;
    window.history.replaceState({},'',`/menu/friendList`)
  }
  blockAmigo(){
    this.bloquear = true;
    window.history.replaceState({},'',`/menu/friendList/blockFriend`)
  }
  unblockAmigo(){
    this.desbloquear = true;
    window.history.replaceState({},'',`/menu/friendList/unblockFriend`)
  }
  bloquearAmigo(){
    const formData = this.loginPerfilService.blockFriendFromData(this.perfil.username,this.selectedPerfil.username);
    this.refreshing = true;
    this.subscriptions.push(
      this.loginPerfilService.blockFriend(formData).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.refreshing = false;
          this.validation1 = true;
          this.validation = response.body?.message;
          this.bloquear = false;
          this.amigos = false;
          this.showPerfil = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.errorMessage = errorResponse.error.message;
          this.registerError = true;
          this.refreshing = false;
        }
      )
    )
  }

  DesbloquearAmigo(){
    const formData = this.loginPerfilService.unblockFriendFromData(this.perfil.username,this.selectedPerfil.username);
    this.refreshing = true;
    this.subscriptions.push(
      this.loginPerfilService.unblockFriend(formData).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.refreshing = false;
          this.validation1 = true;
          this.validation = response.body?.message;
          this.amigos = false;
          this.showPerfil = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.errorMessage = errorResponse.error.message;
          this.registerError = true;
          this.refreshing = false;
        }
      )
    )
  }
  naoMostrarAmigos(){
    this.amigos = false;
    window.history.replaceState({},'',`/menu`)
  }
  remover(){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.terminarSessao(this.perfil).subscribe(
        () => {
          this.authenticationService.logOut();
          this.router.navigate(['login']);
          this.refreshing = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.errorMessage = errorResponse.error.message;
          this.registerError = true;
          this.refreshing = false;
        }
      )
    )
}    
terminarSessao(){
  this.logOut = true;
  this.showPerfil = false;
  this.chat = false;
  this.bloquear = false;
  this.amigos = false;
  window.history.replaceState({},'',`/menu/terminarSessao`)
}
fecharSessao(){
  this.show = false;
}
voltar(){
  this.logOut = false;
  window.history.replaceState({},'',`/menu`)
}

obterSessoes(): void{
  this.refreshing = true;
  this.subscriptions.push(
    this.loginPerfilService.obterSessoes().subscribe(
      (response: Session[]) => {
        this.refreshing = false;
        this.sessoes = response;
        this.validation1 = true;
        this.validation = `Foram encontradas ${response.length} sessões`;
      },
      (errorResponse: HttpErrorResponse) => {
        this.errorMessage = errorResponse.error.message;
          this.registerError = true;
        this.refreshing = false;
      }
    )
  )
}

procurarSessoes(searchTerm: string): void{
  
}

onSelectSessao(selectedSessao: Session):void{
  this.selectedSessao = selectedSessao;
  this.show = true;
}
MostrarMenu(){
  this.showMenu = true;
  this.showNotification = false;
}
NaoMostrarMenu(){
  this.showMenu = false;
  this.showNotification = false;
}
MostrarNotificacoes(){
  this.showNotification = true;
  this.showMenu = false;
  this.subscriptions.push(
    this.loginPerfilService.obterNotificacoesDoPerfil(this.perfil.username).subscribe(
      (response: Notification[]) => {
        this.Notifications = response;
        if (this.Notifications.length > 0){
          this.moreThan1Notifications = false
          this.newNotification = true;
        } else {
          this.moreThan1Notifications = false;
          this.newNotification = false;
        }
      },
      (errorResponse: HttpErrorResponse) => {
        this.errorMessage = errorResponse.error.message;
          this.registerError = true;
      }
    )
  )
}
NaoMostrarNotificacoes(){
  this.showNotification = false;
}
}
