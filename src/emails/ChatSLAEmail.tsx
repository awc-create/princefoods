import * as React from 'react';
import { Html, Head, Preview, Body, Container, Section, Img, Text, Button, Hr } from '@react-email/components';

export default function ChatSLAEmail({
  threadId, preview, adminUrl, minutesOverdue, brand,
}: {
  threadId: string; preview: string; adminUrl: string; minutesOverdue: number; brand?: { primary?: string; logoUrl?: string; supportEmail?: string; }
}) {
  const primary = brand?.primary ?? '#D62828';
  const base = process.env.APP_BASE_URL ?? 'https://www.prince-foods.com';
  const logoUrl = brand?.logoUrl ?? `${base}/assets/prince-foods-logo.png`;
  const support = brand?.supportEmail ?? 'support@prince-foods.com';

  return (
    <Html>
      <Head />
      <Preview>{`Chat SLA breached • ${threadId}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 8 }}>
            <Img src={logoUrl} alt="Prince Foods" width="120" style={{ margin: '0 auto' }} />
          </Section>

          <Section style={styles.card}>
            <Text style={styles.eyebrow}>SLA Alert</Text>
            <Text style={styles.h1}>Customer chat needs attention</Text>
            <Text style={styles.meta}>
              <strong>Thread:</strong> {threadId}<br />
              <strong>Overdue:</strong> {minutesOverdue} min
            </Text>

            <Text style={styles.label}>Latest customer message</Text>
            <Section style={styles.quoteWrap}><Text style={styles.quote}>{preview}</Text></Section>

            <Button href={adminUrl} style={{ ...styles.button, backgroundColor: primary }}>
              Open in Admin
            </Button>

            <Text style={styles.fineprint}>
              You’re receiving this because you’re on the Prince Foods support list ({support}).
            </Text>
          </Section>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>Prince Foods • Automated Alert</Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body:{ background:'#f6f7f9', margin:0, padding:16, fontFamily:'Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif', color:'#111' },
  container:{ maxWidth:'620px', margin:'0 auto' },
  card:{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:20 },
  eyebrow:{ color:'#D62828', textTransform:'uppercase', fontSize:12, letterSpacing:'1px', margin:0, marginBottom:8 },
  h1:{ fontSize:20, fontWeight:700, margin:0, marginBottom:8 },
  meta:{ fontSize:13, color:'#555', marginBottom:16 },
  label:{ fontSize:12, textTransform:'uppercase', letterSpacing:'.6px', color:'#666', marginBottom:6 },
  quoteWrap:{ background:'#fafafa', border:'1px solid #eee', borderRadius:8, padding:12, marginBottom:18 },
  quote:{ margin:0, whiteSpace:'pre-wrap', lineHeight:'1.5' },
  button:{ display:'inline-block', color:'#fff', textDecoration:'none', borderRadius:10, padding:'12px 16px', fontWeight:700 },
  hr:{ borderColor:'#eee', marginTop:24, marginBottom:12 },
  footer:{ fontSize:12, color:'#8a8f98', textAlign:'center' },
};
