import { Perfil } from './perfil';

export interface LoginResponse {
  mfaRequired: boolean;
  challengeId: string | null;
  challengeExpiresAt: string | null;
  token: string | null;
  profile: Perfil | null;
}
