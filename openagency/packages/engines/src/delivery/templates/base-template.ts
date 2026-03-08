// ─── Plinth Base Template ────────────────────────────────────────────
// Brand constants for all Delivery Engine file generators.

import type { PlinthTemplate } from '@openagency/types';

export const PLINTH_TEMPLATE: PlinthTemplate = {
  colors: {
    primary: '#000000',
    secondary: '#666666',
    accent: '#FFFFFF',
    highlight: '#3B82F6',
  },
  fonts: { heading: 'Raleway', body: 'Raleway' },
  logo_path: 'assets/plinth-logo.png',
  footer: 'Plinth by Polanyi — plinth.polanyi.tech',
};

/** Slide/page dimensions in EMUs (PPTX standard) */
export const SLIDE_WIDTH_EMU = 9144000;   // 10 inches
export const SLIDE_HEIGHT_EMU = 5143500;  // 7.5 inches

/** Points → EMUs conversion */
export const pt = (points: number): number => points * 12700;
