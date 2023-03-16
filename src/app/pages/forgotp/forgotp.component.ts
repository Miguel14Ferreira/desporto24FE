import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgotp',
  templateUrl: './forgotp.component.html',
  styleUrls: ['./forgotp.component.css']
})
export class ForgotpComponent implements OnInit {

  constructor(private router:Router) { }

  ngOnInit(): void {
  }
  goToLogin(){
    this.router.navigate(['/login']);
  }
  

}
