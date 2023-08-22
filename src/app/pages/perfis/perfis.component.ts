import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Perfil } from '../model/perfil';
import { AuthenticationService } from 'src/app/services/authethication.service';


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

  constructor (private loginPerfilService: LoginperfilService, private authenticationService: AuthenticationService){}

  ngOnInit(): void{
    this.selectedPerfil = this.authenticationService.getPerfilFromLocalCache();
    this.show = true;
    if (this.selectedPerfil.notLocked == true){
      this.locked = false
    } else {
      this.locked = true
    }
  }

  changeTitle(title: string): void{
    this.titleSubject.next(title);
  }

  fecharPerfil(){
    this.show = false;
  }

  obterPerfis(showNotification: boolean): void{
    this.refreshing = true;
    this.subscriptions.push(
      this.loginPerfilService.obterPerfis().subscribe(
        (response: Perfil[]) => {
          this.refreshing = false;
          this.loginPerfilService.addPerfisToLocalCache(response);
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
    const results: Perfil[] = [];
    for (const perfil of this.loginPerfilService.getPerfisFromLocalCache()) {
      if (perfil.username.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1 ||
          perfil.fullName.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1){
      results.push(perfil);
      }
    }
    this.perfis = results;
    if(results.length === 0 || !searchTerm){
      this.perfis = this.loginPerfilService.getPerfisFromLocalCache();
    }
  }
}
