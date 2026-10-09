import { MyProfile } from '../pages/model/my-profile';

export type ProfileCompletionKey =
  | 'namePhoto'
  | 'location'
  | 'age'
  | 'sports'
  | 'level'
  | 'availability'
  | 'bio';

export interface ProfileCompletionItem {
  key: ProfileCompletionKey;
  weight: number;
  complete: boolean;
}

export interface ProfileCompletion {
  percentage: number;
  items: ProfileCompletionItem[];
  missing: ProfileCompletionItem[];
}

export function calculateProfileCompletion(
  profile?: MyProfile
): ProfileCompletion {
  const items: ProfileCompletionItem[] = [
    {
      key: 'namePhoto',
      weight: 15,
      complete: Boolean(
        profile
        && (profile.fullName?.trim() || profile.nickname?.trim())
        && profile.profilePicUrl?.trim()
      )
    },
    {
      key: 'location',
      weight: 15,
      complete: Boolean(profile?.location?.trim())
    },
    {
      key: 'age',
      weight: 15,
      complete: Boolean(profile?.dateOfBirth?.trim())
    },
    {
      key: 'sports',
      weight: 20,
      complete: Boolean(profile?.favoriteSports?.trim())
    },
    {
      key: 'level',
      weight: 15,
      complete: Boolean(profile?.skillLevel?.trim())
    },
    {
      key: 'availability',
      weight: 10,
      complete: Boolean(profile?.availability?.trim())
    },
    {
      key: 'bio',
      weight: 10,
      complete: Boolean(profile?.bio?.trim())
    }
  ];

  const percentage = items
    .filter(item => item.complete)
    .reduce((total, item) => total + item.weight, 0);

  return {
    percentage,
    items,
    missing: items.filter(item => !item.complete)
  };
}
