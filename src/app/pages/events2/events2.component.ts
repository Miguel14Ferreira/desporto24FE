import { Component, OnInit } from '@angular/core';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Session } from '../session';

@Component({
  selector: 'app-events2',
  templateUrl: './events2.component.html',
  styleUrls: ['./events2.component.css']
})
export class Events2Component implements OnInit {
  session:Session = new Session();
  buttonDisabled: boolean = false;
  showMe:boolean = false;
  showMe2:boolean = false;
  showMe3:boolean = false;
  desporto = ['Futebol','Basquetbol','Voleibol','Karts','Ténis','Padel','Outro'];
  url='./assets/campo .jpg';

  constructor(private loginPerfilService: LoginperfilService) { }
  ngOnInit(): void {
    this.Date();
    this.session.utilizador == sessionStorage.getItem("name")
  }
  minhaImagem = "./assets/tunel .jpg";
  value = "Outro";
  ObterNomeDeUtilizador(){
    return sessionStorage.getItem("name");
  }
  minDate:any = "2022-02-17T19:33";

  onSubmit(){
    this.createNewSession();
  }
  createNewSession(){
    this.loginPerfilService.createSession(this.session).subscribe( data =>{
      {alert("Está criada agora a tua sessão!")}
    },
    error => console.log(error));
  }
  onSelectedFile(e:any){
    if(e.target.files){
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
