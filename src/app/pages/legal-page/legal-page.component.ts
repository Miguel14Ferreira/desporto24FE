import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

type LegalDocument = 'privacy' | 'terms';

interface LegalSection {
  titleKey: string;
  textKey: string;
}

@Component({
  selector: 'app-legal-page',
  templateUrl: './legal-page.component.html',
  styleUrls: ['./legal-page.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class LegalPageComponent implements OnInit {
  document: LegalDocument = 'privacy';
  titleKey = 'privacy.title';
  introKey = 'privacy.intro';
  sections: LegalSection[] = [];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.document = this.route.snapshot.data['document'] === 'terms' ? 'terms' : 'privacy';
    this.titleKey = `${this.document}.title`;
    this.introKey = `${this.document}.intro`;

    this.sections = this.document === 'privacy'
      ? [
          this.section('controller'),
          this.section('purposes'),
          this.section('location'),
          this.section('retention'),
          this.section('processors'),
          this.section('rights'),
          this.section('security')
        ]
      : [
          this.section('scope'),
          this.section('eligibility'),
          this.section('conduct'),
          this.section('sessions'),
          this.section('moderation'),
          this.section('account'),
          this.section('changes')
        ];
  }

  private section(name: string): LegalSection {
    return {
      titleKey: `${this.document}.${name}.title`,
      textKey: `${this.document}.${name}.text`
    };
  }
}
