import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

import { AuthenticationService } from '../../services/authethication.service';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class NotFoundComponent implements OnInit {
  destination = '/home';
  actionKey = 'notFound.home';

  constructor(private authenticationService: AuthenticationService) {}

  ngOnInit(): void {
    if (this.authenticationService.hasValidToken()) {
      this.destination = '/menu/feed';
      this.actionKey = 'notFound.feed';
    }
  }
}
