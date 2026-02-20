// src/lib/offers-engine.ts

// ✅ IMPORTANT:
// Do NOT put 'use client' in this file.
// API routes (server) import from here, so it must remain server-safe.
//
// The engine implementation is in offers-engine.core.ts.
// This file is a clean barrel re-export so you can keep imports stable.

export { evaluateOffers } from './offers-engine.core';

// ✅ Re-export admin/DB offer types from the single source of truth
export type {
  OfferAdminForm,
  OfferAppliedMeta as OfferAppliedMetaUi,
  OfferDbRow,
  OfferKind,
  OfferLineDiscount as OfferLineDiscountUi,
  OfferLineParticipant as OfferLineParticipantUi,
  OfferMode,
  OfferPayload,
  OfferStackingMode,
  OfferStatus,
  OfferTargetRule,
  OfferVisibility
} from '@/types/offers';

// ✅ Engine-specific runtime/output types live in core
export type {
  AutoAddLine,
  CartLine,
  LineDiscount,
  LineParticipant,
  Money,
  OfferApplied,
  OfferAppliedMeta,
  OfferEvalInput,
  OffersEvalResult
} from './offers-engine.core';
