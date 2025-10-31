import type { ProductTeaser } from '@/lib/email';
import { urlFrom } from '@/lib/url';
import { Body, Container, Head, Hr, Html, Img, Link, Section, Text } from '@react-email/components';

interface TrackingEmailProps {
  orderId: string;
  displayId?: string | null;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  products?: ProductTeaser[];
  brand?: {
    logoUrl?: string;
    primary?: string;
    supportEmail?: string;
    siteUrl?: string;
  };
}

export default function TrackingEmail({
  orderId,
  displayId,
  carrier,
  trackingNumber,
  trackingUrl,
  products = [],
  brand = {}
}: TrackingEmailProps) {
  const logo = brand.logoUrl ?? 'https://www.prince-foods.com/assets/prince-foods-logo.png';
  const primary = brand.primary ?? '#D62828';
  const siteUrl = brand.siteUrl ?? 'https://www.prince-foods.com';

  // ✅ Safe hostname extraction (no new URL)
  let siteHost = siteUrl;
  try {
    siteHost = urlFrom(siteUrl).hostname;
  } catch {
    // ultra-safe fallback without throwing in email render
    siteHost = siteUrl.replace(/^https?:\/\//i, '').split('/')[0];
  }

  return (
    <Html>
      <Head />
      <Body
        style={{
          backgroundColor: '#f9fafb',
          color: '#111827',
          fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
          margin: 0,
          padding: '20px 0'
        }}
      >
        <Container
          style={{
            maxWidth: 520,
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '28px 32px',
            margin: '0 auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          <Section style={{ textAlign: 'center' }}>
            <Img
              src={logo}
              alt="Prince Foods"
              width={120}
              height={36}
              style={{ display: 'block', border: 0, outline: 'none', textDecoration: 'none' }}
            />
          </Section>

          <Section style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
              Your order {displayId ?? orderId} is on its way 🚚
            </Text>

            <Text style={{ margin: '0 0 8px' }}>
              Carrier: <strong>{carrier}</strong>
            </Text>
            <Text style={{ margin: '0 0 8px' }}>
              Tracking number: <strong>{trackingNumber}</strong>
            </Text>

            {trackingUrl && (
              <Link
                href={trackingUrl}
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  backgroundColor: primary,
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '10px 16px',
                  borderRadius: 6,
                  fontWeight: 600
                }}
              >
                Track your parcel
              </Link>
            )}
          </Section>

          {products.length > 0 && (
            <Section style={{ marginTop: 28 }}>
              <Text style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                Items in your order:
              </Text>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 12
                }}
              >
                {products.map((p) => (
                  <Link
                    key={p.id}
                    href={p.href}
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      color: '#111',
                      border: '1px solid #eee',
                      borderRadius: 8,
                      padding: 8,
                      textAlign: 'center'
                    }}
                  >
                    <Img
                      src={p.image}
                      alt={p.title}
                      width="100%"
                      height="auto"
                      style={{ borderRadius: 6, objectFit: 'contain' }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        margin: '8px 0 4px',
                        fontWeight: 500,
                        color: '#111827'
                      }}
                    >
                      {p.title}
                    </Text>
                    {p.price && (
                      <Text style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                        £{p.price.toFixed(2)}
                      </Text>
                    )}
                  </Link>
                ))}
              </div>
            </Section>
          )}

          <Hr style={{ margin: '24px 0', borderColor: '#eee' }} />

          <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
            If you have any questions, please reply to this email or contact us at{' '}
            <Link
              href={`mailto:${brand.supportEmail ?? 'support@prince-foods.com'}`}
              style={{ color: primary }}
            >
              {brand.supportEmail ?? 'support@prince-foods.com'}
            </Link>
            .
          </Text>

          <Text
            style={{
              fontSize: 12,
              color: '#9ca3af',
              textAlign: 'center',
              marginTop: 24
            }}
          >
            © {new Date().getFullYear()} Prince Foods ·{' '}
            <Link href={siteUrl} style={{ color: '#9ca3af', textDecoration: 'none' }}>
              {siteHost}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
