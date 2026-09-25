export interface MyProfile {
  userId: string | null;
  username: string;
  fullName: string | null;
  dateOfBirth: string | null;
  address: string | null;
  country: string | null;
  location: string | null;
  postalCode: string | null;
  indicativePhone: string | null;
  phone: string | null;
  gender: string | null;
  email: string;
  favoriteSports: string | null;
  mfa: boolean | null;
  profilePicUrl: string | null;
  joinDateDisplay: string | null;
  lastLoginDateDisplay: string | null;
}

export interface UpdateMyProfileRequest {
  fullName: string | null;
  dateOfBirth: string | null;
  address: string | null;
  country: string | null;
  location: string | null;
  postalCode: string | null;
  indicativePhone: string | null;
  phone: string | null;
  gender: string | null;
  email: string;
  favoriteSports: string | null;
  mfa: boolean | null;
}
