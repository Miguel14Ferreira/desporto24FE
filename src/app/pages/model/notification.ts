export class Notification{
    id!:number;
    assunto:string;
    mensagem:string;
    cumprimentos:string;
    assinatura:string;
    createdAt:string;
    friendRequest:boolean;
    token:string;

    constructor(){
        this.assunto = '';
        this.mensagem = '';
        this.cumprimentos = '';
        this.assinatura = '';
        this.createdAt = '';
        this.friendRequest = false;
        this.token = '';
    }
}