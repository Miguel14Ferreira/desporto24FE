import { Injectable } from '@angular/core';

export type AppLanguage = 'pt' | 'en';

type Dictionary = Record<string, string>;

const PT: Dictionary = {
  'nav.home': 'Início',
  'nav.about': 'Sobre',
  'nav.contact': 'Contacto',
  'nav.login': 'Entrar',

  'common.cancel': 'Cancelar',
  'common.menu': 'Menu',
  'common.hide': 'Ocultar',
  'common.show': 'Mostrar',
  'common.email': 'Email',
  'common.country': 'País',
  'common.location': 'Localidade',
  'common.postalCode': 'Código postal',
  'common.address': 'Morada',
  'common.gender': 'Género',
  'common.phone': 'Telefone',

  'login.hero.title': 'Encontra pessoas para praticar o teu desporto.',
  'login.hero.subtitle': 'Descobre sessões, cria jogos, conversa com participantes e constrói a tua comunidade.',
  'login.welcome': 'Bem-vindo de volta',
  'login.title': 'Iniciar sessão',
  'login.noEmail': 'Não recebeste o email?',
  'login.resend': 'Reenviar email de confirmação',
  'login.resending': 'A reenviar...',
  'login.resendIn': 'Podes reenviar em {{seconds}}s',
  'login.username': 'Nome de utilizador',
  'login.usernamePlaceholder': 'O teu username',
  'login.password': 'Palavra-passe',
  'login.passwordPlaceholder': 'A tua palavra-passe',
  'login.enter': 'Entrar',
  'login.entering': 'A entrar...',
  'login.forgot': 'Esqueci-me da palavra-passe',
  'login.create': 'Criar nova conta',

  'register.title': 'Criar conta',
  'register.subtitle': 'Cria o teu perfil e começa a encontrar pessoas para praticar desporto.',
  'register.haveAccount': 'Já tenho conta',
  'register.existing': 'Conta já existente',
  'register.mayNeedConfirmation': 'Esta conta pode estar por confirmar',
  'register.recoveryHint': 'Se esta conta é tua e ainda não confirmaste o email, podes pedir um novo envio.',
  'register.goLogin': 'Ir para o login',
  'register.confirmation': 'Confirmação de conta',
  'register.checkEmail': 'Verifica o teu email',
  'register.noEmailHint': 'Não recebeste o email? Podes pedir um novo envio.',
  'register.photo': 'Fotografia de perfil',
  'register.photoOptional': 'Opcional. Podes alterá-la mais tarde.',
  'register.choosePhoto': 'Escolher fotografia',
  'register.fullName': 'Nome completo',
  'register.birthDate': 'Data de nascimento',
  'register.confirmPassword': 'Confirmar palavra-passe',
  'register.callingCode': 'Indicativo',
  'register.mobile': 'Telemóvel',
  'register.select': 'Selecionar',
  'register.male': 'Masculino',
  'register.female': 'Feminino',
  'register.other': 'Outro',
  'register.favoriteSports': 'Desportos favoritos',
  'register.favoriteSportsPlaceholder': 'Ex.: Padel, Futebol, Corrida',
  'register.creating': 'A criar conta...',

  'mfa.eyebrow': 'Verificação adicional',
  'mfa.title': 'Confirma o código MFA',
  'mfa.sent': 'Enviámos um código por SMS.',
  'mfa.expiresIn': 'O código expira em',
  'mfa.expired': 'Código expirado',
  'mfa.resendToContinue': 'Reenvia para continuar',
  'mfa.code': 'Código',
  'mfa.codePlaceholder': 'Código recebido por SMS',
  'mfa.confirm': 'Confirmar e entrar',
  'mfa.confirming': 'A confirmar...',
  'mfa.resend': 'Reenviar código',
  'mfa.back': 'Voltar ao login',

  'profile.edit.title': 'Editar perfil',
  'profile.edit.subtitle': 'Atualiza apenas os dados que queres partilhar na tua conta.',
  'profile.view': 'Ver perfil',
  'profile.loading': 'A carregar os teus dados...',
  'profile.usernameManaged': 'O nome de utilizador é gerido separadamente da edição do perfil.',
  'profile.changePhoto': 'Alterar fotografia',
  'profile.chooseNewPhoto': 'Escolher nova fotografia',
  'profile.savePhoto': 'Guardar fotografia',
  'profile.saving': 'A guardar...',
  'profile.fullName': 'Nome completo',
  'profile.birthDate': 'Data de nascimento',
  'profile.callingCode': 'Indicativo',
  'profile.favoriteSports': 'Desportos favoritos',
  'profile.gender.none': 'Não indicar',
  'profile.mfa.title': 'Autenticação multifator',
  'profile.mfa.subtitle': 'Adiciona uma camada extra de segurança à tua conta.',
  'profile.save': 'Guardar alterações',

  'home.hero.title': 'Encontra pessoas para praticar o teu desporto.',
  'home.hero.subtitle': 'Descobre sessões perto de ti, cria jogos, conversa com participantes e constrói uma comunidade à volta do desporto.',
  'home.createAccount': 'Criar conta',
  'home.haveAccount': 'Já tenho conta',
  'home.features': 'Funcionalidades principais',
  'home.localSessions': 'Sessões locais',
  'home.chat': 'Chat',
  'home.community': 'Comunidade',
  'home.reliability': 'Fiabilidade',
  'home.startHere': 'Começa por aqui',
  'home.playMore': 'Joga mais. Combina mais facilmente.',
  'home.welcomeText': 'Junta-te a jogadores da tua zona, encontra sessões abertas e organiza os teus próprios jogos.',
  'home.enterCommunity': 'Entrar na comunidade',
  'home.aboutD24': 'Conhecer o Desporto24',
  'home.contactUs': 'Falar connosco',

  'menu.hello': 'Olá, {{name}}',
  'menu.fallbackTitle': 'O teu desporto começa aqui',
  'menu.subtitle': 'Encontra pessoas para jogar, cria sessões e acompanha a tua comunidade.',
  'menu.profile': 'Perfil',
  'menu.viewProfile': 'Ver perfil',
  'menu.logout': 'Sair',
  'menu.loggingOut': 'A terminar...',
  'menu.loadingProfile': 'A carregar o teu perfil...',
  'menu.retry': 'Tentar novamente',
  'menu.discover': 'Descobrir',
  'menu.findSessions': 'Encontrar sessões',
  'menu.findSessionsText': 'Pesquisa por desporto, localidade ou jogos perto de ti.',
  'menu.organize': 'Organizar',
  'menu.createSession': 'Criar uma sessão',
  'menu.createSessionText': 'Define o local, horário, vagas e convida a comunidade.',
  'menu.mySessions': 'As minhas sessões',
  'menu.mySessionsText': 'Criadas, participações e lista de espera.',
  'menu.community': 'Comunidade',
  'menu.communityText': 'Encontra jogadores e envia pedidos de amizade.',
  'menu.friends': 'Amigos',
  'menu.friendsText': 'Lista de amigos, chat direto e gestão de contactos.',
  'menu.notifications': 'Notificações',
  'menu.updating': 'A atualizar...',
  'menu.unread': '{{count}} por ler',
  'menu.noUnread': 'Sem notificações por ler.',
  'menu.myProfile': 'O meu perfil',
  'menu.myProfileText': 'Dados pessoais, fotografia e fiabilidade.',
  'menu.editProfile': 'Editar perfil',
  'menu.editProfileText': 'Atualiza localização, contacto, MFA e preferências.',
  'menu.security': 'Segurança',
  'menu.securityText': 'Altera a tua palavra-passe.',
  'menu.disputes': 'Contestações',
  'menu.disputesText': 'Analisa e resolve contestações de faltas.'
};

const EN: Dictionary = {
  'nav.home': 'Home',
  'nav.about': 'About',
  'nav.contact': 'Contact',
  'nav.login': 'Sign in',

  'common.cancel': 'Cancel',
  'common.menu': 'Menu',
  'common.hide': 'Hide',
  'common.show': 'Show',
  'common.email': 'Email',
  'common.country': 'Country',
  'common.location': 'Location',
  'common.postalCode': 'Postal code',
  'common.address': 'Address',
  'common.gender': 'Gender',
  'common.phone': 'Phone',

  'login.hero.title': 'Find people to play your sport with.',
  'login.hero.subtitle': 'Discover sessions, create games, chat with participants and build your community.',
  'login.welcome': 'Welcome back',
  'login.title': 'Sign in',
  'login.noEmail': "Didn't receive the email?",
  'login.resend': 'Resend confirmation email',
  'login.resending': 'Resending...',
  'login.resendIn': 'Resend available in {{seconds}}s',
  'login.username': 'Username',
  'login.usernamePlaceholder': 'Your username',
  'login.password': 'Password',
  'login.passwordPlaceholder': 'Your password',
  'login.enter': 'Sign in',
  'login.entering': 'Signing in...',
  'login.forgot': 'Forgot your password?',
  'login.create': 'Create new account',

  'register.title': 'Create account',
  'register.subtitle': 'Create your profile and start finding people to play sports with.',
  'register.haveAccount': 'I already have an account',
  'register.existing': 'Account already exists',
  'register.mayNeedConfirmation': 'This account may still need confirmation',
  'register.recoveryHint': 'If this is your account and you have not confirmed your email yet, you can request a new message.',
  'register.goLogin': 'Go to sign in',
  'register.confirmation': 'Account confirmation',
  'register.checkEmail': 'Check your email',
  'register.noEmailHint': "Didn't receive the email? You can request another one.",
  'register.photo': 'Profile photo',
  'register.photoOptional': 'Optional. You can change it later.',
  'register.choosePhoto': 'Choose photo',
  'register.fullName': 'Full name',
  'register.birthDate': 'Date of birth',
  'register.confirmPassword': 'Confirm password',
  'register.callingCode': 'Calling code',
  'register.mobile': 'Mobile phone',
  'register.select': 'Select',
  'register.male': 'Male',
  'register.female': 'Female',
  'register.other': 'Other',
  'register.favoriteSports': 'Favourite sports',
  'register.favoriteSportsPlaceholder': 'E.g. Padel, Football, Running',
  'register.creating': 'Creating account...',

  'mfa.eyebrow': 'Additional verification',
  'mfa.title': 'Confirm your MFA code',
  'mfa.sent': 'We sent a code by SMS.',
  'mfa.expiresIn': 'Code expires in',
  'mfa.expired': 'Code expired',
  'mfa.resendToContinue': 'Resend it to continue',
  'mfa.code': 'Code',
  'mfa.codePlaceholder': 'Code received by SMS',
  'mfa.confirm': 'Confirm and sign in',
  'mfa.confirming': 'Confirming...',
  'mfa.resend': 'Resend code',
  'mfa.back': 'Back to sign in',

  'profile.edit.title': 'Edit profile',
  'profile.edit.subtitle': 'Update only the information you want to share on your account.',
  'profile.view': 'View profile',
  'profile.loading': 'Loading your details...',
  'profile.usernameManaged': 'Your username is managed separately from profile editing.',
  'profile.changePhoto': 'Change photo',
  'profile.chooseNewPhoto': 'Choose new photo',
  'profile.savePhoto': 'Save photo',
  'profile.saving': 'Saving...',
  'profile.fullName': 'Full name',
  'profile.birthDate': 'Date of birth',
  'profile.callingCode': 'Calling code',
  'profile.favoriteSports': 'Favourite sports',
  'profile.gender.none': 'Prefer not to say',
  'profile.mfa.title': 'Multi-factor authentication',
  'profile.mfa.subtitle': 'Add an extra layer of security to your account.',
  'profile.save': 'Save changes',

  'home.hero.title': 'Find people to play your sport with.',
  'home.hero.subtitle': 'Discover nearby sessions, create games, chat with participants and build a sports community.',
  'home.createAccount': 'Create account',
  'home.haveAccount': 'I already have an account',
  'home.features': 'Main features',
  'home.localSessions': 'Local sessions',
  'home.chat': 'Chat',
  'home.community': 'Community',
  'home.reliability': 'Reliability',
  'home.startHere': 'Start here',
  'home.playMore': 'Play more. Arrange games more easily.',
  'home.welcomeText': 'Join players near you, find open sessions and organise your own games.',
  'home.enterCommunity': 'Join the community',
  'home.aboutD24': 'Discover Desporto24',
  'home.contactUs': 'Contact us',

  'menu.hello': 'Hello, {{name}}',
  'menu.fallbackTitle': 'Your sport starts here',
  'menu.subtitle': 'Find people to play with, create sessions and keep up with your community.',
  'menu.profile': 'Profile',
  'menu.viewProfile': 'View profile',
  'menu.logout': 'Sign out',
  'menu.loggingOut': 'Signing out...',
  'menu.loadingProfile': 'Loading your profile...',
  'menu.retry': 'Try again',
  'menu.discover': 'Discover',
  'menu.findSessions': 'Find sessions',
  'menu.findSessionsText': 'Search by sport, location or games near you.',
  'menu.organize': 'Organise',
  'menu.createSession': 'Create a session',
  'menu.createSessionText': 'Choose the location, time, places and invite the community.',
  'menu.mySessions': 'My sessions',
  'menu.mySessionsText': 'Created sessions, participations and waiting list.',
  'menu.community': 'Community',
  'menu.communityText': 'Find players and send friend requests.',
  'menu.friends': 'Friends',
  'menu.friendsText': 'Friends list, direct chat and contact management.',
  'menu.notifications': 'Notifications',
  'menu.updating': 'Updating...',
  'menu.unread': '{{count}} unread',
  'menu.noUnread': 'No unread notifications.',
  'menu.myProfile': 'My profile',
  'menu.myProfileText': 'Personal details, photo and reliability.',
  'menu.editProfile': 'Edit profile',
  'menu.editProfileText': 'Update location, contact details, MFA and preferences.',
  'menu.security': 'Security',
  'menu.securityText': 'Change your password.',
  'menu.disputes': 'Disputes',
  'menu.disputesText': 'Review and resolve attendance disputes.'
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly storageKey = 'd24-language';
  private language: AppLanguage = this.readInitialLanguage();

  constructor() {
    this.applyDocumentLanguage();
  }

  get currentLanguage(): AppLanguage {
    return this.language;
  }

  setLanguage(language: AppLanguage): void {
    this.language = language;
    localStorage.setItem(this.storageKey, language);
    this.applyDocumentLanguage();
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const dictionary = this.language === 'en' ? EN : PT;
    let value = dictionary[key] ?? PT[key] ?? key;

    for (const [name, replacement] of Object.entries(params ?? {})) {
      value = value.replaceAll('{{' + name + '}}', String(replacement));
    }

    return value;
  }

  private readInitialLanguage(): AppLanguage {
    const stored = localStorage.getItem(this.storageKey);
    return stored === 'en' ? 'en' : 'pt';
  }

  private applyDocumentLanguage(): void {
    document.documentElement.lang = this.language === 'en' ? 'en' : 'pt-PT';
  }
}
