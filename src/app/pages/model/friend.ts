export class Friend{
    id:number;
    createdAt:string;
    chatBlocked:string;
    whoBlocked:string;

    constructor(){
        this.id = 0;
        this.createdAt = "";
        this.chatBlocked = "";
        this.whoBlocked = "";
    }
}