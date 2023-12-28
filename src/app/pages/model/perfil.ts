export class Perfil {
    public id:number;
    public username:string;
    public password:string;
    public confirmPassword:string;
    public fullName:string;
    public dateOfBirth:string;
    public address:string;
    public country:string;
    public location:string;
    public postalCode:string;
    public indicativePhone:string;
    public phone:string;
    public gender:string;
    public email:string;
    public foto:string;
    public joinDate:string;
    public joinDateDisplay:string;
    public lastLoginDate:string;
    public lastLoginDateDisplay: string;
    public enabled: boolean;
    public notLocked: boolean;
    public mfa:boolean;
    public role: string;
    public authorities: [];
    public desportosFavoritos: string;
    public status:string;
    
    constructor(){
        this.id = 0;
        this.username = '';
        this.password = '';
        this.confirmPassword = '';
        this.fullName = '';
        this.dateOfBirth = '';
        this.address = '';
        this.country = '';
        this.location = '';
        this.postalCode = '';
        this.indicativePhone = '';
        this.phone = '';
        this.gender = '';
        this.email = '';
        this.foto = '';
        this.joinDate = '';
        this.joinDateDisplay = '';
        this.lastLoginDate = '';
        this.lastLoginDateDisplay = '';
        this.mfa = false;
        this.enabled = false;
        this.notLocked = false;
        this.role = '';
        this.authorities = [];
        this.desportosFavoritos = '';
        this.status = '';
    }      
}
