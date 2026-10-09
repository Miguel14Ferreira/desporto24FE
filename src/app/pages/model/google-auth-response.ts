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
  nickname: string | null;
  dateOfBirth: string;
  country: string;
  indicativePhone: string | null;
  phone: string | null;
  gender: string | null;
  acceptedLegalTerms: boolean;
}
