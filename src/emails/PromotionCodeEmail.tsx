// src/emails/PromotionCodeEmail.tsx

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso; // fallback
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function PromotionCodeEmail(props: {
  name?: string | null;
  code: string;
  title: string;
  message?: string | null;
  siteUrl: string;
  validFrom?: string | null;
  validTo?: string | null;
  logoUrl?: string | null;
  supportEmail?: string | null;
  primary?: string | null;
}) {
  const {
    name,
    code,
    title,
    message,
    siteUrl,
    validFrom,
    validTo,
    logoUrl,
    supportEmail,
    primary
  } = props;

  const brandPrimary = primary ?? '#b21e2b';
  const fromPretty = fmtDate(validFrom);
  const toPretty = fmtDate(validTo);

  return (
    <div
      style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        lineHeight: 1.6,
        color: '#111',
        background: '#ffffff',
        padding: 0,
        margin: 0
      }}
    >
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 18 }}>
        {logoUrl ? (
          <div style={{ marginBottom: 12 }}>
            {}
            <img src={logoUrl} alt="Prince Foods" style={{ height: 34 }} />
          </div>
        ) : null}

        <h2 style={{ margin: '0 0 10px' }}>{title}</h2>

        {name ? <p style={{ margin: '0 0 12px' }}>Hi {name},</p> : null}

        {message ? <p style={{ margin: '0 0 14px' }}>{message}</p> : null}

        <div
          style={{
            padding: 14,
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            background: '#fafafa'
          }}
        >
          <div style={{ fontSize: 12, color: '#6b7280' }}>Your code</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{code}</div>

          {fromPretty || toPretty ? (
            <div style={{ marginTop: 10, fontSize: 13, color: '#374151' }}>
              {fromPretty ? (
                <div>
                  Valid from: <strong>{fromPretty}</strong>
                </div>
              ) : null}
              {toPretty ? (
                <div>
                  Valid until: <strong>{toPretty}</strong>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 16 }}>
          <a
            href={`${siteUrl}/?promo=${encodeURIComponent(code)}`}
            style={{
              display: 'inline-block',
              padding: '12px 16px',
              borderRadius: 12,
              background: brandPrimary,
              color: '#fff',
              fontWeight: 800,
              textDecoration: 'none'
            }}
          >
            Shop now
          </a>
        </div>

        <p style={{ marginTop: 18, color: '#374151' }}>
          Enter the code at checkout to apply the discount.
        </p>

        {supportEmail ? (
          <p style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>
            Need help? Reply to this email or contact{' '}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
