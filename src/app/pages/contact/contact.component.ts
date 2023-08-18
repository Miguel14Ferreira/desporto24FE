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
  constructor(private _service:LoginperfilService,private formBuilder: FormBuilder) { }

  ngOnInit(): void {
  }
  saveNewIdea(){
    if (this.ideia.name == null || this.ideia.city == null || this.ideia.email == null || this.ideia.problem == null || this.ideia.gender == "" || this.ideia.subject == null) {
      alert(`Ainda tens espaços brancos!`)
    } else {
    this._service.createIdea(this.ideia).subscribe( data =>{
      {alert("Obrigado pela tua mensagem, iremos tentar responder-te o mais brevemente possível.")}
    },
    error => console.log(error));
  }
}
  }
