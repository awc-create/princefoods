export interface FAQItem {
  id: string; // stable id
  question: string;
  answer: string;
  active?: boolean; // optional toggle to hide/show
}

export interface FAQSettingsDTO {
  heading: string;
  subheading?: string;
  items: FAQItem[];
}

export type FAQQuestionStatus = 'NEW' | 'ANSWERED' | 'DISMISSED';

/** Admin inbox row: a submitted question and, once given, its reply. */
export interface FAQInboxItem {
  id: string;
  question: string;
  askedCount: number;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms

  status: FAQQuestionStatus;

  /** Null when asked anonymously — nothing to reply to. */
  askerEmail: string | null;
  askerName: string | null;
  /** True when the asker has an account, so the reply also lands in Messages. */
  hasAccount: boolean;

  answer: string | null;
  answeredAt: number | null;
  answeredByEmail: string | null;
  /** True once the answer has been published to the public FAQ list. */
  published: boolean;
}
