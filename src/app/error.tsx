'use client';
// src/app/error.tsx
// Root-level error boundary — catches anything not caught by a nested error.tsx

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GLOBAL ERROR BOUNDARY]', error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          background: '#0f172a',
          color: '#f1f5f9',
          fontFamily: 'monospace',
          padding: '2rem'
        }}
      >
        <h1 style={{ color: '#f87171' }}>❌ Something went wrong</h1>
        <p style={{ color: '#fbbf24' }}>{error.message}</p>
        {error.digest && <p style={{ color: '#94a3b8' }}>Digest: {error.digest}</p>}
        <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
          {error.stack}
        </pre>
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#374151',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
