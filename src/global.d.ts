import type { DotaOverlayAPI } from './shared/contracts';
declare global {
  interface Window { dotaOverlay: DotaOverlayAPI; }
}
export {};
