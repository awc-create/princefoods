// src/app/about/page.tsx
// Keep this page simple; no URL construction here.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import AboutClient from './AboutClient';

export const metadata = {
  title: 'About Us',
  description: 'Discover who we are and what we do.'
};

export default function AboutPage() {
  return <AboutClient />;
}
