'use client';

// src/components/admin/site/home/instagram/InstagramForm.tsx
import type { InstagramSettings } from '@/types/homeSettings';
import Field from '../_shared/Field';
import s from './InstagramForm.module.scss';

export default function InstagramForm({
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
          placeholder="https://instagram.com/yourhandle"
        />
      </Field>

      <Field label="Access Token">
        <input
          className={s.input}
          value={value.token}
          onChange={(e) => onChange({ ...value, token: e.target.value })}
          placeholder="Long-lived Basic Display token"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <div className={s.hint}>
        <div className={s.hintTitle}>Tip</div>
        <div className={s.hintText}>
          Keep this token private. If Instagram feed fails, regenerate a long-lived token and paste
          it here.
        </div>
      </div>
    </div>
  );
}
