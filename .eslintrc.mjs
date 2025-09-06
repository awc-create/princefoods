// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc';
import nextPlugin from '@next/eslint-plugin-next';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default defineConfig([
  { ignores: ['**/node_modules/**', '.next/**', 'out/**', 'dist/**', 'coverage/**'] },

  // Next.js rules (from legacy "extends")
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    plugins: { react, 'react-hooks': reactHooks, '@next/next': nextPlugin },
    settings: { react: { version: 'detect' } },
    languageOptions: { globals: { ...globals.browser, NodeJS: true } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'react-hooks/exhaustive-deps': 'warn',

      // 🚫 Block raw `new URL(...)` usage (use urlFrom()/absUrl() instead)
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='URL']",
          message: 'Use urlFrom(absUrl(...)) or absUrl() helpers instead of raw `new URL(...)`.'
        }
      ]
    },

    // Allow in these helper files only
    overrides: [
      {
        files: ['src/lib/abs-url.ts', 'src/lib/url.ts', 'src/utils/safeImageUrl.ts'],
        rules: { 'no-restricted-syntax': 'off' }
      }
    ]
  }
]);
