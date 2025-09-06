// src/app/contact/page.tsx
import ContactOffices from '@/components/contact/ContactOffice';
import ContactClient from './ContactClient';

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Prince Foods for assistance or inquiries.'
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function ContactPage() {
  return (
    <>
      <ContactClient />
      <ContactOffices />
    </>
  );
}
