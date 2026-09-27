import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { MyProfile, UpdateMyProfileRequest } from '../pages/model/my-profile';

@Injectable({
  providedIn: 'root'
})
export class MyProfileService {
  private readonly baseUrl = environment.apiUrl + '/api/profile/me';

  constructor(private http: HttpClient) {}

  get(): Observable<MyProfile> {
    return this.http.get<MyProfile>(this.baseUrl);
  }

  update(request: UpdateMyProfileRequest, photo?: File): Observable<MyProfile> {
    const formData = new FormData();
    formData.append(
      'profile',
      new Blob([JSON.stringify(request)], { type: 'application/json' })
    );

    if (photo) {
      formData.append('photo', photo);
    }

    return this.http.put<MyProfile>(this.baseUrl, formData);
  }

  updatePhoto(photo: File): Observable<MyProfile> {
    const formData = new FormData();
    formData.append('photo', photo);

    return this.http.put<MyProfile>(
      this.baseUrl + '/photo',
      formData
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<unknown> {
    return this.http.put(
      this.baseUrl + '/password',
      { currentPassword, newPassword }
    );
  }
}
