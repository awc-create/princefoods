export interface OfferEmailProduct {
  id: string;
  name: string;
  href: string;
  imageUrl?: string | null;
  pricePence?: number | null;
  categoryName?: string | null;
}

function chunkProducts<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export default function OfferEmail(props: {
  name?: string | null;
  title: string;
  message?: string | null;
  offerHeadline: string;
  siteUrl: string;

  logoUrl?: string | null;
  supportEmail?: string | null;
  primary?: string | null;

  sectionTitle?: string | null;
  products?: OfferEmailProduct[];
  ctaLabel?: string | null;
  ctaHref?: string | null;
}) {
  const {
    name,
    title,
    message,
    offerHeadline,
    siteUrl,
    logoUrl,
    supportEmail,
    primary,
    sectionTitle,
    products = [],
    ctaLabel,
    ctaHref
  } = props;

  const brandPrimary = primary ?? '#b21e2b';
  const finalSectionTitle = sectionTitle?.trim().length ? sectionTitle : 'Included products';

  const shownProducts = products.slice(0, 6);
  const rows = chunkProducts(shownProducts, 2);

  return (
    <div
      style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        lineHeight: 1.6,
        color: '#111111',
        background: '#f5f5f5',
        padding: '24px 0',
        margin: 0
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid #ececec'
        }}
      >
        <div style={{ padding: 24 }}>
          {logoUrl ? (
            <div style={{ marginBottom: 18 }}>
              <img
                src={logoUrl}
                alt="Prince Foods"
                style={{ height: 34, width: 'auto', display: 'block' }}
              />
            </div>
          ) : null}

          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: 8,
              color: '#111111'
            }}
          >
            {title}
          </div>

          {name ? <p style={{ margin: '0 0 10px', fontSize: 16 }}>Hi {name},</p> : null}

          {message ? (
            <p style={{ margin: '0 0 18px', fontSize: 15, color: '#4b5563' }}>{message}</p>
          ) : null}

          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: '#fafafa',
              border: '1px solid #e5e7eb',
              marginBottom: 22
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: 6
              }}
            >
              Offer
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                lineHeight: 1.15,
                color: '#111111'
              }}
            >
              {offerHeadline}
            </div>
          </div>

          {shownProducts.length ? (
            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  marginBottom: 12,
                  color: '#111111'
                }}
              >
                {finalSectionTitle}
              </div>

              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{ borderCollapse: 'separate', borderSpacing: '0 12px' }}
              >
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((p) => (
                        <td
                          key={p.id}
                          width="50%"
                          valign="top"
                          style={{
                            paddingRight: row.length === 2 && row[0]?.id === p.id ? 8 : 0,
                            paddingLeft: row.length === 2 && row[1]?.id === p.id ? 8 : 0
                          }}
                        >
                          <a
                            href={p.href}
                            style={{
                              display: 'block',
                              textDecoration: 'none',
                              color: '#111111',
                              border: '1px solid #e5e7eb',
                              borderRadius: 18,
                              overflow: 'hidden',
                              background: '#ffffff'
                            }}
                          >
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  height: 180,
                                  objectFit: 'cover',
                                  background: '#f3f4f6'
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '100%',
                                  height: 180,
                                  background: '#f3f4f6'
                                }}
                              />
                            )}

                            <div style={{ padding: 14 }}>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 800,
                                  lineHeight: 1.3,
                                  marginBottom: 4,
                                  minHeight: 42
                                }}
                              >
                                {p.name}
                              </div>

                              {p.categoryName ? (
                                <div
                                  style={{
                                    fontSize: 13,
                                    color: '#6b7280',
                                    marginBottom: 6
                                  }}
                                >
                                  {p.categoryName}
                                </div>
                              ) : null}

                              {typeof p.pricePence === 'number' ? (
                                <div
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: '#111111',
                                    marginBottom: 10
                                  }}
                                >
                                  £{(p.pricePence / 100).toFixed(2)}
                                </div>
                              ) : (
                                <div style={{ height: 24 }} />
                              )}

                              <div
                                style={{
                                  display: 'inline-block',
                                  padding: '10px 14px',
                                  borderRadius: 12,
                                  background: '#f3f4f6',
                                  color: '#111111',
                                  fontSize: 13,
                                  fontWeight: 700
                                }}
                              >
                                View product
                              </div>
                            </div>
                          </a>
                        </td>
                      ))}

                      {row.length === 1 ? <td width="50%" /> : null}
                    </tr>
                  ))}
                </tbody>
              </table>

              {products.length > shownProducts.length ? (
                <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                  Plus {products.length - shownProducts.length} more products in this offer.
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ marginBottom: 18 }}>
            <a
              href={ctaHref ?? siteUrl}
              style={{
                display: 'inline-block',
                padding: '14px 18px',
                borderRadius: 14,
                background: brandPrimary,
                color: '#ffffff',
                fontWeight: 800,
                textDecoration: 'none',
                fontSize: 15
              }}
            >
              {ctaLabel ?? 'Shop now'}
            </a>
          </div>

          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            <a href={siteUrl} style={{ color: '#6b7280' }}>
              Visit Prince Foods
            </a>
          </div>

          {supportEmail ? (
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Need help? Reply to this email or contact{' '}
              <a href={`mailto:${supportEmail}`} style={{ color: '#6b7280' }}>
                {supportEmail}
              </a>
              .
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
