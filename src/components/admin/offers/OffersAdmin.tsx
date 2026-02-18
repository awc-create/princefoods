// src/components/admin/offers/OffersAdmin.tsx
'use client';

import { useEffect, useState } from 'react';
import CreateOfferModal from './CreateOfferModal';
import EditOfferModal from './EditOfferModal';
import OffersTable from './OffersTable';

import type { OfferAdminForm } from '@/types/offers';

type OfferRow = OfferAdminForm & { id: string };

type ListResp = { offers: OfferAdminForm[] } | { error: string };

function isListResp(x: unknown): x is { offers: unknown[] } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'offers' in x &&
    Array.isArray((x as { offers?: unknown }).offers)
  );
}

function hasId(o: OfferAdminForm): o is OfferRow {
  return typeof o.id === 'string' && o.id.length > 0;
}

export default function OffersAdmin() {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    const res = await fetch('/api/admin/offers', { cache: 'no-store' });
    const json = (await res.json().catch(() => null)) as ListResp | null;

    if (res.ok && json && isListResp(json)) {
      const list = ((json as { offers: OfferAdminForm[] }).offers ?? []).filter(hasId);
      setRows(list);
    } else {
      setRows([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function onEdit(id: string) {
    setEditId(id);
    setEditOpen(true);
  }

  async function toggle(o: OfferRow) {
    await fetch(`/api/admin/offers/${o.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...o, status: o.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })
    });

    await load();
  }

  async function remove(o: OfferRow) {
    if (!confirm(`Delete ${o.name}?`)) return;
    await fetch(`/api/admin/offers/${o.id}`, { method: 'DELETE' });
    await load();
  }

  async function create(body: OfferAdminForm) {
    await fetch('/api/admin/offers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    setCreateOpen(false);
    await load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Offers</h2>
        <button type="button" onClick={() => setCreateOpen(true)}>
          Create offer
        </button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <OffersTable rows={rows} onEdit={onEdit} onToggle={toggle} onDelete={remove} />
      )}

      <CreateOfferModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={create} />

      <EditOfferModal
        open={editOpen}
        offerId={editId}
        onClose={() => {
          setEditOpen(false);
          setEditId(null);
        }}
        onSaved={load}
      />
    </div>
  );
}
