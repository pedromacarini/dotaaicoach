export const ONBOARDING_STORAGE_KEY = 'dota-open-overlay:onboarding-v1';
export const ONBOARDING_COMPLETE_VALUE = 'completed';

export function shouldShowOnboarding(saved: string | null): boolean {
  return saved !== ONBOARDING_COMPLETE_VALUE;
}
