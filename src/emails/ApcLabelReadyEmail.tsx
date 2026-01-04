// src/emails/ApcLabelReadyEmail.tsx
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components';
import * as React from 'react';

export default function ApcLabelReadyEmail({
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'https://www.prince-foods.com',
  orderId,
  displayId,
  waybill,
  productCode,
  trackingUrl
}: {
  siteUrl?: string;
  orderId: string;
  displayId?: string | null;
  waybill: string;
  productCode?: string | null;
  trackingUrl?: string | null;
}) {
  const siteBase = siteUrl.replace(/\/$/, '');
  const adminUrl = `${siteBase}/admin/orders/${orderId}`;

  return (
    <Html>
      <Head />
      <Preview>APC label ready — {displayId ?? orderId}</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.h1}>✅ APC Label Ready</Text>
            <Text style={styles.p}>Your APC shipment label is now available.</Text>

            <Hr style={styles.hr} />

            <Text style={styles.p}>
              <strong>Order:</strong> {displayId ?? orderId}
            </Text>

            <Text style={styles.p}>
              <strong>Waybill:</strong> {waybill}
            </Text>

            {productCode ? (
              <Text style={styles.p}>
                <strong>Service:</strong> {productCode}
              </Text>
            ) : null}

            {trackingUrl ? (
              <Text style={styles.p}>
                <strong>Tracking:</strong> <Link href={trackingUrl}>{trackingUrl}</Link>
              </Text>
            ) : null}

            <Text style={styles.p}>
              <strong>Admin:</strong> <Link href={adminUrl}>{adminUrl}</Link>
            </Text>

            <Hr style={styles.hr} />

            <Text style={styles.smallMuted}>
              Prince Foods • <Link href={siteBase}>{siteBase.replace(/^https?:\/\//, '')}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    background: '#f6f7f9',
    margin: 0,
    padding: 16,
    color: '#111',
    fontFamily: 'Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif'
  },
  container: { maxWidth: '620px', margin: '0 auto' },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 },
  h1: { fontSize: 18, fontWeight: 800, margin: 0, marginBottom: 10 },
  p: { fontSize: 14, color: '#333', lineHeight: 1.6, margin: '6px 0' },
  smallMuted: { marginTop: 10, fontSize: 12, color: '#8a8f98' },
  hr: { borderColor: '#eee', marginTop: 16, marginBottom: 12 }
};
