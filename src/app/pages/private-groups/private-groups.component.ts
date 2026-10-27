import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommunityService } from '../../services/community.service';
import { AuthenticationService } from '../../services/authethication.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { PrivateGroup, PrivateGroupMessage, PrivateGroupService } from '../../services/private-group.service';
import { FriendSummary } from '../model/friend-summary';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { appTranslate as t } from '../../i18n/i18n.service';

@Component({
  selector:'app-private-groups',
  standalone:true,
  imports:[CommonModule,FormsModule,RouterLink,TranslatePipe],
  templateUrl:'./private-groups.component.html',
  styleUrls:['./private-groups.component.css'],
  changeDetection:ChangeDetectionStrategy.Eager
})
export class PrivateGroupsComponent implements OnInit,OnDestroy {
  groups:PrivateGroup[]=[];
  friends:FriendSummary[]=[];
  selected:PrivateGroup|null=null;
  messages:PrivateGroupMessage[]=[];
  draft='';
  title='';
  showCreate=false;
  showAdd=false;
  selectedNames=new Set<string>();
  initialFriend='';
  loading=true;
  loadingMessages=false;
  busy=false;
  error='';
  groupError='';
  hasMore=false;
  private currentRequest=0;
  private subscriptions=new Subscription();
  readonly me:string;

  constructor(private api:PrivateGroupService,private contact:CommunityService,
    private realtime:DirectChatRealtimeService,private auth:AuthenticationService,
    private router:Router,private route:ActivatedRoute){
    this.me=(auth.loggedInPerfilname||'').toLowerCase();
  }

  ngOnInit():void{
    this.realtime.connect();
    this.subscriptions.add(this.realtime.groupMessages$.subscribe(message=>{
      if(this.selected?.id===message.groupId && !this.messages.some(old=>old.id===message.id)){
        this.messages=[...this.messages,message];
      }
      this.refreshGroups(false);
    }));
    this.subscriptions.add(this.realtime.groupUpdates$.subscribe(()=>{
      this.refreshGroups(false);
    }));
    this.subscriptions.add(this.route.queryParamMap.subscribe(params=>{
      const from=params.get('from')||'';
      this.initialFriend=from;
      if(from){this.openCreate(from);}
      const id=Number(params.get('id'));
      if(Number.isSafeInteger(id)&&id>0){
        const found=this.groups.find(x=>x.id===id);
        if(found)this.select(found);
      }
    }));
    this.refreshGroups(true);
    this.contact.friends().subscribe({
      next:friends=>this.friends=friends,
      error:()=>this.friends=[]
    });
  }
  ngOnDestroy():void{this.subscriptions.unsubscribe();this.currentRequest++;}

  refreshGroups(initial:boolean):void{
    this.api.list().subscribe({
      next:groups=>{
        this.groups=groups;
        this.loading=false;
        this.error='';
        const requested=Number(this.route.snapshot.queryParamMap.get('id'));
        if(Number.isSafeInteger(requested)&&requested>0){
          const target=groups.find(x=>x.id===requested);
          if(target&&this.selected?.id!==target.id){this.select(target);}
        }
        if(this.selected){
          const updated=groups.find(x=>x.id===this.selected!.id);
          if(updated)this.selected=updated;
          else {this.selected=null;this.messages=[];}
        }
      },
      error:()=>{if(initial){this.error=t('groups.loadError');this.loading=false;}}
    });
  }

  select(group:PrivateGroup):void{
    if(this.selected?.id===group.id)return;
    this.selected=group;this.showCreate=false;this.showAdd=false;
    this.messages=[];this.loadingMessages=true;this.hasMore=false;
    this.groupError='';
    const ticket=++this.currentRequest;
    this.api.messages(group.id).subscribe({
      next:items=>{
        if(this.currentRequest!==ticket)return;
        this.messages=items;this.loadingMessages=false;this.hasMore=items.length>=50;
      },
      error:()=>{
        if(this.currentRequest!==ticket)return;
        this.groupError=t('groups.loadMessagesError');this.loadingMessages=false;
      }
    });
    void this.router.navigate(['/menu/groups'],{queryParams:{id:group.id}});
  }

  older():void{
    if(!this.selected||!this.messages.length||this.loadingMessages||!this.hasMore)return;
    this.loadingMessages=true;
    const groupId=this.selected.id,ticket=this.currentRequest;
    this.api.messages(groupId,this.messages[0].id).subscribe({
      next:items=>{
        if(this.currentRequest!==ticket)return;
        this.messages=[...items.filter(msg=>!this.messages.some(old=>old.id===msg.id)),...this.messages];
        this.hasMore=items.length>=50;this.loadingMessages=false;
      },
      error:()=>{this.loadingMessages=false;this.groupError=t('groups.loadMessagesError');}
    });
  }

  send():void{
    const group=this.selected,text=this.draft.trim();
    if(!group||!text||text.length>2000||this.busy)return;
    this.busy=true;this.groupError='';
    this.api.send(group.id,text).subscribe({
      next:message=>{
        if(this.selected?.id===group.id&&!this.messages.some(old=>old.id===message.id)){
          this.messages=[...this.messages,message];
        }
        this.draft='';this.busy=false;
      },
      error:()=>{this.groupError=t('groups.sendError');this.busy=false;}
    });
  }

  openCreate(initial=''):void{
    this.showCreate=true;this.showAdd=false;this.title='';
    this.selectedNames=new Set(initial?[initial.toLowerCase()]:[]);
    this.groupError='';
  }
  openAdd():void{
    if(!this.isCreator)return;
    this.selectedNames=new Set();
    this.showAdd=true;this.showCreate=false;this.groupError='';
  }
  get isCreator():boolean{
    return !!this.selected?.creatorUsername
      && this.selected.creatorUsername.toLowerCase()===this.me;
  }
  get invitedFriends():FriendSummary[]{
    if(!this.showAdd||!this.selected)return this.friends;
    const existing=new Set(this.selected.members.map(m=>m.username.toLowerCase()));
    return this.friends.filter(f=>!existing.has(f.username.toLowerCase()));
  }
  toggle(name:string):void{
    const key=name.toLowerCase();
    if(this.selectedNames.has(key))this.selectedNames.delete(key);
    else this.selectedNames.add(key);
    this.selectedNames=new Set(this.selectedNames);
  }
  create():void{
    const names=[...this.selectedNames];
    if(this.busy||!names.length||this.title.trim().length<2||this.title.trim().length>90)return;
    this.busy=true;this.groupError='';
    this.api.create(this.title.trim(),names).subscribe({
      next:group=>{
        this.busy=false;this.groups=[group,...this.groups];
        this.initialFriend='';this.selectedNames.clear();this.select(group);
      },
      error:()=>{this.busy=false;this.groupError=t('groups.createError');}
    });
  }
  add():void{
    if(!this.selected||!this.isCreator||this.busy||!this.selectedNames.size)return;
    this.busy=true;this.groupError='';
    this.api.add(this.selected.id,[...this.selectedNames]).subscribe({
      next:updated=>{
        this.busy=false;this.showAdd=false;this.selectedNames.clear();
        this.selected=updated;
        this.groups=this.groups.map(g=>g.id===updated.id?updated:g);
      },
      error:()=>{this.busy=false;this.groupError=t('groups.addError');}
    });
  }
}
