import React from 'react';

import FaqClient from './FaqClient';

export const metadata = {
  title: 'FAQs',
  description: 'Get answers to common questions about our services.'
};

export default function FaqPage() {
  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh' }}>
      <FaqClient />
    </div>
  );
}
