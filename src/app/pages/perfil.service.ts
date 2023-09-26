import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { Ideia } from '../ideia';
import { Perfil } from './model/perfil';
import { Session } from './session';
import { environment } from 'src/environments/environment';
import { JwtHelperService } from "@auth0/angular-jwt";

@Injectable({providedIn: 'root'})
export class perfilService{
    private host = environment.apiUrl;

    constructor(private http: HttpClient){}
}