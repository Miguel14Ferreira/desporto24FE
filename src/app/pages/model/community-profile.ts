export interface CommunityProfile {
  userId: string | null;
  username: string;
  fullName: string | null;
  dateOfBirth: string | null;
  country: string | null;
  location: string | null;
  favoriteSports: string | null;
  gender: string | null;
  notLocked: boolean | null;
  enabled: boolean | null;
  profilePicUrl: string | null;
  lastLoginDateDisplay: string | null;
  joinDateDisplay: string | null;
}
