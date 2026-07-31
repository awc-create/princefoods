// src/app/admin/shipping/shipping-client.tsx
'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import { useEffect, useMemo, useState } from 'react';
import {
  ALL_UK_POSTCODE_AREAS,
  PRESET_AREAS,
  PRESET_LABELS,
  UK_AREA_NAMES,
  normalizeAreaPrefix,
  normalizeOutcode,
  type PresetKey
} from './geo';
import styles from './shipping.module.scss';

type CountryCode = 'GB' | 'IE';
type RateType = 'FREE' | 'FLAT' | 'WEIGHT' | 'PRICE' | 'QUANTITY';
type Temp = 'DRY' | 'FROZEN';
type Service = 'STANDARD' | 'EXPRESS';

function isErr(x: ApiZones | ApiCreateZone | ApiOkOrErr | ApiCreateRate): x is ApiErr {
  return !!x && typeof x === 'object' && 'ok' in x && (x as { ok: boolean }).ok === false;
}

function errMsg(
  x: ApiZones | ApiCreateZone | ApiOkOrErr | ApiCreateRate,
  fallback: string
): string {
  return isErr(x) ? x.error : fallback;
}

interface ZoneRule {
  id: string;
  countryCode: string;
  postcodePrefix: string | null;
  postcodeRegex: string | null;
}

interface Tier {
  id: string;
  minGramsExclusive: number;
  maxGramsInclusive: number | null;
  pricePence: number;
}

interface Rate {
  id: string;
  temp: Temp;
  service: Service;
  currency: string;
  freeOverPence: number | null;
  tiers: Tier[];
}

interface Zone {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  notes: string | null;
  rules: ZoneRule[];
  rates: Rate[];
}

interface ApiZonesOk {
  ok: true;
  zones: Zone[];
}
interface ApiErr {
  ok: false;
  error: string;
}
type ApiZones = ApiZonesOk | ApiErr;

interface ApiCreateZoneOk {
  ok: true;
  zone: { id: string };
}
type ApiCreateZone = ApiCreateZoneOk | ApiErr;

interface ApiOk {
  ok: true;
}
type ApiOkOrErr = ApiOk | ApiErr;

interface ApiCreateRateOk {
  ok: true;
  rate: { id: string };
}
type ApiCreateRate = ApiCreateRateOk | ApiErr;

function money(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

function parseCsv(raw: string): string[] {
  return uniqSorted(
    (raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isBlocked(notes: string | null): boolean {
  return (notes ?? '').includes('[BLOCK]');
}

function withBlock(notes: string | null, on: boolean): string | null {
  const base = (notes ?? '').replace(/\s*\[BLOCK\]\s*/g, ' ').trim();
  return on ? `${base ? base + ' ' : ''}[BLOCK]` : base || null;
}

/**
 * We store optional “exclude” rules as tagged regex.
 * This requires your matcher to treat rules whose postcodeRegex starts with "[EXCLUDE]"
 * as a disqualifier.
 */
const EXCLUDE_TAG = '[EXCLUDE]';

function buildExcludeRegex(prefix: string): string {
  // Matches beginning of postcode/outcode/area
  return `^${prefix}\\b`;
}

/* =========================
   Rate Editor Modal
   ========================= */

interface RateTierDraft {
  from: number; // kg for WEIGHT, £ for PRICE, qty for QUANTITY
  to: number | null;
  priceGBP: number;
}

interface RateEditorModalProps {
  zoneId: string;
  onClose: () => void;
  onSaved: () => void;
}

function RateEditorModal({ zoneId, onClose, onSaved }: RateEditorModalProps) {
  const [rateType, setRateType] = useState<RateType>('WEIGHT');
  const { toast } = useAdminUi();
  const [temp, setTemp] = useState<Temp>('DRY');
  const [service, setService] = useState<Service>('STANDARD');
  const [currency, setCurrency] = useState('GBP');

  const [nameAtCheckout, setNameAtCheckout] = useState('Shipping');
  const [etaText, setEtaText] = useState('3–5 Business Days');

  const [flatRateGBP, setFlatRateGBP] = useState<number>(0);

  const [freeOverOn, setFreeOverOn] = useState(false);
  const [freeOverGBP, setFreeOverGBP] = useState<number>(30);

  const [tiers, setTiers] = useState<RateTierDraft[]>([
    { from: 0, to: 1, priceGBP: 3.0 },
    { from: 1, to: 2, priceGBP: 3.49 },
    { from: 2, to: 5, priceGBP: 5.0 },
    { from: 5, to: 10, priceGBP: 6.49 },
    { from: 10, to: 15, priceGBP: 9.49 },
    { from: 15, to: null, priceGBP: 14.99 }
  ]);

  const [saving, setSaving] = useState(false);

  function labels() {
    if (rateType === 'WEIGHT') return { left: 'From (kg, excl)', right: 'Up to (kg, incl)' };
    if (rateType === 'PRICE') return { left: 'From (£, excl)', right: 'Up to (£, incl)' };
    if (rateType === 'QUANTITY') return { left: 'From (qty, excl)', right: 'Up to (qty, incl)' };
    return { left: 'From', right: 'Up to' };
  }

  function updateTier(i: number, patch: Partial<RateTierDraft>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((prev) => {
      const last = prev.at(-1);
      const from = last?.to ?? last?.from ?? 0;
      return [...prev, { from: typeof from === 'number' ? from : 0, to: null, priceGBP: 0 }];
    });
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function scaleForType(t: RateType): number {
    // DB tiers are grams-based. We map:
    // WEIGHT: kg -> grams (x1000)
    // PRICE: £ -> pennies (x100)
    // QUANTITY: items -> x1
    // FLAT handled separately
    return t === 'WEIGHT' ? 1000 : t === 'PRICE' ? 100 : 1;
  }

  async function save() {
    setSaving(true);
    try {
      // Store some meta in a JSON string; your API can ignore it safely if not implemented
      const meta = JSON.stringify({
        rateType,
        nameAtCheckout,
        etaText,
        flatRatePence: Math.round(flatRateGBP * 100)
      });

      const res = await fetch('/api/admin/shipping/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId,
          temp,
          service,
          currency,
          freeOverPence: freeOverOn ? Math.round(freeOverGBP * 100) : null,
          meta
        })
      });

      const json = (await res.json()) as ApiCreateRate;
      if (!res.ok || !json.ok) throw new Error('Failed to create rate');

      const rateId = json.rate.id;

      if (rateType === 'FREE') {
        onSaved();
        onClose();
        return;
      }

      const tiersToWrite: RateTierDraft[] =
        rateType === 'FLAT' ? [{ from: 0, to: null, priceGBP: flatRateGBP }] : tiers;

      const scale = scaleForType(rateType);

      for (const t of tiersToWrite) {
        const min = Math.trunc(Math.max(0, t.from) * scale);
        const max = t.to == null ? null : Math.trunc(Math.max(0, t.to) * scale);
        const pricePence = Math.trunc(Math.max(0, t.priceGBP) * 100);

        await fetch(`/api/admin/shipping/rates/${rateId}/tiers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            minGramsExclusive: min,
            maxGramsInclusive: max,
            pricePence
          })
        });
      }

      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save rate');
    } finally {
      setSaving(false);
    }
  }

  const l = labels();

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Add shipping rate">
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalTitle}>Add a shipping rate</div>
            <div className={styles.modalSub}>
              Choose how shipping is calculated for customers in this zone.
            </div>
          </div>
          <button className={styles.iconBtn} type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalGrid}>
          <div className={styles.formRow}>
            <label>Rate calculation</label>
            <select value={rateType} onChange={(e) => setRateType(e.target.value as RateType)}>
              <option value="FREE">Free shipping</option>
              <option value="FLAT">Flat rate</option>
              <option value="WEIGHT">Rate by weight</option>
              <option value="PRICE">Rate by price</option>
              <option value="QUANTITY">Rate by quantity</option>
            </select>
            <div className={styles.hint}>This controls what customers pay at checkout.</div>
          </div>

          <div className={styles.formRow}>
            <label>Delivery method</label>
            <div className={styles.row2}>
              <select value={service} onChange={(e) => setService(e.target.value as Service)}>
                <option value="STANDARD">Standard</option>
                <option value="EXPRESS">Express</option>
              </select>

              <select value={temp} onChange={(e) => setTemp(e.target.value as Temp)}>
                <option value="DRY">Dry</option>
                <option value="FROZEN">Frozen</option>
              </select>
            </div>
            <div className={styles.hint}>Separate pricing per service and temperature.</div>
          </div>

          <div className={styles.formRow}>
            <label>Name at checkout</label>
            <input value={nameAtCheckout} onChange={(e) => setNameAtCheckout(e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Estimated delivery time (optional)</label>
            <input value={etaText} onChange={(e) => setEtaText(e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label>Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>

          {rateType === 'FLAT' && (
            <div className={styles.formRow}>
              <label>Flat rate (£)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={flatRateGBP}
                onChange={(e) => setFlatRateGBP(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        {(rateType === 'WEIGHT' || rateType === 'PRICE' || rateType === 'QUANTITY') && (
          <div className={styles.tiers}>
            <div className={styles.tiersHead}>
              <div>
                <div className={styles.sectionTitle}>Ranges</div>
                <div className={styles.sectionSub}>
                  {rateType === 'WEIGHT' && 'Based on total cart weight.'}
                  {rateType === 'PRICE' && 'Based on cart subtotal.'}
                  {rateType === 'QUANTITY' && 'Based on number of items.'}
                </div>
              </div>
              <button className={styles.ghostBtn} type="button" onClick={addTier}>
                + Add another range
              </button>
            </div>

            <div className={styles.tierTable}>
              <div className={styles.tierHeader}>
                <div>{l.left}</div>
                <div>{l.right}</div>
                <div>Rate (£)</div>
                <div />
              </div>

              {tiers.map((t, i) => (
                <div className={styles.tierRow} key={i}>
                  <input
                    type="number"
                    min={0}
                    step={rateType === 'WEIGHT' ? '0.1' : '1'}
                    value={t.from}
                    onChange={(e) => updateTier(i, { from: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    min={0}
                    step={rateType === 'WEIGHT' ? '0.1' : '1'}
                    value={t.to ?? ''}
                    placeholder="And up"
                    onChange={(e) =>
                      updateTier(i, { to: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={t.priceGBP}
                    onChange={(e) => updateTier(i, { priceGBP: Number(e.target.value) })}
                  />
                  <button
                    className={styles.iconBtn}
                    type="button"
                    onClick={() => removeTier(i)}
                    aria-label="Remove"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.freeOver}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={freeOverOn}
              onChange={(e) => setFreeOverOn(e.target.checked)}
            />
            Offer free shipping when customers purchase a certain amount
          </label>

          {freeOverOn && (
            <div className={styles.freeOverRow}>
              <span>Free over</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={freeOverGBP}
                onChange={(e) => setFreeOverGBP(Number(e.target.value))}
              />
              <span>GBP</span>
            </div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.ghostBtn} type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={styles.primaryBtn} type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save rate'}
          </button>
        </div>

        <div className={styles.footerHint}>
          Tip: Create city-specific zones using <b>outcodes</b> (e.g. B1, M1, SW1A) and give them
          higher priority.
        </div>
      </div>
    </div>
  );
}

/* =========================
   Shipping Admin Client
   ========================= */

export default function ShippingAdminClient() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Create zone form
  const [zoneName, setZoneName] = useState('');
  const [priority, setPriority] = useState(100);
  const [active, setActive] = useState(true);
  const [blockSales, setBlockSales] = useState(false);

  const [country, setCountry] = useState<CountryCode>('GB');
  const [preset, setPreset] = useState<PresetKey>('GB_ALL');

  const [includeAreasRaw, setIncludeAreasRaw] = useState('');
  const [excludeAreasRaw, setExcludeAreasRaw] = useState('');
  const [includeOutcodesRaw, setIncludeOutcodesRaw] = useState('');
  const [excludeOutcodesRaw, setExcludeOutcodesRaw] = useState('');

  const [rateModalZoneId, setRateModalZoneId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/shipping/zones', { cache: 'no-store' });
      const json = (await res.json()) as ApiZones;
      if (!res.ok || !json.ok) throw new Error(errMsg(json, 'Failed to load zones'));
      setZones(json.zones ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sortedZones = useMemo(() => zones.slice().sort((a, b) => b.priority - a.priority), [zones]);

  const includeAreas = useMemo(() => {
    if (country !== 'GB') return [];
    const base = (PRESET_AREAS[preset] ?? []).map(String);
    const manual = parseCsv(includeAreasRaw).map(normalizeAreaPrefix);
    return uniqSorted([...base, ...manual].filter(Boolean));
  }, [country, preset, includeAreasRaw]);

  const excludeAreas = useMemo(() => {
    if (country !== 'GB') return [];
    return parseCsv(excludeAreasRaw).map(normalizeAreaPrefix).filter(Boolean);
  }, [country, excludeAreasRaw]);

  const includeOutcodes = useMemo(() => {
    if (country !== 'GB') return [];
    return parseCsv(includeOutcodesRaw).map(normalizeOutcode).filter(Boolean);
  }, [country, includeOutcodesRaw]);

  const excludeOutcodes = useMemo(() => {
    if (country !== 'GB') return [];
    return parseCsv(excludeOutcodesRaw).map(normalizeOutcode).filter(Boolean);
  }, [country, excludeOutcodesRaw]);

  const previewAreas = useMemo(() => {
    if (country !== 'GB') return [];
    // show only valid UK postcode areas
    return includeAreas.filter((a) => ALL_UK_POSTCODE_AREAS.includes(a as never));
  }, [country, includeAreas]);

  async function createZone() {
    setErr(null);
    const name = zoneName.trim();
    if (!name) {
      setErr('Zone name is required.');
      return;
    }

    try {
      // 1) Create zone
      const res = await fetch('/api/admin/shipping/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          priority: Math.trunc(priority),
          isActive: Boolean(active),
          notes: withBlock(null, blockSales)
        })
      });

      const json = (await res.json()) as ApiCreateZone;
      if (!res.ok || !json.ok) throw new Error(errMsg(json, 'Create zone failed'));

      const zoneId = json.zone.id;

      // 2) Create rules
      const ruleRequests: Array<Promise<Response>> = [];

      if (country === 'IE') {
        ruleRequests.push(
          fetch(`/api/admin/shipping/zones/${zoneId}/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countryCode: 'IE', postcodePrefix: null, postcodeRegex: null })
          })
        );
      } else {
        // INCLUDE Areas
        for (const a of includeAreas) {
          ruleRequests.push(
            fetch(`/api/admin/shipping/zones/${zoneId}/rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ countryCode: 'GB', postcodePrefix: a, postcodeRegex: null })
            })
          );
        }

        // INCLUDE Outcodes
        for (const oc of includeOutcodes) {
          ruleRequests.push(
            fetch(`/api/admin/shipping/zones/${zoneId}/rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ countryCode: 'GB', postcodePrefix: oc, postcodeRegex: null })
            })
          );
        }

        // EXCLUDE (tagged regex)
        for (const a of excludeAreas) {
          ruleRequests.push(
            fetch(`/api/admin/shipping/zones/${zoneId}/rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                countryCode: 'GB',
                postcodePrefix: null,
                postcodeRegex: `${EXCLUDE_TAG}${buildExcludeRegex(a)}`
              })
            })
          );
        }

        for (const oc of excludeOutcodes) {
          ruleRequests.push(
            fetch(`/api/admin/shipping/zones/${zoneId}/rules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                countryCode: 'GB',
                postcodePrefix: null,
                postcodeRegex: `${EXCLUDE_TAG}${buildExcludeRegex(oc)}`
              })
            })
          );
        }
      }

      await Promise.all(ruleRequests);

      // Reset
      setZoneName('');
      setPriority(100);
      setActive(true);
      setBlockSales(false);
      setCountry('GB');
      setPreset('GB_ALL');
      setIncludeAreasRaw('');
      setExcludeAreasRaw('');
      setIncludeOutcodesRaw('');
      setExcludeOutcodesRaw('');

      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    }
  }

  async function patchZone(zoneId: string, patch: Partial<Pick<Zone, 'isActive' | 'notes'>>) {
    setErr(null);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const json = (await res.json()) as ApiOkOrErr;
      if (!res.ok || !json.ok) throw new Error(errMsg(json, 'Update failed'));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function deleteZone(zoneId: string) {
    if (!confirm('Delete this shipping zone?')) return;
    setErr(null);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${zoneId}`, { method: 'DELETE' });
      const json = (await res.json()) as ApiOkOrErr;
      if (!res.ok || !json.ok) throw new Error(errMsg(json, 'Delete failed'));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.h1}>Shipping</h1>
          <p className={styles.sub}>
            Create zones for the whole UK, islands, counties, cities, even specific outcodes — then
            attach shipping rates (free/flat/weight/price/quantity).
          </p>
        </div>
        <button className={styles.ghostBtn} type="button" onClick={load}>
          Refresh
        </button>
      </div>

      {err && <div className={styles.errBox}>{err}</div>}

      <div className={styles.grid}>
        {/* Create zone */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelIcon}>➕</div>
            <div>
              <div className={styles.panelTitle}>Create a shipping zone</div>
              <div className={styles.panelSub}>
                A zone defines <strong>where</strong> you ship. After creating it, add a rate to set{' '}
                <strong>how much</strong> it costs.
              </div>
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.stepGuide}>
              <span>① Name your zone</span>
              <span className={styles.stepArrow}>→</span>
              <span>② Set which postcodes it covers</span>
              <span className={styles.stepArrow}>→</span>
              <span>③ Click Create zone</span>
              <span className={styles.stepArrow}>→</span>
              <span>④ Add a rate to it</span>
            </div>
            <div className={styles.formRow}>
              <label>Zone name</label>
              <input
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="e.g. UK Mainland, London, Birmingham, Manchester…"
              />
              <div className={styles.hint}>
                Tip: For city-specific zones, use outcode prefixes like B1, M1, SW1A for precise
                targeting.
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.formRow}>
                <label>Priority</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                />
                <div className={styles.hint}>
                  When a customer's address matches multiple zones, the highest priority number
                  wins.
                </div>
              </div>

              <div className={styles.formRow}>
                <label>Status</label>
                <div className={styles.toggleRow}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    Active
                  </label>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={blockSales}
                      onChange={(e) => setBlockSales(e.target.checked)}
                    />
                    Block sales in this zone
                  </label>
                </div>
                <div className={styles.hint}>
                  Use this to explicitly block sales to certain areas (e.g. remote islands, outside
                  delivery range).
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.formRow}>
              <label>Country</label>
              <select value={country} onChange={(e) => setCountry(e.target.value as CountryCode)}>
                <option value="GB">United Kingdom (GB)</option>
                <option value="IE">Republic of Ireland (IE)</option>
              </select>
              <div className={styles.hint}>
                Republic of Ireland uses country-level matching only. City-level targeting coming
                soon.
              </div>
            </div>

            {country === 'GB' && (
              <>
                <div className={styles.formRow}>
                  <label>Preset coverage</label>
                  <select value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)}>
                    {Object.keys(PRESET_LABELS).map((k) => (
                      <option key={k} value={k}>
                        {PRESET_LABELS[k as PresetKey]}
                      </option>
                    ))}
                  </select>
                  <div className={styles.hint}>
                    Start with a preset (e.g. all UK), then optionally exclude or include specific
                    areas below.
                  </div>
                </div>

                <div className={styles.areaPicker}>
                  <div className={styles.areaPickerHead}>
                    <div>
                      <div className={styles.areaPickerTitle}>Select postcode areas</div>
                      <div className={styles.areaPickerSub}>
                        Click to include · Right-click or Shift+click to exclude ·{' '}
                        <b>{previewAreas.length}</b> areas included
                      </div>
                    </div>
                    <div className={styles.areaPickerLegend}>
                      <span className={styles.legendIncluded}>■ Included</span>
                      <span className={styles.legendExcluded}>■ Excluded</span>
                      <span className={styles.legendNeutral}>■ Not in zone</span>
                    </div>
                  </div>

                  <div className={styles.areaGrid}>
                    {ALL_UK_POSTCODE_AREAS.map((a) => {
                      const inc = includeAreasRaw
                        ? parseCsv(includeAreasRaw).map(normalizeAreaPrefix).includes(a)
                        : false;
                      const exc = excludeAreasRaw
                        ? parseCsv(excludeAreasRaw).map(normalizeAreaPrefix).includes(a)
                        : false;
                      const inPreset = previewAreas.includes(a);
                      const status = exc
                        ? 'excluded'
                        : inc || (inPreset && !exc)
                          ? 'included'
                          : 'neutral';

                      const toggle = (e: React.MouseEvent) => {
                        e.preventDefault();
                        if (e.shiftKey || e.button === 2) {
                          // Shift+click or right-click = toggle exclude
                          const excList = parseCsv(excludeAreasRaw)
                            .map(normalizeAreaPrefix)
                            .filter(Boolean);
                          if (excList.includes(a)) {
                            setExcludeAreasRaw(excList.filter((x) => x !== a).join(','));
                          } else {
                            setExcludeAreasRaw([...excList, a].join(','));
                          }
                        } else {
                          // Left-click = toggle include
                          const incList = parseCsv(includeAreasRaw)
                            .map(normalizeAreaPrefix)
                            .filter(Boolean);
                          if (incList.includes(a)) {
                            setIncludeAreasRaw(incList.filter((x) => x !== a).join(','));
                          } else {
                            setIncludeAreasRaw([...incList, a].join(','));
                          }
                        }
                      };

                      return (
                        <button
                          key={a}
                          type="button"
                          className={`${styles.areaPill} ${styles[`area_${status}`]}`}
                          title={`${a}${UK_AREA_NAMES[a] ? ` — ${UK_AREA_NAMES[a]}` : ''}\nClick to include · Shift+click to exclude`}
                          onClick={toggle}
                          onContextMenu={toggle}
                        >
                          <span className={styles.areaPillCode}>{a}</span>
                          {UK_AREA_NAMES[a] && (
                            <span className={styles.areaPillName}>{UK_AREA_NAMES[a]}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Keep hidden inputs synced for the underlying state */}
                  <details className={styles.rawInputs}>
                    <summary>Edit as text</summary>
                    <div className={styles.row2} style={{ marginTop: 8 }}>
                      <div className={styles.formRow}>
                        <label>Include areas (raw)</label>
                        <input
                          value={includeAreasRaw}
                          onChange={(e) => setIncludeAreasRaw(e.target.value)}
                          placeholder="B,M,SW"
                        />
                      </div>
                      <div className={styles.formRow}>
                        <label>Exclude areas (raw)</label>
                        <input
                          value={excludeAreasRaw}
                          onChange={(e) => setExcludeAreasRaw(e.target.value)}
                          placeholder="BT,HS,ZE"
                        />
                      </div>
                    </div>
                  </details>
                </div>
              </>
            )}

            <div className={styles.actions}>
              <button className={styles.primaryBtn} type="button" onClick={createZone}>
                Create zone
              </button>
            </div>
          </div>
        </section>

        {/* Existing zones */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelIcon}>🗺️</div>
            <div>
              <div className={styles.panelTitle}>Your shipping zones</div>
              <div className={styles.panelSub}>
                Higher priority zones win when multiple match. Add rates to each zone so customers
                can checkout.
              </div>
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading…</div>
          ) : sortedZones.length === 0 ? (
            <div className={styles.empty}>No zones yet.</div>
          ) : (
            <div className={styles.zoneList}>
              {sortedZones.map((z) => (
                <div key={z.id} className={styles.zoneCard}>
                  <div className={styles.zoneTop}>
                    <div className={styles.zoneTitleRow}>
                      <div className={styles.zoneName}>
                        {z.name}
                        {isBlocked(z.notes) && <span className={styles.badgeDanger}>Blocked</span>}
                        {!z.isActive && <span className={styles.badgeMuted}>Inactive</span>}
                      </div>

                      <div className={styles.zoneMeta}>
                        <span className={styles.badge}>Priority {z.priority}</span>
                        <span className={styles.badge}>Rules {z.rules.length}</span>
                        <span className={styles.badge}>Rates {z.rates.length}</span>
                      </div>
                    </div>

                    <div className={styles.zoneBtns}>
                      <button
                        className={styles.ghostBtnSm}
                        type="button"
                        onClick={() => patchZone(z.id, { isActive: !z.isActive })}
                      >
                        Toggle
                      </button>

                      <button
                        className={styles.ghostBtnSm}
                        type="button"
                        onClick={() =>
                          patchZone(z.id, { notes: withBlock(z.notes, !isBlocked(z.notes)) })
                        }
                      >
                        {isBlocked(z.notes) ? 'Unblock' : 'Block'}
                      </button>

                      <button
                        className={styles.primaryBtnSm}
                        type="button"
                        onClick={() => setRateModalZoneId(z.id)}
                        disabled={isBlocked(z.notes)}
                      >
                        Add rate
                      </button>

                      <button
                        className={styles.dangerBtnSm}
                        type="button"
                        onClick={() => deleteZone(z.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {z.rates.length === 0 && !isBlocked(z.notes) && (
                    <div className={styles.noRatesWarning}>
                      ⚠️ <strong>No rates yet</strong> — customers can&apos;t checkout for this zone
                      until you add a rate.
                    </div>
                  )}

                  {z.rates.length > 0 && (
                    <div className={styles.ratesPreview}>
                      {z.rates.map((r) => {
                        const tempIcon = r.temp === 'FROZEN' ? '❄️' : '📦';
                        const serviceLabel = r.service === 'EXPRESS' ? '⚡ Express' : '🚚 Standard';
                        return (
                          <div key={r.id} className={styles.rateRow}>
                            <div className={styles.rateLeft}>
                              <div className={styles.rateTitle}>
                                {tempIcon} {r.temp === 'FROZEN' ? 'Frozen/chilled' : 'Ambient/dry'}{' '}
                                · {serviceLabel}
                              </div>
                              <div className={styles.rateSub}>
                                {r.freeOverPence == null
                                  ? 'No free threshold'
                                  : `✅ Free over ${money(r.freeOverPence)}`}
                                {' · '}
                                {r.tiers.length} weight tier{r.tiers.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div className={styles.rateRight}>
                              <span className={styles.badge}>{r.currency}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className={styles.rulesPreview}>
                    <div className={styles.rulesTitle}>📍 Covers these postcode areas</div>
                    <div className={styles.rulesList}>
                      {z.rules.slice(0, 12).map((r) => {
                        const prefix = r.postcodePrefix ?? '';
                        const label =
                          r.countryCode === 'GB' && prefix
                            ? (UK_AREA_NAMES[prefix] ?? null)
                            : r.countryCode === 'IE'
                              ? 'Republic of Ireland'
                              : null;
                        const pillText =
                          r.countryCode +
                          (prefix ? `:${prefix}` : '') +
                          (r.postcodeRegex ? ':re' : '');
                        const tooltip = label ? `${prefix || r.countryCode} — ${label}` : pillText;
                        return (
                          <span key={r.id} className={styles.pillTooltip} title={tooltip}>
                            {pillText}
                            {label && <span className={styles.pillLabel}>{label}</span>}
                          </span>
                        );
                      })}
                      {z.rules.length > 12 && (
                        <span className={styles.pillMuted}>+{z.rules.length - 12} more</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.zoneFooterHint}>
                    Matching zone + no valid rates should mean “shipping unavailable” at checkout.
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {rateModalZoneId && (
        <RateEditorModal
          zoneId={rateModalZoneId}
          onClose={() => setRateModalZoneId(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
