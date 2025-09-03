// eslint.config.mjs
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default defineConfig([
  // Ignore build artifacts
  {
    ignores: ['**/node_modules/**', '.next/**', 'out/**', 'dist/**', 'coverage/**'],
  },

  // Next.js base configs (converted from legacy extends)
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // Plugins + project rules
  {
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    settings: {
      react: { version: 'detect' }, // auto-detect React v19
    },
    languageOptions: {
      globals: { ...globals.browser, NodeJS: true },
    },
    rules: {
      // New JSX transform — no need to import React everywhere
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      // Disable this rule entirely (API anchors are valid for you)
      '@next/next/no-html-link-for-pages': 'off',

      // Keep CI green for now
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
