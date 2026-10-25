import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { VenueCreateComponent } from './venue-create.component';

// Keep this feature out of the public application's initial JavaScript bundle.
@NgModule({
  declarations: [VenueCreateComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    RouterModule.forChild([{ path: '', component: VenueCreateComponent }])
  ]
})
export class VenueCreateModule {}
