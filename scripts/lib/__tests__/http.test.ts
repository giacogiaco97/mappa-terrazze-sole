import { describe, expect, test, vi } from 'vitest';
import { fetchWithRetry } from '../http.js';

describe('fetchWithRetry', () => {
  test('successo al primo tentativo', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('https://example.com');
    expect(await res.text()).toBe('ok');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('riprova al 503 e poi riesce', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('https://example.com', { retries: 2, delayMs: 1 });
    expect(await res.text()).toBe('ok');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('lancia dopo aver esaurito i retry', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('busy', { status: 503 }));
    await expect(
      fetchWithRetry('https://example.com', { retries: 1, delayMs: 1 })
    ).rejects.toThrow(/HTTP 503/);
  });

  test('non riprova su 404', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('nope', { status: 404 }));
    await expect(
      fetchWithRetry('https://example.com', { retries: 3, delayMs: 1 })
    ).rejects.toThrow(/HTTP 404/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
