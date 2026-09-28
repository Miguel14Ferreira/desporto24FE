import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import {
  CommunityGroup,
  CommunityInvite,
  CommunityRole,
  CommunityVisibility
} from '../model/community-group';
import { CommunityGroupsService } from '../../services/community-groups.service';

@Component({
  selector: 'app-communities',
  templateUrl: './communities.component.html',
  styleUrls: ['./communities.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class CommunitiesComponent implements OnInit {
  communities: CommunityGroup[] = [];
  invites: CommunityInvite[] = [];
  selected?: CommunityGroup;

  creating = false;
  loading = false;
  saving = false;
  errorMessage = '';

  newName = '';
  newDescription = '';
  newSport = '';
  newVisibility: CommunityVisibility = 'PRIVATE';

  inviteUsername = '';
  ownershipUsername = '';

  constructor(private communityService: CommunityGroupsService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = '';

    this.communityService.mine()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: communities => {
          this.communities = communities;
          if (this.selected) {
            this.selected = communities.find(item => item.id === this.selected?.id);
          }
        },
        error: () => this.errorMessage = 'Não foi possível carregar as comunidades.'
      });

    this.communityService.myInvites().subscribe({
      next: invites => this.invites = invites,
      error: () => this.invites = []
    });
  }

  open(community: CommunityGroup): void {
    this.communityService.get(community.id).subscribe({
      next: full => this.selected = full,
      error: () => this.errorMessage = 'Não foi possível abrir a comunidade.'
    });
  }

  create(): void {
    if (!this.newName.trim() || this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.communityService.create({
      name: this.newName.trim(),
      description: this.newDescription.trim() || null,
      sport: this.newSport.trim() || null,
      visibility: this.newVisibility
    })
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: community => {
          this.communities = [community, ...this.communities];
          this.selected = community;
          this.creating = false;
          this.newName = '';
          this.newDescription = '';
          this.newSport = '';
          this.newVisibility = 'PRIVATE';
        },
        error: () => this.errorMessage = 'Não foi possível criar a comunidade.'
      });
  }

  invite(): void {
    if (!this.selected || !this.inviteUsername.trim() || this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.communityService.invite(this.selected.id, this.inviteUsername.trim())
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => this.inviteUsername = '',
        error: error => {
          this.errorMessage = error.error?.message || 'Não foi possível enviar o convite.';
        }
      });
  }

  acceptInvite(invite: CommunityInvite): void {
    this.communityService.acceptInvite(invite.id).subscribe({
      next: community => {
        this.invites = this.invites.filter(item => item.id !== invite.id);
        this.communities = [community, ...this.communities.filter(item => item.id !== community.id)];
        this.selected = community;
      },
      error: () => this.errorMessage = 'Não foi possível aceitar o convite.'
    });
  }

  rejectInvite(invite: CommunityInvite): void {
    this.communityService.rejectInvite(invite.id).subscribe({
      next: () => this.invites = this.invites.filter(item => item.id !== invite.id),
      error: () => this.errorMessage = 'Não foi possível rejeitar o convite.'
    });
  }

  setRole(username: string, role: Exclude<CommunityRole, 'OWNER'>): void {
    if (!this.selected) {
      return;
    }

    this.communityService.updateRole(this.selected.id, username, role).subscribe({
      next: community => {
        this.selected = community;
        this.replaceCommunity(community);
      },
      error: () => this.errorMessage = 'Não foi possível alterar o papel deste membro.'
    });
  }

  removeMember(username: string): void {
    if (!this.selected) {
      return;
    }

    this.communityService.removeMember(this.selected.id, username).subscribe({
      next: () => this.refreshSelected(),
      error: () => this.errorMessage = 'Não foi possível remover o membro.'
    });
  }

  leave(): void {
    if (!this.selected) {
      return;
    }

    const id = this.selected.id;
    this.communityService.leave(id).subscribe({
      next: () => {
        this.communities = this.communities.filter(item => item.id !== id);
        this.selected = undefined;
      },
      error: error => this.errorMessage = error.error?.message || 'Não foi possível sair da comunidade.'
    });
  }

  transferOwnership(): void {
    if (!this.selected || !this.ownershipUsername.trim()) {
      return;
    }

    this.communityService.transferOwnership(
      this.selected.id,
      this.ownershipUsername.trim()
    ).subscribe({
      next: community => {
        this.selected = community;
        this.replaceCommunity(community);
        this.ownershipUsername = '';
      },
      error: error => this.errorMessage = error.error?.message || 'Não foi possível transferir a ownership.'
    });
  }

  canManage(): boolean {
    return this.selected?.myRole === 'OWNER' || this.selected?.myRole === 'ADMIN';
  }

  isOwner(): boolean {
    return this.selected?.myRole === 'OWNER';
  }

  private refreshSelected(): void {
    if (!this.selected) {
      return;
    }

    this.communityService.get(this.selected.id).subscribe({
      next: community => {
        this.selected = community;
        this.replaceCommunity(community);
      }
    });
  }

  private replaceCommunity(community: CommunityGroup): void {
    this.communities = this.communities.map(item =>
      item.id === community.id ? community : item
    );
  }
}
