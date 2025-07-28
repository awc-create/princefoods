'use client';

import { useState } from 'react';
import styles from './AdditionalInfoModal.module.scss';

interface Props {
  onClose: () => void;
  onSave: (info: Record<string, string | string[]>) => void;
}

export default function AdditionalInfoModal({ onClose, onSave }: Props) {
  const [allergens, setAllergens] = useState('');
  const [storage, setStorage] = useState('');
  const [cooking, setCooking] = useState('');
  const [nutrition, setNutrition] = useState('');
  const [shelfLife, setShelfLife] = useState('');
  const [certs, setCerts] = useState<string[]>([]);
  const origin = 'India, Kerala';

  const toggleCert = (label: string) => {
    setCerts(prev =>
      prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]
    );
  };

  const handleSave = () => {
    const info: Record<string, string | string[]> = {};

    if (allergens) info['Allergens'] = allergens;
    if (storage) info['Storage Instructions'] = storage;
    if (cooking) info['Cooking Instructions'] = cooking;
    if (nutrition) info['Nutritional Info'] = nutrition;
    if (shelfLife) info['Shelf Life'] = shelfLife;
    if (certs.length) info['Certifications'] = certs;

    info['Country of Origin'] = origin;

    onSave(info);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Add Additional Info</h2>

        <div className={styles.fieldGroup}>
          <label>
            Allergens (comma separated)
            <input
              type="text"
              placeholder="e.g. mustard, nuts, gluten"
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.fieldGroup}>
          <label>
            Storage Instructions
            <textarea
              placeholder="e.g. Store frozen at -18ºC"
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.fieldGroup}>
          <label>
            Cooking Instructions
            <textarea
              placeholder="e.g. Heat on tawa for 3 min"
              value={cooking}
              onChange={(e) => setCooking(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.fieldGroup}>
          <label>
            Nutritional Info
            <textarea
              placeholder="e.g. Per 100g: 250 kcal, 12g fat"
              value={nutrition}
              onChange={(e) => setNutrition(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.fieldGroup}>
          <label>
            Shelf Life / Expiry
            <input
              type="text"
              placeholder="e.g. Best before 6 months from MFG"
              value={shelfLife}
              onChange={(e) => setShelfLife(e.target.value)}
            />
          </label>
        </div>

        <fieldset>
          <legend>Certifications</legend>
          {['Halal', 'Vegan', 'Vegetarian', 'Organic'].map((label) => (
            <label key={label} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={certs.includes(label)}
                onChange={() => toggleCert(label)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <p>
          <strong>Country of Origin:</strong> India, Kerala
        </p>

        <div className={styles.actions}>
          <button type="button" onClick={handleSave}>
            OK
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
