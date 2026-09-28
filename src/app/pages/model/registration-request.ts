export interface RegistrationRequest {
  username: string;
  password: string;
  nickname: string | null;
  dateOfBirth: string;
  country: string;
  indicativePhone: string;
  phone: string;
  gender: string | null;
  email: string;
}
