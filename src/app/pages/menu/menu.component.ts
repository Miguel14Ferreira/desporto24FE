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
  amigos!:boolean;
  selectedPerfil!: Perfil;
  selectedNotification!: Notification;
  showNotification!:boolean;
  bloquear!:boolean;
  showNotificationMessage!:boolean;
  showNotificationFriendRequestMessage!:boolean;
  showNotificationUpdatePerfil!:boolean;
  private readonly USERNAME:string = 'username';
  chat!:boolean;
  online!:boolean;
  variable!:ReturnType<typeof setTimeout>;

  constructor(private authenticationService:AuthenticationService,private router:Router,private loginPerfilService: LoginperfilService, private activatedRoute:ActivatedRoute) {
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
    }, error => console.log());
    localStorage.removeItem('tokenMFA');
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }

  fecharPerfil(){
    this.showPerfil = false;
  }
  fecharMensagem(){
    this.showNotificationMessage = false;
    this.showNotificationFriendRequestMessage = false;
    this.showNotificationUpdatePerfil = false;
    window.history.replaceState({},'',`/menu/${this.perfil.username}`)
  }

  bloquearConta(selectedNotification : Notification){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.deleteNotification(selectedNotification.id).subscribe(
        (response: Notification) => {
          this.refreshing = false;
          this.authenticationService.logOut();
          alert(`A tua conta está agora bloqueada. Foi enviado um novo mail para o teu email, pedimos que sigas atentamente as instruções para os próximos passos.`);
          window.history.replaceState({},'',`/menu/${this.perfil.username}`)
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
    this.showPerfil = true;
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
    console.log(this.selectedPerfil.status)
}

  fecharChat(){
    this.chat = false;
    window.history.replaceState({},'',`/menu/friendList`)
    clearInterval(this.variable);
  }

  enviarMensagemChat(chat:Chat){
     chat.texto = this.enviarMensagem.texto;
     this.enviarMensagem.username1 = this.perfil.username
     this.enviarMensagem.username2 = this.selectedPerfil.username;
    this.subscriptions.push(
      this.authenticationService.sendChatMessagem(this.enviarMensagem).subscribe(
        (response: Chat) => {
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
          alert(`Ocorreu um erro a executar a operação`);
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
    this.loginPerfilService.friendList(this.perfil.username).subscribe(
      (response: Perfil[]) => {
        this.perfis = response;
        window.history.replaceState({},'',`/menu/friendList`)
      },
      (errorResponse: HttpErrorResponse) => {
        alert(`Ocorreu um erro a executar a operação`);
      }
    )
  }
  eliminarNotificacao(selectedNotification: Notification){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.deleteNotification(selectedNotification.id).subscribe(
        (response: Notification) => {
          this.refreshing = false;
          alert(`Esta notificação foi eliminada`);
          window.history.replaceState({},'',`/menu`)
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
          this.refreshing = false;
        }
      )
    )
  }
  rejeitarAmigo(selectedNotification: Notification){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.deleteNotification(selectedNotification.id).subscribe(
        (response: Notification) => {
          this.refreshing = false;
          alert(`Rejeitaste o pedido de amizade e esta notificação vai ser eliminada.`);
          window.history.replaceState({},'',`/menu/${this.perfil.username}`)
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
          this.refreshing = false;
        }
      )
    )
  }
  aceitarAmigo(selectedNotification: Notification){
    this.refreshing = true;
    this.subscriptions.push(
      this.authenticationService.acceptFriendRequest(selectedNotification.id,selectedNotification.token).subscribe(
        (response: Notification) => {
          this.refreshing = false;
          alert(`Tens um novo amigo na lista de amizade!`);
          window.history.replaceState({},'',`/menu`)
          location.reload();
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
          this.refreshing = false;
        }
      )
    )
  }
  naoBloquear(){
    this.bloquear = false;
  }
  blockAmigo(){
    this.bloquear = true;
  }
  bloquearAmigo(){
    const formData = this.loginPerfilService.addFriendFromData(this.perfil.username,this.selectedPerfil.username);
    this.refreshing = true;
    this.subscriptions.push(
      this.loginPerfilService.addFriend(formData).subscribe(
        (response: Perfil) => {
          this.refreshing = false;
          alert(`o teu amigo está agora bloqueado.`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
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
        (response: Perfil) => {
          this.authenticationService.logOut();
        this.router.navigate(['login']);
          this.refreshing = false;
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
          this.refreshing = false;
        }
      )
    )
}    
terminarSessao(){
  this.logOut = true;
  this.showPerfil = false;
  window.history.replaceState({},'',`/menu/terminarSessao`)
}
fecharSessao(){
  this.show = false;
}
voltar(){
  this.logOut = false;
  window.history.replaceState({},'',`/menu`)
}

obterSessoes(showNotification: boolean): void{
  this.refreshing = true;
  this.subscriptions.push(
    this.loginPerfilService.obterSessoes().subscribe(
      (response: Session[]) => {
        this.refreshing = false;
        this.sessoes = response;
        alert(`Foram encontrados ${response.length} sessões`);
      },
      (errorResponse: HttpErrorResponse) => {
        alert(`Ocorreu um erro a executar a operação`);
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
      },
      (errorResponse: HttpErrorResponse) => {
        alert(`Ocorreu um erro a executar a operação`);
      }
    )
  )
}
NaoMostrarNotificacoes(){
  this.showNotification = false;
}
}
