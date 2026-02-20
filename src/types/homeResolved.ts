// src/types/homeResolved.ts
import type { HomeSectionRow } from '@/types/homeSections';

export interface HomeSectionResolved {
  section: HomeSectionRow & {
    bannerUrl?: string | null;
  };
  productIds: string[];
}

export interface HomeSectionsResolvedDTO {
  sections: HomeSectionResolved[];
}
