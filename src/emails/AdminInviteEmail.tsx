// src/emails/AdminInviteEmail.tsx
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

type Role = 'STAFF' | 'VIEWER';

const ROLE_LABELS: Record<Role, string> = {
  STAFF: 'Staff',
  VIEWER: 'Viewer (read-only)'
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  STAFF: 'You can manage orders, products, customers and shipping.',
  VIEWER: 'You have read-only access to view orders, customers and reports.'
};

export default function AdminInviteEmail({
  name,
  role = 'STAFF',
  setPasswordUrl,
  adminUrl = 'https://admin.prince-v.com',
  logoUrl = 'https://prince-v.com/assets/prince-foods-logo.png',
  invitedBy,
  expiryDays = 7
}: {
  name: string;
  role?: Role;
  setPasswordUrl: string;
  adminUrl?: string;
  logoUrl?: string;
  invitedBy?: string;
  expiryDays?: number;
}) {
  const first = name.split(' ')[0];

  return (
    <Html>
      <Head />
      <Preview>
        You've been invited to the Prince Foods admin panel — set your password to get started
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          {/* Header */}
          <Section style={s.header}>
            <Img
              src={logoUrl}
              alt="Prince Foods"
              width="110"
              style={{ margin: '0 auto', display: 'block' }}
            />
          </Section>

          {/* Card */}
          <Section style={s.card}>
            {/* Internal badge */}
            <Section style={{ textAlign: 'center', marginBottom: 20 }}>
              <Text style={s.badge}>🔐 Admin Panel Invite</Text>
            </Section>

            <Text style={s.h1}>Hi {first},</Text>

            <Text style={s.p}>
              {invitedBy ? `${invitedBy} has` : 'You have been'} added you to the{' '}
              <strong>Prince Foods admin panel</strong> with the following access:
            </Text>

            {/* Role block */}
            <Section style={s.roleBlock}>
              <Text style={s.roleLabel}>{ROLE_LABELS[role]}</Text>
              <Text style={s.roleDesc}>{ROLE_DESCRIPTIONS[role]}</Text>
            </Section>

            <Hr style={s.hr} />

            <Text style={s.p}>
              Click below to set your password and activate your account. This link expires in{' '}
              <strong>{expiryDays} days</strong>.
            </Text>

            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={setPasswordUrl} style={s.cta}>
                Set your password
              </Button>
            </Section>

            <Text style={s.small}>
              Or copy this link into your browser:{' '}
              <Link href={setPasswordUrl} style={{ color: '#111', wordBreak: 'break-all' }}>
                {setPasswordUrl}
              </Link>
            </Text>

            <Hr style={s.hr} />

            <Text style={s.small}>
              Once your password is set, log in at:{' '}
              <Link href={adminUrl} style={{ color: '#111' }}>
                {adminUrl}
              </Link>
            </Text>

            <Text style={s.meta}>
              If you weren't expecting this invite, you can safely ignore this email. The link will
              expire automatically.
            </Text>
          </Section>

          {/* Footer */}
          <Text style={s.footer}>Prince Foods Admin · This is an internal system email</Text>
        </Container>
      </Body>
    </Html>
  );
}

const s: Record<string, React.CSSProperties> = {
  body: {
    background: '#f3f4f6',
    margin: 0,
    padding: '16px 0',
    fontFamily: 'Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif',
    color: '#111'
  },
  container: { maxWidth: '580px', margin: '0 auto' },
  header: {
    background: '#111827',
    borderRadius: '12px 12px 0 0',
    padding: '24px 20px',
    textAlign: 'center'
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderTop: 'none',
    borderRadius: '0 0 12px 12px',
    padding: '28px 32px'
  },
  badge: {
    display: 'inline-block',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 99,
    padding: '4px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    letterSpacing: 0.3
  },
  h1: { fontSize: 20, fontWeight: 700, margin: '0 0 12px' },
  p: { fontSize: 14, color: '#374151', lineHeight: 1.6, margin: '0 0 12px' },
  roleBlock: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '14px 16px',
    margin: '16px 0'
  },
  roleLabel: { fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: '#111' },
  roleDesc: { fontSize: 13, color: '#6b7280', margin: 0 },
  cta: {
    background: '#111827',
    color: '#fff',
    padding: '13px 28px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    textDecoration: 'none',
    display: 'inline-block'
  },
  small: { fontSize: 12, color: '#6b7280', margin: '12px 0 0', lineHeight: 1.5 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 20, lineHeight: 1.5 },
  hr: { borderColor: '#e5e7eb', margin: '20px 0' },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 20,
    padding: '0 16px'
  }
};
