'use client';

// src/app/admin/site/home/HomeClient.tsx
import type { HomeSettingsDTO } from '@/types/homeSettings';
import { useCallback, useEffect, useMemo, useState } from 'react';
import s from './HomeClient.module.scss';

import DeliveryForm from '@/components/admin/site/home/delivery/DeliveryForm';
import HeroForm from '@/components/admin/site/home/hero/HeroForm';
import InstagramForm from '@/components/admin/site/home/instagram/InstagramForm';
import PromotionsForm from '@/components/admin/site/home/promotions/PromotionsForm';
import ReviewsForm from '@/components/admin/site/home/reviews/ReviewsForm';
import ShowcaseSectionsBuilder from '@/components/admin/site/home/showcase/ShowcaseSectionsBuilder';

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

const TAB_LABEL: Record<Tab, string> = {
  hero: 'Hero',
  delivery: 'Delivery',
  instagram: 'Instagram',
  promotions: 'Promotions',
  showcase: 'Showcase',
  reviews: 'Reviews'
};

export default function HomeClient() {
  const [tab, setTab] = useState<Tab>('hero');
  const [data, setData] = useState<HomeSettingsDTO>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  // load settings
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/site/home/get', { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; data?: HomeSettingsDTO; error?: string };
        if (!mounted) return;

        if (json?.ok && json.data) {
          setData(json.data);
          setDirty(false);
        } else if (json?.error) {
          setError(`Failed to load settings: ${json.error}`);
        } else {
          setError('Failed to load settings');
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

  const setPartial = useCallback(
    <K extends keyof HomeSettingsDTO>(key: K, value: HomeSettingsDTO[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    },
    []
  );

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/site/home/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = (await res.json()) as { ok: boolean; error?: string; notificationId?: string };
      if (!json?.ok) throw new Error(json?.error ?? 'Save failed');

      setSavedAt(Date.now());
      setDirty(false);

      try {
        const bc = new BroadcastChannel('admin_notifications');
        bc.postMessage({
          type: 'notification:new',
          source: '/admin/site/home',
          id: json.notificationId ?? null
        });
        bc.close();
      } catch {}
      try {
        window.dispatchEvent(new Event('admin:notif:new'));
      } catch {}
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [data]);

  // warn on unload
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

  const tabs = useMemo(() => Object.keys(TAB_LABEL) as Tab[], []);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div className={s.wrap}>
      <div className={s.container}>
        <div className={s.header}>
          <h1>Home Page Editor</h1>
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

        <div className={s.tabs} role="tablist" aria-label="Home sections">
          {(tabs as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`${s.tab} ${tab === t ? s.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        <div className={s.panel}>
          <section className={s.section}>
            <div className={s.sectionHeader}>
              <h2>{TAB_LABEL[tab]}</h2>
            </div>

            <div className={s.sectionBody}>
              {tab === 'hero' && (
                <HeroForm value={data.hero} onChange={(v) => setPartial('hero', v)} />
              )}
              {tab === 'delivery' && (
                <DeliveryForm value={data.delivery} onChange={(v) => setPartial('delivery', v)} />
              )}
              {tab === 'instagram' && (
                <InstagramForm
                  value={data.instagram}
                  onChange={(v) => setPartial('instagram', v)}
                />
              )}
              {tab === 'promotions' && (
                <PromotionsForm
                  value={data.promotions}
                  onChange={(v) => setPartial('promotions', v)}
                />
              )}
              {tab === 'showcase' && <ShowcaseSectionsBuilder />}

              {tab === 'reviews' && (
                <ReviewsForm value={data.reviews} onChange={(v) => setPartial('reviews', v)} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
