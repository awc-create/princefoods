// src/instrument/url-guard.ts
// Dev-only shim that warns if code calls `new URL(<relative>)` with no base.
// Safe: module scope only, no global type augmentation.
// It does nothing in production.

export {};

if (process.env.NODE_ENV !== 'production' && typeof globalThis !== 'undefined') {
  // Type out the URL constructor so we don't use `any`.
  type URLCtor = new (input: string | URL, base?: string | URL) => URL;

  // Keep a reference to the real constructor.
  const RealURL = globalThis.URL as unknown as URLCtor;

  // Only override if URL exists and we haven't wrapped it already.
  if (typeof RealURL === 'function') {
    const WrappedURL: URLCtor = function URL(input: string | URL, base?: string | URL): URL {
      // Warn when input is a relative string and no base was provided.
      if (
        typeof input === 'string' &&
        // not an absolute scheme (e.g., http:, https:, data:, etc.)
        !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) &&
        base === undefined
      ) {
        console.warn('[url-guard] `new URL(<relative>)` without a base detected:', input);
      }

      return new RealURL(input, base);
    } as unknown as URLCtor;

    // Preserve prototype so instanceof checks keep working.
    (WrappedURL as unknown as { prototype: URL }).prototype = (
      RealURL as unknown as {
        prototype: URL;
      }
    ).prototype;

    // Install the wrapper.
    (globalThis as unknown as { URL: URLCtor }).URL = WrappedURL;
  }
}
