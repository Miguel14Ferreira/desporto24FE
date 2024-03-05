import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {

  dark!:boolean;
  escuro:string = "escuro";
  claro:string = "claro";
  constructor(private router:Router,private authService:AuthenticationService) { }

  ngOnInit(): void {
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    }
    
    DarkMode(){
      this.dark = true;
      localStorage.setItem('theme',this.escuro);
      location.reload();
    }
    LightMode(){
      this.dark = false;
      localStorage.setItem('theme',this.claro);
      location.reload();
    }
    remover(){
      this.router.navigate(['login']);
      this.authService.logOut2();
    }
}
