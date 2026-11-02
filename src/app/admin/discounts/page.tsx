// src/app/admin/discounts/page.tsx
/**
 * One door for discounts.
 *
 * Promotions, Offers and Customer Discounts are three separate engines with
 * overlapping purposes, and staff had to already know the taxonomy to pick the
 * right one — the Guide having to explain the difference twice was the tell.
 *
 * This is a signpost, not a rewrite: the three tools are untouched behind it.
 */
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const OPTIONS = [
  {
    href: '/admin/promotions',
    icon: '🎟️',
    title: 'Discount code',
    whenToUse: 'The customer types a code at checkout.',
    example: 'SUMMER10 for 10% off',
    detail: 'Best for email campaigns and one-off gestures, because you control who gets the code.'
  },
  {
    href: '/admin/offers',
    icon: '⚡',
    title: 'Automatic offer',
    whenToUse: 'Applies by itself when the basket qualifies. No code needed.',
    example: 'Buy one get one free · 3 for £5',
    detail: 'Best for shop-wide deals you want every customer to get without thinking about it.'
  },
  {
    href: '/admin/customer-discounts',
    icon: '👤',
    title: 'Customer discount',
    whenToUse: 'A standing discount for one particular customer.',
    example: '10% off everything, always',
    detail: 'Best for trade accounts and regulars. Applies automatically whenever they log in.'
  }
] as const;

export default function DiscountsHubPage() {
  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ margin: '0 0 4px' }}>Discounts</h1>
      <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: 14 }}>
        Three ways to take money off. Pick the one that matches how the customer gets it.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        {OPTIONS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              padding: '18px 20px',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: '#fff',
              textDecoration: 'none',
              color: '#111827'
            }}
          >
            <span aria-hidden style={{ fontSize: 26, lineHeight: 1.1 }}>
              {o.icon}
            </span>

            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 16, marginBottom: 3 }}>
                {o.title}
              </span>
              <span
                style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 6 }}
              >
                {o.whenToUse}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#1d4ed8',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 999,
                  padding: '2px 10px',
                  marginBottom: 8
                }}
              >
                e.g. {o.example}
              </span>
              <span style={{ display: 'block', fontSize: 13, color: '#6b7280', lineHeight: 1.45 }}>
                {o.detail}
              </span>
            </span>

            <span style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', marginTop: 4 }}>
              Open →
            </span>
          </Link>
        ))}
      </div>

      <p
        style={{
          marginTop: 22,
          padding: '12px 14px',
          borderRadius: 10,
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          color: '#4b5563',
          fontSize: 13.5,
          lineHeight: 1.5
        }}
      >
        <strong>Not sure?</strong> If the customer has to type something in, it&apos;s a discount
        code. If it should just happen at checkout, it&apos;s an automatic offer. If it follows one
        person around, it&apos;s a customer discount.
      </p>
    </div>
  );
}
