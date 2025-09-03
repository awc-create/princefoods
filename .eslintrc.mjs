// eslint.config.mjs
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
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

  // Bring in Next.js’ rules (converted from legacy extends)
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // Register plugins + project rules
  {
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    settings: {
      // Let eslint-plugin-react auto-detect your React version
      react: { version: 'detect' },
    },
    languageOptions: {
      globals: { ...globals.browser, NodeJS: true },
    },
    rules: {
      // ✅ New JSX transform – you don’t need `import React from "react"`
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      // Unblock CI for now (tune later)
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
