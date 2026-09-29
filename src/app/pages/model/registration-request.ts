export interface RegistrationRequest {
  username: string;
  password: string;
  nickname: string | null;
  dateOfBirth: string;
  country: string;
  indicativePhone: string | null;
  phone: string | null;
  gender: string | null;
  email: string;
}
