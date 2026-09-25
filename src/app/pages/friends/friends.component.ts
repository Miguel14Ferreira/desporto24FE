import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { FriendSummary } from '../model/friend-summary';
import { CommunityService } from '../../services/community.service';

@Component({
  selector: 'app-friends',
  templateUrl: './friends.component.html',
  styleUrls: ['./friends.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class FriendsComponent implements OnInit {
  friends: FriendSummary[] = [];
  filter = '';
  loading = false;
  errorMessage = '';

  constructor(private communityService: CommunityService) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredFriends(): FriendSummary[] {
    const term = this.filter.trim().toLowerCase();
    if (!term) {
      return this.friends;
    }

    return this.friends.filter(friend =>
      friend.username.toLowerCase().includes(term)
      || (friend.fullName ?? '').toLowerCase().includes(term)
      || (friend.location ?? '').toLowerCase().includes(term)
    );
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.communityService.friends()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: friends => this.friends = friends,
        error: () => {
          this.friends = [];
          this.errorMessage = 'Não foi possível carregar a tua lista de amigos.';
        }
      });
  }

  profileImage(friend: FriendSummary): string | null {
    const path = friend.profilePicUrl;
    if (!path) {
      return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  initials(friend: FriendSummary): string {
    const source = friend.fullName?.trim() || friend.username;
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(value => value.charAt(0).toUpperCase())
      .join('');
  }
}
