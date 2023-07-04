import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Perfil } from '../model/perfil';


@Component({
  selector: 'app-perfis',
  templateUrl: './perfis.component.html',
  styleUrls: ['./perfis.component.css']
})
export class PerfisComponent {
  minhaImagem = "assets/sports2.jpg";
  private titleSubject = new BehaviorSubject<String>('Perfis');
  public titleAction$ = this.titleSubject.asObservable();
  public perfis!: Perfil[];
  perfil!: Perfil;
  refreshing!:boolean;
  private subscriptions!: Subscription[];
  selectedPerfil!: Perfil;
  response!: any;

  constructor (private loginPerfilService: LoginperfilService){}

  ngOnInit(): void{
    this.obterPerfis(true);
  }

  changeTitle(title: string): void{
    this.titleSubject.next(title);
  }

  obterPerfis(showNotification: boolean): void{
    this.refreshing = true;
    this.subscriptions.push(
      this.loginPerfilService.obterPerfis().subscribe(
        (response: Perfil[]) => {
          this.loginPerfilService.addPerfisToLocalCache(response);
          this.perfis = response;
        },
        (errorResponse: HttpErrorResponse) => {
          this.refreshing = false;
        }
      )
    )
  }

  onSelectPerfil(selectedPerfil: Perfil):void{
    this.selectedPerfil = selectedPerfil;
    document.getElementById('openPerfilInfo')?.click();
  }
  private clickButton(buttonId: string): void{
    document.getElementById(buttonId)?.click();
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
