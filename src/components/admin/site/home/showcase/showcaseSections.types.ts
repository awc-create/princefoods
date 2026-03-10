// src/components/admin/site/home/showcase/showcaseSections.types.ts
import type {
  DealsMode,
  DealsSelectionMode,
  HomeSectionProductCarouselConfig,
  HomeSectionProductSource,
  HomeSectionRow
} from '@/types/homeSections';
import type { CampaignKey } from '@/types/homeSettings';

export type Source = HomeSectionProductSource;

export interface ShowcaseCarouselConfig extends HomeSectionProductCarouselConfig {
  campaignKey?: CampaignKey;
  offerIds?: string[];
  campaignImageUrl?: string | null;
  dealsSelectionMode?: DealsSelectionMode;
}

export interface ApiGetResp {
  ok: boolean;
  data?: HomeSectionRow[];
  error?: string;
}

export interface ApiSaveResp {
  ok: boolean;
  error?: string;
}

export interface SourceOption {
  value: Source | 'ALL';
  label: string;
  help: string;
}

export interface DealsModeOption {
  value: DealsMode;
  label: string;
  help: string;
}
