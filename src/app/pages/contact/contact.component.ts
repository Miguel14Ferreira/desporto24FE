import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Ideia } from 'src/app/ideia';
import { LoginperfilService } from '../../services/loginperfil.service';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnInit {
  ideia = new Ideia();
  dark!:boolean;
  showLoading!: boolean;
  constructor(private _service:LoginperfilService,private formBuilder: FormBuilder) { }

  ngOnInit(): void {
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  saveNewIdea(){
    if (this.ideia.name == null || this.ideia.city == null || this.ideia.email == null || this.ideia.problem == null || this.ideia.subject == null) {
      alert(`Ainda tens espaços brancos!`)
    } else if ( this.ideia.gender == ""){
      alert(`Não escolheste nenhum género!`)
    } else {
    this._service.createIdea(this.ideia).subscribe( data =>{
      {alert("Foi enviado um mail para o email que colocaste.")}
    },
    error => console.log(error));
  }
}
  }
