import { Perfil } from './perfil';

export interface GoogleAuthResponse {
  onboardingRequired: boolean;
  email: string | null;
  fullName: string | null;
  pictureUrl: string | null;
  mfaRequired: boolean;
  challengeId: string | null;
  challengeExpiresAt: string | null;
  token: string | null;
  profile: Perfil | null;
}

export interface GoogleRegistrationRequest {
  credential: string;
  username: string;
  dateOfBirth: string;
  address: string;
  country: string;
  location: string;
  postalCode: string;
  indicativePhone: string;
  phone: string;
  gender: string;
  favoriteSports: string;
}
