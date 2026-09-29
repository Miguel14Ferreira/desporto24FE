import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { FeedItem, PostLikeStatus, SocialComment } from '../pages/model/feed-item';

@Injectable({
  providedIn: 'root'
})
export class SocialFeedService {
  private readonly baseUrl = environment.apiUrl + '/api/feed';

  constructor(private http: HttpClient) {}

  feed(): Observable<FeedItem[]> {
    return this.http.get<FeedItem[]>(this.baseUrl);
  }

  createPost(content: string, image?: File): Observable<FeedItem> {
    if (!image) {
      return this.http.post<FeedItem>(
        this.baseUrl + '/posts',
        { content }
      );
    }

    const formData = new FormData();
    formData.append('content', content);
    formData.append('image', image);

    return this.http.post<FeedItem>(
      this.baseUrl + '/posts',
      formData
    );
  }

  likePost(postId: number): Observable<PostLikeStatus> {
    return this.http.post<PostLikeStatus>(
      this.baseUrl + '/posts/' + postId + '/likes',
      null
    );
  }

  unlikePost(postId: number): Observable<PostLikeStatus> {
    return this.http.delete<PostLikeStatus>(
      this.baseUrl + '/posts/' + postId + '/likes'
    );
  }

  comments(postId: number): Observable<SocialComment[]> {
    return this.http.get<SocialComment[]>(
      this.baseUrl + '/posts/' + postId + '/comments'
    );
  }

  addComment(postId: number, content: string): Observable<SocialComment> {
    return this.http.post<SocialComment>(
      this.baseUrl + '/posts/' + postId + '/comments',
      { content }
    );
  }

  deleteComment(postId: number, commentId: number): Observable<void> {
    return this.http.delete<void>(
      this.baseUrl + '/posts/' + postId + '/comments/' + commentId
    );
  }

  deletePost(postId: number): Observable<void> {
    return this.http.delete<void>(
      this.baseUrl + '/posts/' + postId
    );
  }
}
