import { Component } from '@angular/core';

@Component({
  selector: 'app-venue-create',
  templateUrl: './venue-create.component.html',
  styleUrls: ['./venue-create.component.css'],
  standalone: false
})
export class VenueCreateComponent {
  name = '';
  city = '';
  address = '';
}
