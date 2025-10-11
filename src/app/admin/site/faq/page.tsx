'use client';

import type { FAQInboxItem, FAQItem, FAQSettingsDTO } from '@/types/faqSettings';
import { useCallback, useEffect, useMemo, useState } from 'react';
import s from '../home/SiteEditor.module.scss';

type Tab = 'faqs' | 'inbox';

interface AdminDTO extends FAQSettingsDTO {
  inbox?: FAQInboxItem[];
}

const DEFAULTS: AdminDTO = {
  heading: 'FAQs',
  subheading: 'Get answers to common questions.',
  items: [],
  inbox: []
};

export default function AdminFaqPage() {
  const [tab, setTab] = useState<Tab>('faqs');
  const [data, setData] = useState<AdminDTO>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/site/faq/get', { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; data?: AdminDTO; error?: string };
        if (!mounted) return;
        if (json.ok && json.data) {
          setData(json.data);
          setDirty(false);
        } else if (json.error) {
          setError(json.error);
        }
      } catch {
        if (mounted) setError('Failed to load FAQs');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Save
  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/site/faq/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heading: data.heading,
          subheading: data.subheading,
          items: data.items.map((it, i) => ({
            id: it.id,
            question: it.question,
            answer: it.answer,
            active: it.active ?? true,
            position: i
          }))
        })
      });
      const json = (await res.json()) as { ok: boolean; error?: string; notificationId?: string };
      if (!json.ok) throw new Error(json.error ?? 'Save failed');
      setDirty(false);
      setSavedAt(Date.now());

      // 🔔 Notify admin UI
      try {
        const bc = new BroadcastChannel('admin_notifications');
        bc.postMessage({
          type: 'notification:new',
          source: '/admin/site/faq',
          id: json.notificationId ?? null
        });
        bc.close();
      } catch {}
      try {
        window.dispatchEvent(new Event('admin:notif:new'));
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [data]);

  // Hotkey save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !saving) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, save]);

  // Leave guard
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const setPatch = (patch: Partial<AdminDTO>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  // Autosize helper
  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  };

  // Items helpers
  const setItems = (items: FAQItem[]) => setPatch({ items });
  const addItem = (q?: string) => {
    const id = `f_${Date.now()}`;
    setItems([{ id, question: q ?? 'New question', answer: '', active: true }, ...data.items]);
  };
  const updateItem = (idx: number, patch: Partial<FAQItem>) => {
    setItems(data.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => setItems(data.items.filter((_, i) => i !== idx));

  // DnD
  const onDragStart = (idx: number) => setDragIndex(idx);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) return;
    const next = [...data.items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    setDragIndex(null);
  };

  const faqsCount = useMemo(() => data.items.length, [data.items.length]);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div className={s.wrap}>
      <div className={s.container}>
        <div className={s.header}>
          <h1>FAQ Editor</h1>
          <div className={s.actions}>
            {error && <span className={`${s.statusText} ${s.statusError}`}>{error}</span>}
            {!error && dirty && !saving && (
              <span className={`${s.statusText} ${s.statusUnsaved}`}>Unsaved changes</span>
            )}
            {savedAt && !dirty && !error && (
              <span className={`${s.statusText} ${s.statusSaved}`}>All changes saved</span>
            )}
            <button
              className={s.saveBtn}
              onClick={save}
              disabled={saving || !dirty}
              title={!dirty ? 'No changes to save' : 'Save changes'}
            >
              {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>

        <div className={s.tabs} role="tablist" aria-label="FAQ sections">
          {(['faqs', 'inbox'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`${s.tab} ${tab === t ? s.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className={s.panel}>
          {/* Settings header */}
          {tab === 'faqs' && (
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <h2>Page Settings</h2>
              </div>
              <div className={s.sectionBody}>
                <label className={s.field}>
                  <span className={s.label}>Heading</span>
                  <input
                    className={s.input}
                    value={data.heading}
                    onChange={(e) => setPatch({ heading: e.target.value })}
                  />
                </label>
                <label className={s.field}>
                  <span className={s.label}>Subheading</span>
                  <textarea
                    className={`${s.input} ${s.textareaAuto ?? ''}`}
                    value={data.subheading ?? ''}
                    rows={1}
                    onChange={(e) => {
                      setPatch({ subheading: e.target.value });
                      autosize(e.currentTarget);
                    }}
                    ref={(el) => autosize(el)}
                    style={{ resize: 'none', overflow: 'hidden' }}
                  />
                </label>
              </div>
            </section>
          )}

          {/* FAQs list */}
          {tab === 'faqs' && (
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <h2>FAQs ({faqsCount})</h2>
              </div>
              <div className={s.sectionBody}>
                <div className={s.row}>
                  <button className={s.secondary} type="button" onClick={() => addItem()}>
                    + Add FAQ
                  </button>
                </div>

                {data.items.length === 0 && (
                  <div className={s.empty}>No FAQs yet. Click “Add FAQ”.</div>
                )}

                {data.items.map((f, idx) => (
                  <div
                    key={f.id}
                    className={s.card}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={onDragOver}
                    onDrop={() => onDrop(idx)}
                    title="Drag to reorder"
                    style={{ cursor: 'grab' }}
                  >
                    <div className={s.stack}>
                      <label className={s.field}>
                        <span className={s.label}>Question</span>
                        <input
                          className={s.input}
                          value={f.question}
                          onChange={(e) => updateItem(idx, { question: e.target.value })}
                          placeholder="Type the customer question…"
                        />
                      </label>

                      <label className={s.field}>
                        <span className={s.label}>Answer</span>
                        <textarea
                          className={`${s.input} ${s.textareaAuto ?? ''}`}
                          value={f.answer}
                          rows={1}
                          onChange={(e) => {
                            updateItem(idx, { answer: e.target.value });
                            autosize(e.currentTarget);
                          }}
                          ref={(el) => autosize(el)}
                          placeholder="Write a concise, helpful answer…"
                          style={{ resize: 'none', overflow: 'hidden' }}
                        />
                      </label>
                    </div>

                    <div className={s.rowRight}>
                      <label className={s.field} style={{ alignItems: 'center', margin: 0 }}>
                        <span className={s.label} style={{ marginRight: 8 }}>
                          Visible
                        </span>
                        <select
                          className={s.input}
                          style={{ width: 120 }}
                          value={f.active !== false ? '1' : '0'}
                          onChange={(e) => updateItem(idx, { active: e.target.value === '1' })}
                        >
                          <option value="1">Yes</option>
                          <option value="0">No</option>
                        </select>
                      </label>

                      <button className={s.danger} type="button" onClick={() => removeItem(idx)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Inbox (aggregated “asked” questions) */}
          {tab === 'inbox' && (
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <h2>Question Inbox</h2>
              </div>
              <div className={s.sectionBody}>
                {data.inbox && data.inbox.length > 0 ? (
                  <ul
                    style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}
                  >
                    {data.inbox.map((q) => (
                      <li key={q.id} className={s.card}>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ fontWeight: 800 }}>{q.question}</div>
                          <div style={{ fontSize: 12, opacity: 0.7, display: 'flex', gap: 10 }}>
                            <span>Asked: {q.askedCount}</span>
                            <time>{new Date(q.createdAt).toLocaleString()}</time>
                          </div>
                          <div className={s.row}>
                            <button className={s.secondary} onClick={() => addItem(q.question)}>
                              + Add to FAQs
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={s.empty}>No submissions yet.</div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
