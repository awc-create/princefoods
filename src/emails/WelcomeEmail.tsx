import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components';
import * as React from 'react';

export default function WelcomeEmail({
  name,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com',
  Brand = {
    logo: `${process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com'}/assets/prince-foods-logo.png`,
    primary: '#111111'
  }
}: {
  name?: string;
  siteUrl?: string;
  Brand?: { logo?: string; primary?: string };
}) {
  const first = (name ?? 'there').split(' ')[0];

  return (
    <Html>
      <Head />
      <Preview>Welcome to Prince Foods — your account is ready</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 8 }}>
            <Img src={Brand.logo} alt="Prince Foods" width="120" style={{ margin: '0 auto' }} />
          </Section>

          <Section style={styles.card}>
            <Text style={styles.h1}>Welcome, {first}! 🎉</Text>
            <Text style={styles.p}>
              Thanks for signing up with Prince Foods. You can now browse products, save favourites,
              and check out faster.
            </Text>

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

            <Text style={styles.meta}>
              If you didn’t create this account, reply to this email and we’ll help secure it.
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
  small: { marginTop: 10, fontSize: 12, color: '#666' },
  meta: { marginTop: 16, fontSize: 12, color: '#666' },
  footer: { marginTop: 24, fontSize: 12, color: '#8a8f98', textAlign: 'center' }
};
