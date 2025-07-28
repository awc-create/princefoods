'use client';

import { useEffect, useState } from 'react';
import styles from './CategorySelector.module.scss';

export type CategoryMap = Record<string, string[]>;

interface Props {
  categories: CategoryMap;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function CategorySelector({ categories, selected, onChange }: Props) {
  const [newParent, setNewParent] = useState('');
  const [newChild, setNewChild] = useState('');
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCategoryMap(categories);
  }, [categories]);

  const toggleExpanded = (parent: string) => {
    setExpanded(prev => ({ ...prev, [parent]: !prev[parent] }));
  };

  const toggleCategory = (fullPath: string) => {
    if (selected.includes(fullPath)) {
      onChange(selected.filter((s) => s !== fullPath));
    } else {
      onChange([...selected, fullPath]);
    }
  };

  const createCategory = () => {
    if (!newParent.trim()) return;

    setCategoryMap(prev => {
      const updated = { ...prev };
      if (!updated[newParent]) updated[newParent] = [];
      if (newChild.trim() && !updated[newParent].includes(newChild)) {
        updated[newParent].push(newChild);
      }
      return updated;
    });

    setNewParent('');
    setNewChild('');
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.heading}>🍱 Categories</h2>

      <div className={styles.tree}>
        {Object.entries(categoryMap).map(([parent, children]) => {
          const isExpanded = expanded[parent] || selected.some(s => s.startsWith(parent));
          return (
            <div key={parent} className={styles.parentBlock}>
              <label className={styles.parent}>
                <input
                  type="checkbox"
                  checked={selected.includes(parent)}
                  onChange={() => {
                    toggleCategory(parent);
                    toggleExpanded(parent);
                  }}
                />
                {isExpanded ? '📂' : '📁'} {parent}
              </label>

              {isExpanded && children.length > 0 && (
                <div className={styles.childGroup}>
                  {children.map(child => {
                    const full = `${parent} ; ${child}`;
                    return (
                      <label key={full} className={`${styles.child} ${selected.includes(full) ? styles.selected : ''}`}>
                        <input
                          type="checkbox"
                          checked={selected.includes(full)}
                          onChange={() => toggleCategory(full)}
                        />
                        🧊 {child}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.create}>
        <p><strong>➕ Create Category</strong></p>
        <input
          type="text"
          value={newParent}
          onChange={(e) => setNewParent(e.target.value)}
          placeholder="Parent category (e.g. Frozen)"
        />
        <input
          type="text"
          value={newChild}
          onChange={(e) => setNewChild(e.target.value)}
          placeholder="Child category (e.g. Frozen Porotta)"
        />
        <button onClick={createCategory}>Add</button>
      </div>
    </div>
  );
}
