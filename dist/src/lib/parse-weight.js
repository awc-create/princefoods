"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWeightToGrams = parseWeightToGrams;
// canonical unit→grams (treat ml≈g for shipping weight)
const UNIT_FACTOR = {
    g: 1,
    kg: 1000,
    ml: 1,
    l: 1000,
    lt: 1000,
    litre: 1000,
    liter: 1000,
    ltr: 1000,
    ltrs: 1000
};
const DISQUALIFIERS = [
    'teabag',
    'teabags',
    'bag',
    'bags',
    'pod',
    'pods',
    'capsule',
    'capsules',
    'sachet',
    'sachets',
    'stick',
    'sticks'
];
// Parses common forms: "200g", "1 kg", "2 x 500g", "500g x 2", "1L", "500 ml"
function parseWeightToGrams(name) {
    const s = String(name ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    if (!s)
        return null;
    // 1) "2 x 500g" / "3×1kg"
    let m = s.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(\s*)(kg|g|ml|l|lt|liter|litre|ltrs|ltr)\b/);
    if (m) {
        const count = parseFloat(m[1]);
        const qty = parseFloat(m[2]);
        const unit = m[4];
        const grams = Math.round(count * qty * UNIT_FACTOR[unit]);
        return { grams, matched: m[0] };
    }
    // 2) "500g x 2"
    m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|lt|liter|litre|ltrs|ltr)\s*[x×]\s*(\d+(?:\.\d+)?)\b/);
    if (m) {
        const qty = parseFloat(m[1]);
        const unit = m[2];
        const count = parseFloat(m[3]);
        const grams = Math.round(count * qty * UNIT_FACTOR[unit]);
        return { grams, matched: m[0] };
    }
    // 3) Plain "200g", "1kg", "500 ml", "1 L"
    m = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|lt|liter|litre|ltrs|ltr)\b/);
    if (m) {
        const qty = parseFloat(m[1]);
        const unit = m[2];
        const grams = Math.round(qty * UNIT_FACTOR[unit]);
        return { grams, matched: m[0] };
    }
    // 4) Ignore pure counts like "100 teabags" (no unit)
    m = s.match(/\b(\d{2,5})\b/);
    if (m) {
        const after = s.slice(m.index + m[0].length, m.index + m[0].length + 15);
        if (DISQUALIFIERS.some((w) => after.includes(w)))
            return null;
    }
    return null;
}
