// src/instrument/url-guard.ts
// Make this file a module so global augmentation is allowed.
export {};

type URLInput = ConstructorParameters<typeof URL>[0];
type URLBase = ConstructorParameters<typeof URL>[1];

// Only activates when BUILD_URL_GUARD=1 (safe otherwise)
if (process.env.BUILD_URL_GUARD === '1') {
  const RealURL = URL;

  function GuardedURL(input: URLInput, base?: URLBase) {
    // Detect relative-like strings when no base is provided
    const s = String(input ?? '');
    const looksRelative =
      !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) &&
      !s.startsWith('//') &&
      !s.startsWith('data:') &&
      !s.startsWith('blob:');

    if (base == null && looksRelative) {
      const err = new Error(`[URL guard] Relative URL without base: ${JSON.stringify(s)}`);
      // Keep the stack short & helpful
      const stack = (err.stack ?? '').split('\n').slice(0, 8).join('\n');

      console.error(stack);
    }

    try {
      // Call the real constructor

      // @ts-ignore - construct like native
      return new RealURL(input, base);
    } catch (e) {
      console.error('[URL guard] new URL threw:', { input: s, base }, e);
      throw e;
    }
  }

  // Preserve prototype

  // @ts-ignore
  GuardedURL.prototype = RealURL.prototype;

  // Swap globally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).URL = GuardedURL;
}
