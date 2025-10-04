// src/app/admin/page.tsx
'use client';

import ProductImageUpload from '@/components/image/ProductImageUpload';
import type {
  DeliverySettings,
  HeroSettings,
  HomeSettingsDTO,
  InstagramSettings,
  ProductShowcaseSettings,
  Promotion,
  PromotionTemplateKey,
  ReviewsSettings,
  ShowcaseKind,
  TimedText
} from '@/types/homeSettings';
import { useEffect, useMemo, useState } from 'react';
import s from './Admin.module.scss';

/* ==================== Defaults ==================== */
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
    imageUrl: '/assets/slider1.jpg',
    overrideStart: null,
    overrideEnd: null,
    titleOverride: undefined,
    subtitleOverride: undefined,
    floatingTagOverride: undefined
  },
  delivery: {
    gbFreeThreshold: 30,
    niFreeThreshold: 40,
    frozenFee: 3.99,
    message: 'No hidden fees. Frozen items are insulated for freshness.',
    overrideStart: null,
    overrideEnd: null,
    messageOverride: undefined
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

/* ==================== Timed override helpers ==================== */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const addDays = (d: Date, days: number) => {
  const t = new Date(d);
  t.setDate(t.getDate() + days);
  return t;
};

// Here we simply store whatever the input gives us (local datetime string).
// Your rendering layer can decide to treat it as local or convert to ISO/UTC.
function coerceIsoFromLocal(input: string): string {
  return input.trim();
}

function DateQuickButtons({
  start,
  end,
  onChange
}: {
  start?: string;
  end?: string;
  onChange: (patch: { startAt?: string; endAt?: string }) => void;
}) {
  const now = new Date();
  const plus7 = toLocalInput(addDays(now, 7));
  const plus30 = toLocalInput(addDays(now, 30));
  const nowStr = toLocalInput(now);

  return (
    <div className={s.inlineBtns}>
      <button type="button" onClick={() => onChange({ startAt: nowStr })}>
        Now (start)
      </button>
      <button type="button" onClick={() => onChange({ endAt: plus7 })}>
        +7d (end)
      </button>
      <button type="button" onClick={() => onChange({ endAt: plus30 })}>
        +30d (end)
      </button>
      <button type="button" onClick={() => onChange({ startAt: '', endAt: '' })}>
        Clear window
      </button>
      {start || end ? (
        <span className={s.helpSmall}>
          Window: {start ?? '—'} → {end ?? '—'}
        </span>
      ) : null}
    </div>
  );
}

function TimedOverrideFields({
  label,
  value,
  onChange
}: {
  label: string;
  value?: TimedText;
  onChange: (v: TimedText) => void;
}) {
  const v = value ?? {};
  const setPatch = (patch: { text?: string; startAt?: string; endAt?: string }) =>
    onChange({ ...v, ...patch });

  return (
    <fieldset className={s.timed}>
      <legend className={s.legend}>{label} (override)</legend>

      <div className={s.grid3}>
        <label className={s.field}>
          <span className={s.label}>Override Text</span>
          <input
            className={s.input}
            value={v.text ?? ''}
            onChange={(e) => setPatch({ text: e.target.value })}
            placeholder="Leave blank to disable override"
          />
        </label>

        <label className={s.field}>
          <span className={s.label}>Start At</span>
          <input
            type="datetime-local"
            className={s.input}
            value={v.startAt ?? ''}
            onChange={(e) => setPatch({ startAt: coerceIsoFromLocal(e.target.value) })}
          />
        </label>

        <label className={s.field}>
          <span className={s.label}>End At</span>
          <input
            type="datetime-local"
            className={s.input}
            value={v.endAt ?? ''}
            onChange={(e) => setPatch({ endAt: coerceIsoFromLocal(e.target.value) })}
          />
        </label>
      </div>

      <DateQuickButtons
        start={v.startAt ?? ''}
        end={v.endAt ?? ''}
        onChange={(patch) => onChange({ ...v, ...patch })}
      />

      <p className={s.help}>
        Set <strong>Start/End</strong> to limit when this override shows. If the window doesn’t
        match, the site automatically falls back to the base value (and then to hardcoded defaults).
      </p>
    </fieldset>
  );
}

/* ==================== Page ==================== */
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

  /* ---------- validation ---------- */
  const issues = useMemo(() => {
    const errs: string[] = [];
    const h = data.hero;
    const d = data.delivery;

    if (!h.title?.trim()) errs.push('Hero → Title is required.');
    if (!h.subtitle?.trim()) errs.push('Hero → Subtitle is required.');
    if (!h.primaryCtaLabel?.trim()) errs.push('Hero → Primary CTA Label is required.');
    if (!h.primaryCtaHref?.trim()) errs.push('Hero → Primary CTA Link is required.');

    if (typeof d.gbFreeThreshold !== 'number' || Number.isNaN(d.gbFreeThreshold))
      errs.push('Delivery → GB Free Threshold must be a number.');
    if (typeof d.niFreeThreshold !== 'number' || Number.isNaN(d.niFreeThreshold))
      errs.push('Delivery → NI Free Threshold must be a number.');
    if (typeof d.frozenFee !== 'number' || Number.isNaN(d.frozenFee))
      errs.push('Delivery → Frozen Packing Fee must be a number.');

    const maybeCheckIso = (label: string, iso?: string | null) => {
      if (!iso) return;
      const t = Date.parse(iso);
      if (Number.isNaN(t)) errs.push(`${label} must be a valid datetime (or leave empty).`);
    };

    const { titleOverride, subtitleOverride, floatingTagOverride } = data.hero;
    const { messageOverride } = data.delivery;

    maybeCheckIso('Hero → Title Override: Start At', titleOverride?.startAt ?? null);
    maybeCheckIso('Hero → Title Override: End At', titleOverride?.endAt ?? null);
    maybeCheckIso('Hero → Subtitle Override: Start At', subtitleOverride?.startAt ?? null);
    maybeCheckIso('Hero → Subtitle Override: End At', subtitleOverride?.endAt ?? null);
    maybeCheckIso('Hero → Tag Override: Start At', floatingTagOverride?.startAt ?? null);
    maybeCheckIso('Hero → Tag Override: End At', floatingTagOverride?.endAt ?? null);
    maybeCheckIso('Delivery → Message Override: Start At', messageOverride?.startAt ?? null);
    maybeCheckIso('Delivery → Message Override: End At', messageOverride?.endAt ?? null);

    return errs;
  }, [data]);

  const canSave = issues.length === 0 && !saving;

  const save = async () => {
    if (!canSave) return;
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
          {issues.length > 0 && (
            <span className={s.errorHint} role="alert" aria-live="polite">
              {issues.length} issue{issues.length > 1 ? 's' : ''} to fix
            </span>
          )}
          {savedAt && issues.length === 0 && <span className={s.savedHint}>Saved</span>}
          {error && <span className={s.errorHint}>{error}</span>}
          <button className={s.saveBtn} onClick={save} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className={s.issueBox}>
          <ul>
            {issues.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

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

/* ==================== Small form primitives ==================== */
function Field({
  label,
  children,
  help,
  required
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
  required?: boolean;
}) {
  return (
    <label className={s.field}>
      <span className={s.label}>
        {label}
        {required ? <span className={s.req}>*</span> : null}
      </span>
      {children}
      {help && <span className={s.help}>{help}</span>}
    </label>
  );
}

/* ==================== Section: Hero ==================== */
function HeroForm({
  value,
  onChange
}: {
  value: HeroSettings & {
    titleOverride?: TimedText;
    subtitleOverride?: TimedText;
    floatingTagOverride?: TimedText;
  };
  onChange: (
    v: HeroSettings & {
      titleOverride?: TimedText;
      subtitleOverride?: TimedText;
      floatingTagOverride?: TimedText;
    }
  ) => void;
}) {
  return (
    <div className={s.stack}>
      <div className={s.grid2}>
        <Field label="Title" required>
          <input
            className={s.input}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            aria-required
          />
        </Field>
        <Field label="Subtitle" required>
          <input
            className={s.input}
            value={value.subtitle}
            onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
            aria-required
          />
        </Field>
        <Field label="Primary CTA Label" required>
          <input
            className={s.input}
            value={value.primaryCtaLabel}
            onChange={(e) => onChange({ ...value, primaryCtaLabel: e.target.value })}
            aria-required
          />
        </Field>
        <Field label="Primary CTA Link" required>
          <input
            className={s.input}
            value={value.primaryCtaHref}
            onChange={(e) => onChange({ ...value, primaryCtaHref: e.target.value })}
            aria-required
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

        <Field label="Hero Image">
          <ProductImageUpload
            images={value.imageUrl ? [value.imageUrl] : []}
            setImages={(urls) => onChange({ ...value, imageUrl: urls[0] ?? '' })}
          />
          <span className={s.help}>Only the first uploaded image will be saved for the Hero.</span>
        </Field>

        <Field label="Floating Tag">
          <input
            className={s.input}
            value={value.floatingTag ?? ''}
            onChange={(e) => onChange({ ...value, floatingTag: e.target.value })}
          />
        </Field>
      </div>

      <TimedOverrideFields
        label="Title"
        value={value.titleOverride}
        onChange={(v) => onChange({ ...value, titleOverride: v })}
      />
      <TimedOverrideFields
        label="Subtitle"
        value={value.subtitleOverride}
        onChange={(v) => onChange({ ...value, subtitleOverride: v })}
      />
      <TimedOverrideFields
        label="Floating Tag"
        value={value.floatingTagOverride}
        onChange={(v) => onChange({ ...value, floatingTagOverride: v })}
      />
    </div>
  );
}

/* ==================== Section: Delivery ==================== */
function DeliveryForm({
  value,
  onChange
}: {
  value: DeliverySettings & { messageOverride?: TimedText };
  onChange: (v: DeliverySettings & { messageOverride?: TimedText }) => void;
}) {
  return (
    <div className={s.stack}>
      <div className={s.grid3}>
        <Field label="GB Free Threshold (£)" required>
          <input
            type="number"
            className={s.input}
            value={value.gbFreeThreshold}
            onChange={(e) => onChange({ ...value, gbFreeThreshold: Number(e.target.value) })}
            aria-required
          />
        </Field>
        <Field label="NI Free Threshold (£)" required>
          <input
            type="number"
            className={s.input}
            value={value.niFreeThreshold}
            onChange={(e) => onChange({ ...value, niFreeThreshold: Number(e.target.value) })}
            aria-required
          />
        </Field>
        <Field label="Frozen Packing Fee (£)" required>
          <input
            type="number"
            step="0.01"
            className={s.input}
            value={value.frozenFee}
            onChange={(e) => onChange({ ...value, frozenFee: Number(e.target.value) })}
            aria-required
          />
        </Field>
        <Field label="Message">
          <input
            className={s.input}
            value={value.message ?? ''}
            onChange={(e) => onChange({ ...value, message: e.target.value })}
          />
        </Field>
      </div>

      <TimedOverrideFields
        label="Delivery Message"
        value={value.messageOverride}
        onChange={(v) => onChange({ ...value, messageOverride: v })}
      />
    </div>
  );
}

/* ==================== Section: Instagram ==================== */
function InstagramForm({
  value,
  onChange
}: {
  value: InstagramSettings;
  onChange: (v: InstagramSettings) => void;
}) {
  const usernameDisplay =
    value.usernameUrl?.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') ?? '';
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
          value={value.usernameUrl ?? ''}
          onChange={(e) => onChange({ ...value, usernameUrl: e.target.value })}
          placeholder="https://www.instagram.com/yourhandle/"
        />
      </Field>
      <Field label="Access Token">
        <input
          className={s.input}
          value={value.token ?? ''}
          onChange={(e) => onChange({ ...value, token: e.target.value })}
          placeholder="Long-lived Basic Display token"
        />
      </Field>
      <div className={s.helpRow}>
        <span className={s.help}>
          Current handle:&nbsp;<strong>@{usernameDisplay || '—'}</strong>
        </span>
      </div>
    </div>
  );
}

/* ==================== Section: Promotions ==================== */
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

            <Field label="Image">
              <ProductImageUpload
                images={p.imageUrl ? [p.imageUrl] : []}
                setImages={(urls) => update(idx, { imageUrl: urls[0] ?? '' })}
              />
              <span className={s.help}>
                Only the first uploaded image will be saved for this promo.
              </span>
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

/* ==================== Section: Product Showcase ==================== */
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

/* ==================== Section: Reviews ==================== */
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
