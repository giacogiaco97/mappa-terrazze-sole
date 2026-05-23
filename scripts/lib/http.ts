export type FetchOptions = {
  retries?: number;
  delayMs?: number;
  init?: RequestInit;
};

export async function fetchWithRetry(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.delayMs ?? 1000;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, opts.init);
      if (res.ok) return res;

      const retriable = res.status >= 500 || res.status === 429;
      if (!retriable) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (err) {
      if (!isRetriable(err)) throw err;
      lastErr = err;
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }
  throw lastErr ?? new Error('fetchWithRetry: tentativi esauriti');
}

function isRetriable(err: unknown): boolean {
  if (err instanceof Error && /HTTP (5|429)/.test(err.message)) return true;
  return err instanceof TypeError; // network errors
}
