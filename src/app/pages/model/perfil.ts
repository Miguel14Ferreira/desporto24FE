export class Perfil {
    public username:string;
    public password:string;
    public confirmPassword:string;
    public fullName:string;
    public dateOfBirth:string;
    public address:string;
    public country:string;
    public location:string;
    public postalCode:string;
    public phone:string;
    public gender:string;
    public email:string;
    public foto: [];
    public joinDate:string;
    public lastLoginDate:string;
    public lastLoginDateDisplay: string;
    public enabled: boolean;
    public notLocked: boolean;
    public role: string;
    public authorities: [];
    public desportosFavoritos: string;
    

    constructor(){
        this.username = '';
        this.password = '';
        this.confirmPassword = '';
        this.fullName = '';
        this.dateOfBirth = '';
        this.address = '';
        this.country = '';
        this.location = '';
        this.postalCode = '';
        this.phone = '';
        this.gender = '';
        this.email = '';
        this.foto = [];
        this.joinDate = '';
        this.lastLoginDate = '';
        this.lastLoginDateDisplay = '';
        this.enabled = false;
        this.notLocked = false;
        this.role = '';
        this.authorities = [];
        this.desportosFavoritos = '';
    }      
}
