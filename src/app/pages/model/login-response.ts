import { Perfil } from './perfil';

export interface LoginResponse {
  mfaRequired: boolean;
  challengeId: string | null;
  expiresAt: string | null;
  token: string | null;
  profile: Perfil | null;
}
