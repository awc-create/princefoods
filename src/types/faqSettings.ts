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

/** Admin inbox row (aggregated) */
export interface FAQInboxItem {
  id: string;
  question: string;
  askedCount: number;
  createdAt: string; // ISO
}
