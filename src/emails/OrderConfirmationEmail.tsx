import { Body, Container, Head, Hr, Html, Img, Link, Section, Text } from '@react-email/components';

interface OrderItem {
  name: string;
  sku?: string | null;
  quantity: number;
  lineTotal: number;
}

interface OrderConfirmationEmailProps {
  displayId: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency?: string;
  contactEmail?: string;
  brand?: {
    logoUrl?: string;
    primary?: string;
    supportEmail?: string;
    siteUrl?: string;
  };
}

function money(pence: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((pence || 0) / 100);
}

export default function OrderConfirmationEmail({
  displayId,
  createdAt,
  items = [],
  subtotal,
  shippingTotal,
  discountTotal,
  grandTotal,
  currency = 'GBP',
  brand = {}
}: OrderConfirmationEmailProps) {
  const logo = brand.logoUrl ?? 'https://www.prince-foods.com/assets/prince-foods-logo.png';
  const primary = brand.primary ?? '#D62828';
  const siteUrl = brand.siteUrl ?? 'https://www.prince-foods.com';
  const supportEmail = brand.supportEmail ?? 'support@prince-foods.com';

  const rowStyle = {
    display: 'flex' as const,
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 14
  };

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
            maxWidth: 560,
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '28px 32px',
            margin: '0 auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}
        >
          {/* Logo */}
          <Section style={{ textAlign: 'center', marginBottom: 24 }}>
            <Img
              src={logo}
              alt="Prince Foods"
              width={140}
              height={42}
              style={{ display: 'block', border: 0, margin: '0 auto' }}
            />
          </Section>

          {/* Heading */}
          <Text style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
            ✅ Order confirmed!
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
            Order <strong style={{ color: '#111827' }}>#{displayId}</strong> · {createdAt}
          </Text>

          {/* Dispatch note */}
          <Section
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 24
            }}
          >
            <Text style={{ margin: 0, fontSize: 14, color: '#15803d', fontWeight: 600 }}>
              🚚 We aim to dispatch within 1–2 working days
            </Text>
            <Text style={{ margin: '4px 0 0', fontSize: 13, color: '#166534' }}>
              You'll receive a separate shipping confirmation once your order is on its way.
            </Text>
          </Section>

          {/* Items */}
          <Text style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Your items</Text>
          <Section
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: 8,
              padding: '4px 12px',
              marginBottom: 16
            }}
          >
            {items.map((it, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {it.name}
                  {it.sku ? (
                    <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 6 }}>
                      ({it.sku})
                    </span>
                  ) : null}
                </span>
                <span style={{ color: '#6b7280', marginLeft: 8 }}>×{it.quantity}</span>
                <span style={{ marginLeft: 16, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
                  {money(it.lineTotal, currency)}
                </span>
              </div>
            ))}
          </Section>

          {/* Totals */}
          <Section style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
            <div style={{ ...rowStyle, color: '#6b7280' }}>
              <span>Subtotal</span>
              <span>{money(subtotal, currency)}</span>
            </div>
            <div style={{ ...rowStyle, color: '#6b7280' }}>
              <span>Shipping</span>
              <span>{shippingTotal > 0 ? money(shippingTotal, currency) : 'Free'}</span>
            </div>
            {discountTotal > 0 && (
              <div style={{ ...rowStyle, color: '#16a34a' }}>
                <span>Discount</span>
                <span>-{money(discountTotal, currency)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0 4px',
                fontSize: 16,
                fontWeight: 800,
                borderTop: '2px solid #e5e7eb',
                marginTop: 4
              }}
            >
              <span>Total</span>
              <span style={{ color: primary }}>{money(grandTotal, currency)}</span>
            </div>
          </Section>

          <Hr style={{ margin: '20px 0', borderColor: '#e5e7eb' }} />

          {/* CTA */}
          <Section style={{ textAlign: 'center' }}>
            <Link
              href={`${siteUrl}/shop`}
              style={{
                display: 'inline-block',
                backgroundColor: primary,
                color: '#fff',
                textDecoration: 'none',
                padding: '11px 24px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14
              }}
            >
              Continue shopping
            </Link>
          </Section>

          <Hr style={{ margin: '20px 0', borderColor: '#f3f4f6' }} />

          <Text style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px' }}>
            Questions? Reply to this email or contact us at{' '}
            <Link href={`mailto:${supportEmail}`} style={{ color: primary }}>
              {supportEmail}
            </Link>
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
            © {new Date().getFullYear()} Prince Foods · {siteUrl.replace(/^https?:\/\//, '')}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
