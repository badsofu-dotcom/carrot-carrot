/**
 * Compat shim — v2 farm onboarding lives in BunnyOnboardingModal.tsx.
 * Existing call sites import `FarmOnboarding` and `ONBOARDING_KEY` from
 * this path (CollectionPage, SettingsPage); re-export the new modal under
 * the old name so the migration is a single-file move.
 */
export {
  BunnyOnboardingModal as FarmOnboarding,
  ONBOARDING_KEY,
} from "./BunnyOnboardingModal";
