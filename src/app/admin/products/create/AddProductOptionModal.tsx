'use client';

import { useState } from 'react';
import styles from './AddProductOptionModal.module.scss';

interface Props {
  onClose: () => void;
  onSave: (option: {
    name: string;
    type: 'List' | 'Color';
    values: string[];
  }) => void;
}

export default function AddProductOptionModal({ onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'List' | 'Color'>('List');
  const [choices, setChoices] = useState('');

  const handleSave = () => {
    const values = choices
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    if (!name || values.length === 0) return;

    onSave({ name, type, values });
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Add product option</h2>

        <label>
          Option name
          <input
            type="text"
            placeholder="e.g. Weight or Flavour"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label>
          Display style
          <div className={styles.radioGroup}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="type"
                checked={type === 'List'}
                onChange={() => setType('List')}
              />
              List
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="type"
                checked={type === 'Color'}
                onChange={() => setType('Color')}
              />
              Color
            </label>
          </div>
        </label>

        <label>
          Option choices (comma-separated)
          <input
            type="text"
            placeholder="e.g. 400g, 1kg, 5kg"
            value={choices}
            onChange={(e) => setChoices(e.target.value)}
          />
        </label>

        <div className={styles.actions}>
          <button onClick={handleSave}>Add</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

