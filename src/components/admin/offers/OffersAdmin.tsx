'use client';

import { useEffect, useState } from 'react';
import CreateOfferModal from './CreateOfferModal';
import EditOfferModal from './EditOfferModal';
import OffersTable from './OffersTable';

import type { OfferAdminForm } from '@/types/offers';

type OfferRow = OfferAdminForm & { id: string };

type ListResp = { offers: OfferAdminForm[] } | { error: string };
type CreateOfferResponse = { offer: OfferAdminForm } | { error: string };

interface BlastRunResponse {
  ok?: boolean;
  done?: boolean;
  sent?: number;
  failed?: number;
  remaining?: number;
  error?: string;
}

interface BlastCreateResponse {
  ok?: boolean;
  blastId?: string;
  recipients?: number;
  run?: BlastRunResponse;
  error?: string;
}

function isListResp(x: unknown): x is { offers: unknown[] } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'offers' in x &&
    Array.isArray((x as { offers?: unknown }).offers)
  );
}

function hasId(o: OfferAdminForm): o is OfferRow {
  return typeof (o as { id?: unknown }).id === 'string' && !!(o as { id?: string }).id;
}

function isCreateOfferWrapped(x: unknown): x is { offer: OfferAdminForm } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'offer' in x &&
    typeof (x as { offer?: unknown }).offer === 'object' &&
    (x as { offer?: unknown }).offer !== null
  );
}

function getErrorMessage(x: unknown, fallback: string) {
  if (
    typeof x === 'object' &&
    x !== null &&
    'error' in x &&
    typeof (x as { error?: unknown }).error === 'string'
  ) {
    return (x as { error: string }).error;
  }
  return fallback;
}

type OfferCreateSubmission = OfferAdminForm & {
  blastEnabled?: boolean;
  blastScope?: 'ALL_CUSTOMERS' | 'SELECTED_USERS';
  blastUserIds?: string[];
};

export default function OffersAdmin() {
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setPageError(null);

    try {
      const res = await fetch('/api/admin/offers', { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as ListResp | null;

      if (res.ok && json && isListResp(json)) {
        const list = (json.offers ?? []).filter(hasId);
        setRows(list);
      } else {
        setRows([]);
        setPageError(getErrorMessage(json, 'Failed to load offers.'));
      }
    } catch (e) {
      setRows([]);
      setPageError(e instanceof Error ? e.message : 'Failed to load offers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function onEdit(id: string) {
    setEditId(id);
    setEditOpen(true);
  }

  async function toggle(o: OfferRow) {
    setPageError(null);

    try {
      const res = await fetch(`/api/admin/offers/${o.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...o, status: o.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as unknown;
        throw new Error(getErrorMessage(json, 'Failed to update offer.'));
      }

      await load();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Failed to update offer.');
    }
  }

  async function remove(o: OfferRow) {
    if (!confirm(`Delete ${o.name}?`)) return;

    setPageError(null);

    try {
      const res = await fetch(`/api/admin/offers/${o.id}`, { method: 'DELETE' });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as unknown;
        throw new Error(getErrorMessage(json, 'Failed to delete offer.'));
      }

      await load();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Failed to delete offer.');
    }
  }

  async function createOfferApi(body: OfferAdminForm): Promise<OfferAdminForm> {
    console.log('🟡 [offers-admin] createOfferApi called', body);

    const res = await fetch('/api/admin/offers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    const json = (await res.json().catch(() => null)) as CreateOfferResponse | null;

    console.log('🟡 [offers-admin] createOfferApi response:', json);

    if (!res.ok) {
      throw new Error(getErrorMessage(json, 'Failed to create offer.'));
    }

    if (json && isCreateOfferWrapped(json)) {
      return json.offer;
    }

    throw new Error('Unexpected create offer response');
  }

  async function createOfferBlastApi(params: {
    offerId: string;
    scope: 'ALL_CUSTOMERS' | 'SELECTED_USERS';
    userIds: string[];
    subject: string;
    message: string | null;
  }): Promise<BlastCreateResponse> {
    console.log('🟡 [offers-admin] createOfferBlastApi called', params);

    const res = await fetch(`/api/admin/offers/${params.offerId}/email-blast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: params.scope,
        userIds: params.userIds,
        subject: params.subject,
        message: params.message
      })
    });

    const json = (await res.json().catch(() => null)) as BlastCreateResponse | null;

    console.log('🟡 [offers-admin] createOfferBlastApi response:', json);

    if (!res.ok || !json?.ok || !json?.blastId) {
      throw new Error(getErrorMessage(json, 'Offer created, but blast creation failed.'));
    }

    if (json.run?.ok === false) {
      throw new Error(json.run.error ?? 'Offer blast run failed.');
    }

    return json;
  }

  async function create(body: OfferCreateSubmission) {
    setPageError(null);

    try {
      console.log('🟡 [offers-admin] create start:', body);
      console.log('🟡 [offers-admin] blast flags:', {
        blastEnabled: body.blastEnabled,
        blastScope: body.blastScope,
        blastUserIds: body.blastUserIds,
        emailSubject: body.emailSubject,
        emailMessage: body.emailMessage
      });

      const created = await createOfferApi(body);

      console.log('🟢 [offers-admin] offer created:', created);

      const shouldBlast = body.blastEnabled === true;
      const subject = (body.emailSubject ?? '').trim();

      if (shouldBlast) {
        if (!created.id) {
          throw new Error('Offer created, but no offer id was returned.');
        }

        if (!subject) {
          throw new Error('Email subject is required when sending the offer email.');
        }

        const blastResult = await createOfferBlastApi({
          offerId: created.id as string,
          scope: body.blastScope ?? 'ALL_CUSTOMERS',
          userIds: body.blastScope === 'SELECTED_USERS' ? (body.blastUserIds ?? []) : [],
          subject,
          message: body.emailMessage ?? null
        });

        console.log('🟢 [offers-admin] blast result:', blastResult);
      } else {
        console.log('🟡 [offers-admin] blast skipped');
      }

      setCreateOpen(false);
      await load();
    } catch (e) {
      console.error('🔴 [offers-admin] create flow failed:', e);
      setPageError(e instanceof Error ? e.message : 'Failed to create offer.');
      throw e;
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Offers</h2>
        <button type="button" onClick={() => setCreateOpen(true)}>
          Create offer
        </button>
      </div>

      {pageError ? (
        <div style={{ marginBottom: 12, color: '#b42318', fontWeight: 600 }}>{pageError}</div>
      ) : null}

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
