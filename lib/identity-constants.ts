export const ANON_COOKIE_NAME = 'jz_anon_id';
export const ANON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 天

export interface AnonIdentityResult {
  anonId: string;
  isNew: boolean;
}
