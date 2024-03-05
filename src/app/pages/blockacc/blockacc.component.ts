import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-blockacc',
  templateUrl: './blockacc.component.html',
  styleUrls: ['./blockacc.component.css']
})
export class BlockaccComponent {
  dark!:boolean;
  constructor(private router:Router) { }

  ngOnInit(): void {
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  goToLogin(){
    this.router.navigate(['/login']);
  }
}
