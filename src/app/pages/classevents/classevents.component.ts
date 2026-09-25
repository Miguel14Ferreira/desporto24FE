import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-classevents',
    templateUrl: './classevents.component.html',
    styleUrls: ['./classevents.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ClasseventsComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
