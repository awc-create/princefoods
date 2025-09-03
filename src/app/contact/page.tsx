import React from 'react';

import ContactClient from './ContactClient';
import ContactOffices from '@/components/contact/ContactOffice';

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Prince Foods for assistance or inquiries.'
};

export default function ContactPage() {
  return (
    <>
      <ContactClient />
      <ContactOffices />
    </>
  );
}
