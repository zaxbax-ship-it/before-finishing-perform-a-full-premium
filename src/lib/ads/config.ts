import { getProductionConfig } from '@/lib/infrastructure/config';

export type AdProvider = 'none' | 'adsense' | 'google-ad-manager' | 'media-net' | 'ezoic';

export type AdPlacement =
  | 'homepage-hero-below'
  | 'homepage-content'
  | 'categories-top'
  | 'categories-grid-after'
  | 'gameplay-sidebar'
  | 'gameplay-between-rounds'
  | 'question-result'
  | 'admin-top'
  | 'admin-sidebar';

export type AdFormat = 'banner' | 'leaderboard' | 'rectangle' | 'mobile-banner' | 'fluid' | 'native';

export type AdSlotDefinition = {
  placement: AdPlacement;
  label: string;
  format: AdFormat;
  minHeight: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  lazy: boolean;
  gameplaySafe: boolean;
  enabledByDefault: boolean;
};

export type AdsConfig = {
  enabled: boolean;
  provider: AdProvider;
  publisherId?: string;
  showPlaceholders: boolean;
};

export const AD_SLOTS: Record<AdPlacement, AdSlotDefinition> = {
  'homepage-hero-below': {
    placement: 'homepage-hero-below',
    label: 'Homepage hero below',
    format: 'leaderboard',
    minHeight: { mobile: 90, tablet: 120, desktop: 120 },
    lazy: true,
    gameplaySafe: true,
    enabledByDefault: true
  },
  'homepage-content': {
    placement: 'homepage-content',
    label: 'Homepage content',
    format: 'rectangle',
    minHeight: { mobile: 250, tablet: 280, desktop: 280 },
    lazy: true,
    gameplaySafe: true,
    enabledByDefault: true
  },
  'categories-top': {
    placement: 'categories-top',
    label: 'Categories top',
    format: 'leaderboard',
    minHeight: { mobile: 90, tablet: 110, desktop: 110 },
    lazy: true,
    gameplaySafe: true,
    enabledByDefault: true
  },
  'categories-grid-after': {
    placement: 'categories-grid-after',
    label: 'Categories grid after',
    format: 'fluid',
    minHeight: { mobile: 180, tablet: 220, desktop: 220 },
    lazy: true,
    gameplaySafe: true,
    enabledByDefault: true
  },
  'gameplay-sidebar': {
    placement: 'gameplay-sidebar',
    label: 'Gameplay sidebar',
    format: 'rectangle',
    minHeight: { mobile: 0, tablet: 0, desktop: 280 },
    lazy: true,
    gameplaySafe: true,
    enabledByDefault: false
  },
  'gameplay-between-rounds': {
    placement: 'gameplay-between-rounds',
    label: 'Between rounds',
    format: 'native',
    minHeight: { mobile: 0, tablet: 0, desktop: 0 },
    lazy: true,
    gameplaySafe: false,
    enabledByDefault: false
  },
  'question-result': {
    placement: 'question-result',
    label: 'Question result popup',
    format: 'native',
    minHeight: { mobile: 0, tablet: 0, desktop: 0 },
    lazy: true,
    gameplaySafe: false,
    enabledByDefault: false
  },
  'admin-top': {
    placement: 'admin-top',
    label: 'Admin top',
    format: 'leaderboard',
    minHeight: { mobile: 0, tablet: 90, desktop: 90 },
    lazy: true,
    gameplaySafe: true,
    enabledByDefault: false
  },
  'admin-sidebar': {
    placement: 'admin-sidebar',
    label: 'Admin sidebar',
    format: 'rectangle',
    minHeight: { mobile: 0, tablet: 0, desktop: 250 },
    lazy: true,
    gameplaySafe: true,
    enabledByDefault: false
  }
};

export function getAdsConfig(): AdsConfig {
  const config = getProductionConfig();
  return {
    enabled: config.ads.enabled,
    provider: config.ads.provider,
    publisherId: config.ads.adsensePublisherId,
    showPlaceholders: config.ads.placeholders
  };
}
