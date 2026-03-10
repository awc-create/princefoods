'use client';

import ImageUploader from '@/components/image/ImageUploader';
import type { AboutSettingsDTO, StatItem, ValueCard } from '@/types/aboutSettings';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import s from '../home/HomeClient.module.scss'; // reuse Home editor styles

type Tab = 'hero' | 'story' | 'stats' | 'values' | 'cta';

const DEFAULTS: AboutSettingsDTO = {
  hero: {
    title: 'Your Favourite South Asian Grocery — A Reminder of Home',
    subtitle: 'Quality, value & nostalgia in every bite',
    imageUrl: '/assets/about.png'
  },
  story: {
    heading: 'Our Story',
    paragraphs: [
      'Since 2007, Prince Foods has been proudly connecting South Asian communities...',
      'From everyday staples like rice, spices, and pulses to frozen delicacies and snacks...'
    ]
  },
  stats: [
    { id: 's1', title: '2007', subtitle: 'Year founded' },
    { id: 's2', title: 'UK & IE', subtitle: 'Nationwide delivery' },
    { id: 's3', title: 'Thousands', subtitle: 'Happy households' }
  ],
  values: [
    {
      id: 'v1',
      icon: '🌿',
      title: 'Authentic Ingredients',
      text: 'Carefully sourced staples and treats from trusted South Asian suppliers.'
    },
    {
      id: 'v2',
      icon: '🚚',
      title: 'Fast, Reliable Delivery',
      text: 'UK + Ireland-wide delivery with safe, temperature-aware handling.'
    },
    {
      id: 'v3',
      icon: '💰',
      title: 'Everyday Low Prices',
      text: 'Transparent value — no hidden markups, just fair pricing.'
    },
    {
      id: 'v4',
      icon: '❤️',
      title: 'Family-Run Since 2007',
      text: 'A brand built on trust, consistency, and community.'
    },
    {
      id: 'v5',
      icon: '🛒',
      title: 'Easy Online Ordering',
      text: 'Secure checkout and a simple shopping experience on any device.'
    }
  ],
  cta: { text: 'Browse Our Collections', href: '/collections' }
};

/** ---------- tiny helpers ---------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      {children}
    </label>
  );
}

function updateStat(
  data: AboutSettingsDTO,
  setPatch: (p: Partial<AboutSettingsDTO>) => void,
  idx: number,
  patch: Partial<StatItem>
) {
  setPatch({ stats: data.stats.map((st, i) => (i === idx ? { ...st, ...patch } : st)) });
}

function updateValue(
  data: AboutSettingsDTO,
  setPatch: (p: Partial<AboutSettingsDTO>) => void,
  idx: number,
  patch: Partial<ValueCard>
) {
  setPatch({ values: data.values.map((v, i) => (i === idx ? { ...v, ...patch } : v)) });
}

/** Auto-growing textarea */
function AutoGrowTextarea({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={`${s.input} ${s.textareaAuto}`}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
    />
  );
}

/** Known pages for CTA select */
const PAGE_OPTIONS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Collections', href: '/collections' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Cart', href: '/cart' },
  { label: 'Account', href: '/account' }
];

export default function AboutEditor() {
  const [tab, setTab] = useState<Tab>('hero');
  const [data, setData] = useState<AboutSettingsDTO>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/site/about/get', { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; data?: AboutSettingsDTO; error?: string };
        if (!mounted) return;
        if (json.ok && json.data) {
          setData(json.data);
          setDirty(false);
        } else if (json.error) {
          setError(json.error);
        }
      } catch {
        if (mounted) setError('Failed to load settings');
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
      // ensure each stat has an id (hidden in UI)
      const withIds: AboutSettingsDTO = {
        ...data,
        stats: data.stats.map((st) =>
          st.id ? st : { ...st, id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
        )
      };

      const res = await fetch('/api/admin/site/about/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withIds)
      });
      const json = (await res.json()) as { ok: boolean; error?: string; notificationId?: string };
      if (!json.ok) throw new Error(json.error ?? 'Save failed');
      setDirty(false);
      setSavedAt(Date.now());

      try {
        const bc = new BroadcastChannel('admin_notifications');
        bc.postMessage({
          type: 'notification:new',
          source: '/admin/site/about',
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

  // Patch helper
  const setPatch = useCallback((patch: Partial<AboutSettingsDTO>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  // Cmd/Ctrl+S
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

  // CTA page selection helpers
  const knownHrefs = useMemo(() => new Set(PAGE_OPTIONS.map((p) => p.href)), []);
  const ctaIsCustom = useMemo(() => !knownHrefs.has(data.cta.href), [knownHrefs, data.cta.href]);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div className={s.wrap}>
      <div className={s.container}>
        <div className={s.header}>
          <h1>About Page Editor</h1>
          <div className={s.actions}>
            {error && <span className={`${s.statusText} ${s.statusError}`}>{error}</span>}
            {!error && dirty && !saving && (
              <span className={`${s.statusText} ${s.statusUnsaved}`}>Unsaved changes</span>
            )}
            {savedAt && !dirty && !error && (
              <span className={`${s.statusText} ${s.statusSaved}`}>All changes saved</span>
            )}
            <button className={s.saveBtn} onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className={s.tabs} role="tablist" aria-label="About sections">
          {(['hero', 'story', 'stats', 'values', 'cta'] as Tab[]).map((t) => (
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
          {/* HERO */}
          {tab === 'hero' && (
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <h2>HERO</h2>
              </div>
              <div className={s.sectionBody}>
                <div className={s.grid2}>
                  <Field label="Title">
                    <input
                      className={s.input}
                      value={data.hero.title}
                      onChange={(e) => setPatch({ hero: { ...data.hero, title: e.target.value } })}
                    />
                  </Field>
                  <Field label="Subtitle">
                    <AutoGrowTextarea
                      value={data.hero.subtitle}
                      onChange={(v) => setPatch({ hero: { ...data.hero, subtitle: v } })}
                    />
                  </Field>
                </div>

                {/* File uploader (single image). Keeps imageUrl in sync. */}
                <div className={s.stack}>
                  <div className={s.uploaderSmall}>
                    <ImageUploader
                      label="Hero Image"
                      single
                      files={data.hero.imageUrl ? [data.hero.imageUrl] : []}
                      setFiles={(urls: string[]) =>
                        setPatch({ hero: { ...data.hero, imageUrl: urls[0] ?? '' } })
                      }
                      pathSegments={['site', 'about', 'hero']}
                      itemName={data.hero.title || 'about-hero'}
                      accept="image/*"
                    />
                  </div>
                  <Field label="Image URL (card under header)">
                    <input
                      className={s.input}
                      value={data.hero.imageUrl}
                      onChange={(e) =>
                        setPatch({ hero: { ...data.hero, imageUrl: e.target.value } })
                      }
                    />
                  </Field>
                </div>
              </div>
            </section>
          )}

          {/* STORY */}
          {tab === 'story' && (
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <h2>STORY</h2>
              </div>
              <div className={s.sectionBody}>
                <Field label="Heading">
                  <input
                    className={s.input}
                    value={data.story.heading}
                    onChange={(e) =>
                      setPatch({ story: { ...data.story, heading: e.target.value } })
                    }
                  />
                </Field>

                <div className={s.stack}>
                  {data.story.paragraphs.map((p, idx) => (
                    <div key={idx} className={s.row}>
                      <AutoGrowTextarea
                        value={p}
                        onChange={(v) =>
                          setPatch({
                            story: {
                              ...data.story,
                              paragraphs: data.story.paragraphs.map((t, i) => (i === idx ? v : t))
                            }
                          })
                        }
                        placeholder="Type your paragraph…"
                      />
                      <button
                        className={s.danger}
                        onClick={() =>
                          setPatch({
                            story: {
                              ...data.story,
                              paragraphs: data.story.paragraphs.filter((_, i) => i !== idx)
                            }
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  <button
                    className={s.secondary}
                    onClick={() =>
                      setPatch({
                        story: { ...data.story, paragraphs: [...data.story.paragraphs, ''] }
                      })
                    }
                  >
                    + Add Paragraph
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STATS (ID hidden) */}
          {tab === 'stats' && (
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <h2>STATS</h2>
              </div>
              <div className={s.sectionBody}>
                {data.stats.map((st, idx) => (
                  <div key={st.id || idx} className={s.card}>
                    <div className={s.grid3}>
                      <Field label="Title">
                        <input
                          className={s.input}
                          value={st.title}
                          onChange={(e) =>
                            updateStat(data, setPatch, idx, { title: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Subtitle">
                        <input
                          className={s.input}
                          value={st.subtitle ?? ''}
                          onChange={(e) =>
                            updateStat(data, setPatch, idx, { subtitle: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <div className={s.rowRight}>
                      <button
                        className={s.danger}
                        onClick={() => setPatch({ stats: data.stats.filter((_, i) => i !== idx) })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className={s.secondary}
                  onClick={() =>
                    setPatch({
                      stats: [
                        {
                          id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                          title: 'Title',
                          subtitle: ''
                        },
                        ...data.stats
                      ]
                    })
                  }
                >
                  + Add Stat
                </button>
              </div>
            </section>
          )}

          {/* VALUES */}
          {tab === 'values' && (
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <h2>VALUE CARDS</h2>
              </div>
              <div className={s.sectionBody}>
                {data.values.map((v, idx) => (
                  <div key={v.id} className={s.card}>
                    <div className={s.grid3}>
                      <Field label="Icon (emoji)">
                        <input
                          className={s.input}
                          value={v.icon ?? ''}
                          onChange={(e) =>
                            updateValue(data, setPatch, idx, { icon: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Title">
                        <input
                          className={s.input}
                          value={v.title}
                          onChange={(e) =>
                            updateValue(data, setPatch, idx, { title: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Text">
                        <AutoGrowTextarea
                          value={v.text}
                          onChange={(val) => updateValue(data, setPatch, idx, { text: val })}
                        />
                      </Field>
                    </div>
                    <div className={s.rowRight}>
                      <button
                        className={s.danger}
                        onClick={() =>
                          setPatch({ values: data.values.filter((_, i) => i !== idx) })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className={s.secondary}
                  onClick={() =>
                    setPatch({
                      values: [
                        { id: `v_${Date.now()}`, icon: '✨', title: 'New Value', text: '' },
                        ...data.values
                      ]
                    })
                  }
                >
                  + Add Value Card
                </button>
              </div>
            </section>
          )}

          {/* CTA with page dropdown */}
          {tab === 'cta' && (
            <section className={s.section}>
              <div className={s.sectionHeader}>
                <h2>CTA</h2>
              </div>
              <div className={s.sectionBody}>
                <div className={s.grid2}>
                  <Field label="Button Text">
                    <input
                      className={s.input}
                      value={data.cta.text}
                      onChange={(e) => setPatch({ cta: { ...data.cta, text: e.target.value } })}
                    />
                  </Field>

                  <Field label="Button Link">
                    <select
                      className={s.input}
                      value={ctaIsCustom ? '__custom' : data.cta.href}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__custom') {
                          // switch to custom; keep existing href (or blank)
                          setPatch({ cta: { ...data.cta, href: data.cta.href } });
                        } else {
                          setPatch({ cta: { ...data.cta, href: v } });
                        }
                      }}
                    >
                      {PAGE_OPTIONS.map((p) => (
                        <option key={p.href} value={p.href}>
                          {p.label}
                        </option>
                      ))}
                      <option value="__custom">Custom URL…</option>
                    </select>
                  </Field>
                </div>

                {ctaIsCustom && (
                  <div className={s.grid2} style={{ marginTop: 12 }}>
                    <Field label="Custom URL">
                      <input
                        className={s.input}
                        placeholder="https://example.com/your-page or /your-page"
                        value={data.cta.href}
                        onChange={(e) => setPatch({ cta: { ...data.cta, href: e.target.value } })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
