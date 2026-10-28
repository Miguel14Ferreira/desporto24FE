import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment/environment';

export interface PrivateGroupMember {
  username: string; displayName: string; profilePicUrl: string | null; admin: boolean;
}
export interface PrivateGroup {
  id: number; title: string; creatorUsername: string; createdAt: string;
  members: PrivateGroupMember[]; photoUrl?: string | null;
}
export interface PrivateGroupMessage {
  id: number; groupId: number; sender: string; text: string; createdAt: string;
}

/** All operations are authenticated; backend rechecks membership for each call. */
@Injectable({providedIn:'root'})
export class PrivateGroupService {
  private readonly base = environment.apiUrl + '/api/private-groups';
  constructor(private readonly http:HttpClient){}
  list():Observable<PrivateGroup[]> {return this.http.get<PrivateGroup[]>(this.base);}
  get(id:number):Observable<PrivateGroup> {return this.http.get<PrivateGroup>(this.base+'/'+id);}
  create(title:string,usernames:string[]):Observable<PrivateGroup> {
    return this.http.post<PrivateGroup>(this.base,{title,usernames});
  }
  add(id:number,usernames:string[]):Observable<PrivateGroup> {
    return this.http.post<PrivateGroup>(this.base+'/'+id+'/members',{usernames});
  }
  rename(id:number,title:string):Observable<PrivateGroup> {
    return this.http.patch<PrivateGroup>(this.base+'/'+id,{title});
  }
  uploadPhoto(id:number,file:File):Observable<PrivateGroup> {
    const body=new FormData();body.append('photo',file,file.name);
    return this.http.post<PrivateGroup>(this.base+'/'+id+'/photo',body);
  }
  removeMember(id:number,username:string):Observable<PrivateGroup> {
    return this.http.delete<PrivateGroup>(this.base+'/'+id+'/members/'+encodeURIComponent(username));
  }
  messages(id:number,beforeId?:number):Observable<PrivateGroupMessage[]> {
    return this.http.get<PrivateGroupMessage[]>(this.base+'/'+id+'/messages',{
      params:beforeId?{beforeId}:{}
    });
  }
  send(id:number,text:string):Observable<PrivateGroupMessage> {
    return this.http.post<PrivateGroupMessage>(this.base+'/'+id+'/messages',{text});
  }
}
