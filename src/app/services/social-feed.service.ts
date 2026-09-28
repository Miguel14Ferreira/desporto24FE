import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { FeedItem } from '../pages/model/feed-item';

@Injectable({
  providedIn: 'root'
})
export class SocialFeedService {
  private readonly baseUrl = environment.apiUrl + '/api/feed';

  constructor(private http: HttpClient) {}

  feed(): Observable<FeedItem[]> {
    return this.http.get<FeedItem[]>(this.baseUrl);
  }

  createPost(content: string): Observable<FeedItem> {
    return this.http.post<FeedItem>(
      this.baseUrl + '/posts',
      { content }
    );
  }

  deletePost(postId: number): Observable<void> {
    return this.http.delete<void>(
      this.baseUrl + '/posts/' + postId
    );
  }
}
