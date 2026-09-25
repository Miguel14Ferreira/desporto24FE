import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Ideia } from 'src/app/ideia';
import { LoginperfilService } from '../../services/loginperfil.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { CustomHttpResponse } from '../custom-http-response';

@Component({
    selector: 'app-contact',
    templateUrl: './contact.component.html',
    styleUrls: ['./contact.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ContactComponent implements OnInit {
  ideia = new Ideia();
  dark!:boolean;
  showLoading!: boolean;
  registerError:boolean =false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1:boolean=false;
  validation!:any;
  refreshing!:boolean;
  constructor(private _service:LoginperfilService) { }

  ngOnInit(): void {
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  saveNewIdea(){
    this.showLoading = true;
    if (this.ideia.name == null || this.ideia.city == null || this.ideia.email == null || this.ideia.problem == null || this.ideia.subject == null) {
      this.showLoading = false;
      this.validation1 = true;
      this.validation = `Ainda tens espaços brancos!`;
    } else if ( this.ideia.gender == ""){
      this.validation1 = true;
      this.showLoading = false;
      this.validation = `Não escolheste nenhum género!`;
    } else {
    this._service.createIdea(this.ideia).subscribe((
      response:HttpResponse<CustomHttpResponse>) =>{
      {
        this.showLoading = false;
        this.registerSuccess = true;
        this.successMessage = response.body?.message;
      }
    },
  
    (errorResponse: HttpErrorResponse) => {
      this.registerError = true;
      this.errorMessage = errorResponse.error.message;
      this.showLoading = false;
    }
  )}
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
  }
