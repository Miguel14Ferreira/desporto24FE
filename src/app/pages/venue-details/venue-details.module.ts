import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { VenueDetailsComponent } from './venue-details.component';

// Keep this feature out of the public application's initial JavaScript bundle.
@NgModule({
  declarations: [VenueDetailsComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    RouterModule.forChild([{ path: '', component: VenueDetailsComponent }])
  ]
})
export class VenueDetailsModule {}
