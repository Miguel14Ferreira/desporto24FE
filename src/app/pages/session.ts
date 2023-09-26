export class Session {
    desporto:string;
    utilizador:string;
    jogadores:string;
    dataDeJogo:string;
    localidade:string;
    morada:string;
    preco:string;
    password:string;
    private:string;
    foto:string;
    dataDeJogoCriado:string;

    constructor(){
        this.utilizador = '';
        this.desporto = '';
        this.jogadores = '';
        this.dataDeJogo = '';
        this.localidade = '';
        this.morada = '';
        this.preco = '';
        this.password = '';
        this.private = '';
        this.foto = '';
        this.dataDeJogoCriado = '';
    }  
}
