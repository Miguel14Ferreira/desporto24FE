export class Notification{
    assunto:String;
    mensagem:String;
    cumprimentos:String;
    assinatura:String;
    created_at:String;

    constructor(){
        this.assunto = '';
        this.mensagem = '';
        this.cumprimentos = '';
        this.assinatura = '';
        this.created_at = '';
    }
}