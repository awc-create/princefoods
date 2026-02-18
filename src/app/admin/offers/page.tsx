import OffersClient from './offers-client';

export const metadata = {
  title: 'Offers | Admin',
  description: 'Manage automatic offers like BOGO / X-for-Y.'
};

export default function OffersPage() {
  return <OffersClient />;
}
