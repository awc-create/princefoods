// src/emails/WelcomeEmail.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components';
import * as React from 'react';

interface CategoryTeaser {
  title: string;
  href: string;
  image: string;
}
interface ProductTeaser {
  id: string;
  title: string;
  href: string;
  image: string;
  price?: number | null;
}

export default function WelcomeEmail({
  name,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com',
  Brand = {
    logo:
      `${process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com'}` +
      '/assets/prince-foods-logo.png',
    primary: '#111111'
  },
  categories,
  bestSellers,
  // NEW: verification bits
  verificationCode, // e.g. "416829"
  verifyUrl, // e.g. `${siteUrl}/verify?email=...&token=...`
  expiresInMinutes = 15,
  supportEmail = 'support@princefoods.co.uk'
}: {
  name?: string;
  siteUrl?: string;
  Brand?: { logo?: string; primary?: string };
  categories?: CategoryTeaser[];
  bestSellers?: ProductTeaser[];
  verificationCode?: string;
  verifyUrl?: string;
  expiresInMinutes?: number;
  supportEmail?: string;
}) {
  const first = (name ?? 'there').split(' ')[0];

  const codePretty = (verificationCode ?? '').replace(/\s+/g, '').split('').join(' ') || undefined;

  return (
    <Html>
      <Head />
      <Preview>
        Welcome to Prince Foods —{' '}
        {verificationCode ? 'Verify your email to finish setup' : 'your account is ready'}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 8 }}>
            <Img
              src={Brand.logo ?? ''}
              alt="Prince Foods"
              width="120"
              style={{ margin: '0 auto' }}
            />
          </Section>

          <Section style={styles.card}>
            <Text style={styles.h1}>Welcome, {first}! 🎉</Text>
            <Text style={styles.p}>
              Thanks for signing up with Prince Foods. You can now browse products, save favourites,
              and check out faster.
            </Text>

            {(verificationCode ?? verifyUrl) && (
              <>
                <Hr style={styles.hr} />
                <Text style={styles.sectionTitle}>Verify your email</Text>

                {verificationCode && (
                  <>
                    <Text style={styles.p}>Enter this code to verify your account:</Text>
                    <Section style={styles.otpWrap}>
                      <Text style={styles.otp}>{codePretty}</Text>
                    </Section>
                    <Text style={styles.smallMuted}>
                      This code expires in {expiresInMinutes} minutes.
                    </Text>
                  </>
                )}

                {verifyUrl && (
                  <Section style={{ textAlign: 'center', marginTop: 12 }}>
                    <Button
                      href={verifyUrl}
                      style={{ ...styles.cta, backgroundColor: Brand.primary ?? '#111' }}
                    >
                      Verify now
                    </Button>
                    <Text style={styles.small}>
                      Or paste this link:&nbsp;
                      <Link href={verifyUrl}>{verifyUrl}</Link>
                    </Text>
                  </Section>
                )}
              </>
            )}

            <Hr style={styles.hr} />
            <Section style={{ textAlign: 'center', marginTop: 10 }}>
              <Button
                href={`${siteUrl}/account`}
                style={{ ...styles.cta, backgroundColor: Brand.primary ?? '#111' }}
              >
                Go to your account
              </Button>
              <Text style={styles.small}>
                Or paste this link:&nbsp;
                <Link href={`${siteUrl}/account`}>{siteUrl}/account</Link>
              </Text>
            </Section>

            {!!(bestSellers && bestSellers.length) && (
              <>
                <Hr style={styles.hr} />
                <Text style={styles.sectionTitle}>Popular right now</Text>
                <Section style={styles.grid3}>
                  {bestSellers.slice(0, 6).map((p) => (
                    <Link key={p.id} href={`${siteUrl}${p.href}`} style={styles.cardMini}>
                      <Img
                        src={p.image}
                        alt={p.title}
                        width="160"
                        height="120"
                        style={styles.thumb}
                      />
                      <Text style={styles.cardTitle}>{p.title}</Text>
                      {p.price != null && (
                        <Text style={styles.cardPrice}>£{Number(p.price).toFixed(2)}</Text>
                      )}
                    </Link>
                  ))}
                </Section>
              </>
            )}

            {!!(categories && categories.length) && (
              <>
                <Hr style={styles.hr} />
                <Text style={styles.sectionTitle}>Shop by category</Text>
                <Section style={styles.grid3}>
                  {categories.slice(0, 6).map((c, i) => (
                    <Link
                      key={`${c.href}-${i}`}
                      href={`${siteUrl}${c.href}`}
                      style={styles.cardMini}
                    >
                      <Img
                        src={c.image}
                        alt={c.title}
                        width="160"
                        height="120"
                        style={styles.thumb}
                      />
                      <Text style={styles.cardTitle}>{c.title}</Text>
                    </Link>
                  ))}
                </Section>
              </>
            )}

            <Hr style={styles.hr} />
            <Text style={styles.meta}>
              If you didn’t create this account, reply to this email or contact us at{' '}
              <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link> and we’ll help secure it.
            </Text>
          </Section>

          <Text style={styles.footer}>Prince Foods • {siteUrl.replace(/^https?:\/\//, '')}</Text>
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
  h1: { fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 10 },
  p: { fontSize: 14, color: '#333', lineHeight: 1.6 },
  cta: {
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 10,
    padding: '12px 16px',
    fontWeight: 700,
    display: 'inline-block'
  },
  small: { marginTop: 10, fontSize: 12, color: '#666', wordBreak: 'break-all' },
  smallMuted: { marginTop: 6, fontSize: 12, color: '#8a8f98' },

  sectionTitle: { marginTop: 6, marginBottom: 8, fontSize: 14, fontWeight: 700 },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10
  },
  cardMini: {
    display: 'block',
    textDecoration: 'none',
    color: '#111',
    border: '1px solid #eee',
    borderRadius: 10,
    padding: 10,
    background: '#fff'
  },
  thumb: {
    width: '100%',
    height: 'auto',
    borderRadius: 8,
    display: 'block',
    marginBottom: 6
  },
  cardTitle: { fontSize: 13, fontWeight: 600, margin: 0 },
  cardPrice: { fontSize: 12, color: '#555', marginTop: 2 },

  otpWrap: { textAlign: 'center', marginTop: 8 },
  otp: {
    display: 'inline-block',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: 22,
    letterSpacing: 6,
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    fontWeight: 700
  },

  hr: { borderColor: '#eee', marginTop: 16, marginBottom: 12 },
  meta: { marginTop: 8, fontSize: 12, color: '#666' },
  footer: { marginTop: 24, fontSize: 12, color: '#8a8f98', textAlign: 'center' }
};
