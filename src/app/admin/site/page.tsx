// src/app/admin/site/page.tsx
'use client';

import type {
  DeliveryCard,
  DeliverySettings,
  HeroSettings,
  HomeSettingsDTO,
  InstagramSettings,
  ProductShowcaseSettings,
  Promotion,
  PromotionTemplateKey,
  ReviewsSettings,
  ShowcaseKind
} from '@/types/homeSettings';
import { useEffect, useState } from 'react';
import s from './SiteEditor.module.scss';

const DEFAULT_HERO = '/assets/96bfc4_3547f98fa8f54128b23c97aa34bf83b9~mv2.avif';

const DEFAULTS: HomeSettingsDTO = {
  hero: {
    title: 'South Asian Groceries, Delivered.',
    subtitle:
      'Since 2007—authentic Indian & Sri Lankan favourites with fast UK & Ireland delivery.',
    primaryCtaLabel: 'Shop Best Sellers',
    primaryCtaHref: '/shop',
    secondaryCtaLabel: 'Browse Collections',
    secondaryCtaHref: '/collections',
    floatingTag: 'New • Onam Favourites',
    images: [DEFAULT_HERO],
    imageUrl: DEFAULT_HERO
  },
  delivery: {
    gbFreeThreshold: 30,
    niFreeThreshold: 40,
    frozenFee: 3.99,
    message: 'No hidden fees. Frozen items are insulated for freshness.',
    cards: [
      {
        id: 'gb',
        title: 'Delivery – Great Britain',
        freeThreshold: 30,
        frozenFee: 3.99,
        enabled: true
      },
      {
        id: 'ni',
        title: 'Delivery – Northern Ireland',
        freeThreshold: 40,
        frozenFee: 3.99,
        enabled: true
      }
    ]
  },
  instagram: { token: '', usernameUrl: 'https://www.instagram.com/princefoodsuk/', enabled: true },
  promotions: [],
  productShowcase: {
    title: 'Featured',
    kinds: ['best_sellers', 'on_sale', 'b1g1', 'new_arrivals', 'trending', 'top_rated', 'seasonal'],
    selectedKind: 'best_sellers'
  },
  reviews: {
    autoplay: true,
    showCount: 4,
    items: [
      { id: 'r1', name: 'Asha', text: 'Amazing selection—my go-to for Kerala groceries.' },
      {
        id: 'r2',
        name: 'Rahul',
        text: 'Fast delivery and great prices. Frozen items arrived perfect.'
      }
    ]
  }
};

type Tab = 'hero' | 'delivery' | 'instagram' | 'promotions' | 'showcase' | 'reviews';

export default function SiteHomeEditor() {
  const [tab, setTab] = useState<Tab>('hero');
  const [data, setData] = useState<HomeSettingsDTO>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/site/home/get', { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; data?: HomeSettingsDTO };
        if (mounted && json?.ok && json.data) setData(json.data);
      } catch {
        // keep defaults
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/site/home/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!json?.ok) throw new Error('Save failed');
      setSavedAt(Date.now());
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const setPartial = <K extends keyof HomeSettingsDTO>(key: K, value: HomeSettingsDTO[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <h1>Home Page Editor</h1>
        <div className={s.actions}>
          {savedAt && <span className={s.savedHint}>Saved</span>}
          {error && <span className={s.errorHint}>{error}</span>}
          <button className={s.saveBtn} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className={s.tabs} role="tablist" aria-label="Home sections">
        {(['hero', 'delivery', 'instagram', 'promotions', 'showcase', 'reviews'] as Tab[]).map(
          (t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`${s.tab} ${tab === t ? s.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          )
        )}
      </div>

      <div className={s.panel}>
        {tab === 'hero' && <HeroForm value={data.hero} onChange={(v) => setPartial('hero', v)} />}

        {tab === 'delivery' && (
          <DeliveryForm value={data.delivery} onChange={(v) => setPartial('delivery', v)} />
        )}

        {tab === 'instagram' && (
          <InstagramForm value={data.instagram} onChange={(v) => setPartial('instagram', v)} />
        )}

        {tab === 'promotions' && (
          <PromotionsForm value={data.promotions} onChange={(v) => setPartial('promotions', v)} />
        )}

        {tab === 'showcase' && (
          <ShowcaseForm
            value={data.productShowcase}
            onChange={(v) => setPartial('productShowcase', v)}
          />
        )}

        {tab === 'reviews' && (
          <ReviewsForm value={data.reviews} onChange={(v) => setPartial('reviews', v)} />
        )}
      </div>
    </div>
  );
}

/* ----------------- section forms ----------------- */
function Field({
  label,
  children,
  help
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      {children}
      {help && <span className={s.help}>{help}</span>}
    </label>
  );
}

function HeroForm({
  value,
  onChange
}: {
  value: HeroSettings;
  onChange: (v: HeroSettings) => void;
}) {
  // images[] is canonical; keep imageUrl synced to first image for backwards compatibility
  const images = value.images ?? (value.imageUrl ? [value.imageUrl] : []);

  const setImage = (i: number, url: string) => {
    const next = [...images];
    next[i] = url;
    onChange({ ...value, images: next, imageUrl: next[0] ?? '' });
  };
  const addImage = () => onChange({ ...value, images: [...images, ''], imageUrl: images[0] ?? '' });
  const removeImage = (i: number) => {
    const next = images.filter((_, idx) => idx !== i);
    onChange({ ...value, images: next, imageUrl: next[0] ?? '' });
  };

  return (
    <div className={s.grid2}>
      <Field label="Title">
        <input
          className={s.input}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="Subtitle">
        <input
          className={s.input}
          value={value.subtitle}
          onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
        />
      </Field>
      <Field label="Primary CTA Label">
        <input
          className={s.input}
          value={value.primaryCtaLabel}
          onChange={(e) => onChange({ ...value, primaryCtaLabel: e.target.value })}
        />
      </Field>
      <Field label="Primary CTA Link">
        <input
          className={s.input}
          value={value.primaryCtaHref}
          onChange={(e) => onChange({ ...value, primaryCtaHref: e.target.value })}
        />
      </Field>
      <Field label="Secondary CTA Label">
        <input
          className={s.input}
          value={value.secondaryCtaLabel ?? ''}
          onChange={(e) => onChange({ ...value, secondaryCtaLabel: e.target.value })}
        />
      </Field>
      <Field label="Secondary CTA Link">
        <input
          className={s.input}
          value={value.secondaryCtaHref ?? ''}
          onChange={(e) => onChange({ ...value, secondaryCtaHref: e.target.value })}
        />
      </Field>
      <Field label="Floating Tag">
        <input
          className={s.input}
          value={value.floatingTag ?? ''}
          onChange={(e) => onChange({ ...value, floatingTag: e.target.value })}
        />
      </Field>

      {/* Images repeater */}
      <div className={s.field} style={{ gridColumn: '1 / -1' }}>
        <span className={s.label}>Hero Images (slider)</span>
        <div className={s.stack}>
          {images.length === 0 && <span className={s.help}>No images yet. Add one below.</span>}
          {images.map((url, i) => (
            <div key={i} className={s.row}>
              <input
                className={s.input}
                style={{ flex: 1 }}
                placeholder="/assets/… or https://…"
                value={url}
                onChange={(e) => setImage(i, e.target.value)}
              />
              <button type="button" className={s.secondary} onClick={() => removeImage(i)}>
                Remove
              </button>
            </div>
          ))}
          <div>
            <button type="button" className={s.secondary} onClick={addImage}>
              + Add Image
            </button>
          </div>
          <span className={s.help}>
            Tip: Put files in <code>/public/assets</code> and reference as <code>/assets/…</code>.
            First image shows first. Reorder by editing the rows.
          </span>
        </div>
      </div>
    </div>
  );
}

function DeliveryForm({
  value,
  onChange
}: {
  value: DeliverySettings;
  onChange: (v: DeliverySettings) => void;
}) {
  // Ensure GB/NI exist and are first
  const seedLocked = (cards: DeliveryCard[] | undefined): DeliveryCard[] => {
    const gb = cards?.find((c) => c.id === 'gb') ?? {
      id: 'gb',
      title: 'Delivery – Great Britain',
      freeThreshold: value.gbFreeThreshold ?? 30,
      frozenFee: value.frozenFee ?? 3.99,
      enabled: true
    };
    const ni = cards?.find((c) => c.id === 'ni') ?? {
      id: 'ni',
      title: 'Delivery – Northern Ireland',
      freeThreshold: value.niFreeThreshold ?? 40,
      frozenFee: value.frozenFee ?? 3.99,
      enabled: true
    };
    const rest = (cards ?? []).filter((c) => c.id !== 'gb' && c.id !== 'ni');
    return [gb, ni, ...rest];
  };

  const cards = seedLocked(value.cards);
  const locked = cards.slice(0, 2); // gb, ni
  const custom = cards.slice(2);

  const setCards = (next: DeliveryCard[]) => onChange({ ...value, cards: seedLocked(next) });

  const updateCard = (idx: number, patch: Partial<DeliveryCard>, isCustom = false) => {
    const next = [...cards];
    const offset = isCustom ? 2 : 0;
    next[idx + offset] = { ...next[idx + offset], ...patch };
    setCards(next);
  };

  const addCard = () => {
    const id = `d_${Date.now()}`;
    setCards([
      ...locked,
      { id, title: 'Delivery – Region', freeThreshold: 30, frozenFee: 3.99, enabled: true },
      ...custom
    ]);
  };

  const removeCustomCard = (idx: number) => {
    const nextCustom = custom.filter((_, i) => i !== idx);
    setCards([...locked, ...nextCustom]);
  };

  // --- Drag & drop for custom cards only ---
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const onDragStart = (idx: number) => setDragIndex(idx);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) return;
    const next = [...custom];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    setCards([...locked, ...next]);
    setDragIndex(null);
  };

  return (
    <div className={s.stack}>
      {/* Global/fallback fields */}
      <div className={s.grid3}>
        <Field label="GB Free Threshold (£)">
          <input
            type="number"
            className={s.input}
            value={value.gbFreeThreshold}
            onChange={(e) => onChange({ ...value, gbFreeThreshold: Number(e.target.value) })}
          />
        </Field>
        <Field label="NI Free Threshold (£)">
          <input
            type="number"
            className={s.input}
            value={value.niFreeThreshold}
            onChange={(e) => onChange({ ...value, niFreeThreshold: Number(e.target.value) })}
          />
        </Field>
        <Field label="Frozen Packing Fee (£)">
          <input
            type="number"
            step="0.01"
            className={s.input}
            value={value.frozenFee}
            onChange={(e) => onChange({ ...value, frozenFee: Number(e.target.value) })}
          />
        </Field>
        <Field label="Global Message">
          <input
            className={s.input}
            value={value.message ?? ''}
            onChange={(e) => onChange({ ...value, message: e.target.value })}
          />
        </Field>
      </div>

      {/* Locked cards (GB/NI): editable, not deletable, not draggable */}
      {locked.map((c, idx) => (
        <div key={c.id} className={s.card}>
          <div className={s.grid3}>
            <Field label={`Title (${c.id.toUpperCase()})`}>
              <input
                className={s.input}
                value={c.title}
                onChange={(e) => updateCard(idx, { title: e.target.value }, false)}
              />
            </Field>
            <Field label="Free Threshold (£)">
              <input
                type="number"
                className={s.input}
                value={c.freeThreshold}
                onChange={(e) => updateCard(idx, { freeThreshold: Number(e.target.value) }, false)}
              />
            </Field>
            <Field label="Frozen Fee (£)">
              <input
                type="number"
                step="0.01"
                className={s.input}
                value={c.frozenFee}
                onChange={(e) => updateCard(idx, { frozenFee: Number(e.target.value) }, false)}
              />
            </Field>
            <Field label="Card Message (optional)">
              <input
                className={s.input}
                value={c.message ?? ''}
                onChange={(e) => updateCard(idx, { message: e.target.value }, false)}
              />
            </Field>
            <Field label="Enabled">
              <select
                className={s.input}
                value={c.enabled !== false ? '1' : '0'}
                onChange={(e) => updateCard(idx, { enabled: e.target.value === '1' }, false)}
              >
                <option value="1">Yes (show)</option>
                <option value="0">No (hide)</option>
              </select>
            </Field>
          </div>

          <div className={s.row}>
            <button className={s.danger} disabled title="Default card cannot be deleted">
              Delete
            </button>
          </div>
        </div>
      ))}

      <div className={s.row}>
        <button className={s.secondary} onClick={addCard} type="button">
          + Add Delivery Card
        </button>
      </div>

      {/* Custom cards — draggable and deletable */}
      {custom.length === 0 && <div className={s.empty}>No custom delivery cards yet.</div>}

      {custom.map((c, idx) => (
        <div
          key={c.id}
          className={s.card}
          draggable
          onDragStart={() => onDragStart(idx)}
          onDragOver={onDragOver}
          onDrop={() => onDrop(idx)}
          title="Drag to reorder"
          style={{ cursor: 'grab' }}
        >
          <div className={s.grid3}>
            <Field label="Title">
              <input
                className={s.input}
                value={c.title}
                onChange={(e) => updateCard(idx, { title: e.target.value }, true)}
              />
            </Field>
            <Field label="Free Threshold (£)">
              <input
                type="number"
                className={s.input}
                value={c.freeThreshold}
                onChange={(e) => updateCard(idx, { freeThreshold: Number(e.target.value) }, true)}
              />
            </Field>
            <Field label="Frozen Fee (£)">
              <input
                type="number"
                step="0.01"
                className={s.input}
                value={c.frozenFee}
                onChange={(e) => updateCard(idx, { frozenFee: Number(e.target.value) }, true)}
              />
            </Field>
            <Field label="Card Message (optional)">
              <input
                className={s.input}
                value={c.message ?? ''}
                onChange={(e) => updateCard(idx, { message: e.target.value }, true)}
              />
            </Field>
            <Field label="Enabled">
              <select
                className={s.input}
                value={c.enabled !== false ? '1' : '0'}
                onChange={(e) => updateCard(idx, { enabled: e.target.value === '1' }, true)}
              >
                <option value="1">Yes (show)</option>
                <option value="0">No (hide)</option>
              </select>
            </Field>
          </div>

          <div className={s.row}>
            <button className={s.danger} onClick={() => removeCustomCard(idx)} type="button">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function InstagramForm({
  value,
  onChange
}: {
  value: InstagramSettings;
  onChange: (v: InstagramSettings) => void;
}) {
  return (
    <div className={s.grid2}>
      <Field label="Enabled">
        <select
          className={s.input}
          value={value.enabled ? '1' : '0'}
          onChange={(e) => onChange({ ...value, enabled: e.target.value === '1' })}
        >
          <option value="1">Yes</option>
          <option value="0">No</option>
        </select>
      </Field>
      <Field label="Username URL">
        <input
          className={s.input}
          value={value.usernameUrl}
          onChange={(e) => onChange({ ...value, usernameUrl: e.target.value })}
        />
      </Field>
      <Field label="Access Token">
        <input
          className={s.input}
          value={value.token}
          onChange={(e) => onChange({ ...value, token: e.target.value })}
          placeholder="Long-lived Basic Display token"
        />
      </Field>
    </div>
  );
}

const TEMPLATE_TEXT: Record<PromotionTemplateKey, string> = {
  onam: 'Celebrate Onam with traditional flavours.',
  vishu: 'Vishu specials—fresh starts & fresh flavours.',
  diwali: 'Diwali sweets & snacks—light up your table.',
  pongal: 'Pongal pantry picks for the harvest festival.',
  ramadan_eid: 'Ramadan & Eid essentials.',
  easter: 'Easter treats and springtime bakes.',
  christmas: 'Christmas cakes, spices & gifting.',
  new_year: 'New Year party snacks & spice up 2025.',
  summer_bbq: 'Summer BBQ marinades and grills.',
  back_to_uni: 'Back-to-Uni quick meals & snacks.'
};

function PromotionsForm({
  value,
  onChange
}: {
  value: Promotion[];
  onChange: (v: Promotion[]) => void;
}) {
  const add = (key: PromotionTemplateKey) => {
    const p: Promotion = {
      key,
      title: key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      message: TEMPLATE_TEXT[key],
      imageUrl: '/assets/promo.jpg',
      ctaLabel: 'Shop Now',
      ctaHref: '/shop',
      active: true
    };
    onChange([p, ...value]);
  };

  const update = (idx: number, patch: Partial<Promotion>) => {
    onChange(value.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className={s.stack}>
      <div className={s.templateBar}>
        {(Object.keys(TEMPLATE_TEXT) as PromotionTemplateKey[]).map((k) => (
          <button key={k} className={s.templateBtn} onClick={() => add(k)}>
            + {k.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {value.length === 0 && (
        <div className={s.empty}>No promotions yet. Choose a template above.</div>
      )}

      {value.map((p, idx) => (
        <div key={idx} className={s.card}>
          <div className={s.grid3}>
            <Field label="Title">
              <input
                className={s.input}
                value={p.title}
                onChange={(e) => update(idx, { title: e.target.value })}
              />
            </Field>
            <Field label="Message">
              <input
                className={s.input}
                value={p.message}
                onChange={(e) => update(idx, { message: e.target.value })}
              />
            </Field>
            <Field label="Active">
              <select
                className={s.input}
                value={p.active ? '1' : '0'}
                onChange={(e) => update(idx, { active: e.target.value === '1' })}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </Field>
            <Field label="Image URL">
              <input
                className={s.input}
                value={p.imageUrl}
                onChange={(e) => update(idx, { imageUrl: e.target.value })}
              />
            </Field>
            <Field label="CTA Label">
              <input
                className={s.input}
                value={p.ctaLabel}
                onChange={(e) => update(idx, { ctaLabel: e.target.value })}
              />
            </Field>
            <Field label="CTA Link">
              <input
                className={s.input}
                value={p.ctaHref}
                onChange={(e) => update(idx, { ctaHref: e.target.value })}
              />
            </Field>
          </div>

          <div className={s.row}>
            <button className={s.danger} onClick={() => remove(idx)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShowcaseForm({
  value,
  onChange
}: {
  value: ProductShowcaseSettings;
  onChange: (v: ProductShowcaseSettings) => void;
}) {
  const ALL: ShowcaseKind[] = [
    'best_sellers',
    'on_sale',
    'b1g1',
    'new_arrivals',
    'trending',
    'top_rated',
    'seasonal'
  ];

  const toggleKind = (k: ShowcaseKind) => {
    const exists = value.kinds.includes(k);
    const kinds = exists ? value.kinds.filter((x) => x !== k) : [...value.kinds, k];
    onChange({ ...value, kinds });
  };

  return (
    <div className={s.stack}>
      <Field label="Section Title">
        <input
          className={s.input}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>

      <div className={s.badges}>
        {ALL.map((k) => (
          <button
            key={k}
            type="button"
            className={`${s.badge} ${value.kinds.includes(k) ? s.badgeActive : ''}`}
            onClick={() => toggleKind(k)}
          >
            {k.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <Field label="Default Selection">
        <select
          className={s.input}
          value={value.selectedKind}
          onChange={(e) => onChange({ ...value, selectedKind: e.target.value as ShowcaseKind })}
        >
          {value.kinds.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function ReviewsForm({
  value,
  onChange
}: {
  value: ReviewsSettings;
  onChange: (v: ReviewsSettings) => void;
}) {
  const add = () => {
    const id = `r${Date.now()}`;
    onChange({
      ...value,
      items: [{ id, name: 'New Customer', text: 'Great service!' }, ...value.items]
    });
  };
  const update = (idx: number, patch: Partial<(typeof value.items)[number]>) => {
    onChange({ ...value, items: value.items.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  };
  const remove = (idx: number) =>
    onChange({ ...value, items: value.items.filter((_, i) => i !== idx) });

  return (
    <div className={s.stack}>
      <div className={s.grid3}>
        <Field label="Autoplay">
          <select
            className={s.input}
            value={value.autoplay ? '1' : '0'}
            onChange={(e) => onChange({ ...value, autoplay: e.target.value === '1' })}
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </Field>
        <Field label="Show Count">
          <input
            type="number"
            className={s.input}
            min={1}
            max={10}
            value={value.showCount}
            onChange={(e) => onChange({ ...value, showCount: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className={s.row}>
        <button className={s.secondary} onClick={() => add()}>
          + Add Review
        </button>
      </div>

      {value.items.length === 0 && <div className={s.empty}>No reviews yet.</div>}

      {value.items.map((r, idx) => (
        <div key={r.id} className={s.card}>
          <div className={s.grid2}>
            <Field label="Name">
              <input
                className={s.input}
                value={r.name}
                onChange={(e) => update(idx, { name: e.target.value })}
              />
            </Field>
            <Field label="Review">
              <input
                className={s.input}
                value={r.text}
                onChange={(e) => update(idx, { text: e.target.value })}
              />
            </Field>
          </div>
          <div className={s.row}>
            <button className={s.danger} onClick={() => remove(idx)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
