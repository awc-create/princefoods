'use client';
// src/app/admin/error.tsx
// Next.js App Router error boundary for all /admin routes.
// Catches render errors and displays them instead of a blank 500,
// so we can see exactly what's throwing.

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so it appears in docker compose logs
    console.error('[ADMIN ERROR BOUNDARY]', error);
  }, [error]);

  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'monospace',
        background: '#1a1a1a',
        color: '#f87171',
        minHeight: '100vh'
      }}
    >
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>❌ Admin Error</h1>

      <p style={{ marginBottom: '0.5rem', color: '#fbbf24' }}>
        <strong>Message:</strong> {error.message}
      </p>

      {error.digest && (
        <p style={{ marginBottom: '0.5rem', color: '#94a3b8' }}>
          <strong>Digest:</strong> {error.digest}
        </p>
      )}

      <pre
        style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#111',
          borderRadius: '6px',
          fontSize: '0.75rem',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          color: '#e2e8f0'
        }}
      >
        {error.stack}
      </pre>

      <button
        onClick={reset}
        style={{
          marginTop: '1.5rem',
          padding: '0.5rem 1.25rem',
          background: '#374151',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        Try again
      </button>
    </div>
  );
}
