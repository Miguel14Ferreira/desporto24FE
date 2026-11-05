import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

type LegalDocument = 'privacy' | 'terms' | 'delete';

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
    const requested = this.route.snapshot.data['document'];
    this.document = requested === 'terms' || requested === 'delete' ? requested : 'privacy';
    this.titleKey = `${this.document}.title`;
    this.introKey = `${this.document}.intro`;

    this.sections = this.document === 'delete'
      ? [
          this.section('inApp'),
          this.section('web'),
          this.section('ownedCommunities'),
          this.section('data'),
          this.section('support')
        ]
      : this.document === 'privacy'
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
