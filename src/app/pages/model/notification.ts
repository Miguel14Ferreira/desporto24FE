export class Notification{
    id!:number;
    assunto:string;
    mensagem:string;
    cumprimentos:string;
    assinatura:string;
    createdAt:string;

    constructor(){
        this.assunto = '';
        this.mensagem = '';
        this.cumprimentos = '';
        this.assinatura = '';
        this.createdAt = '';
    }
}