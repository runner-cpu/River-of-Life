import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgressAccess, PROGRESS_WRITER_LOCK } from '../src/core/progress-access';
afterEach(() => vi.unstubAllGlobals());

function lockManager() {
  let held = false;
  const request = vi.fn(async (_name: string, options: LockOptions, callback: (lock: Lock | null) => unknown) => {
    expect(options).toEqual({ mode: 'exclusive', ifAvailable: true });
    if (held) return callback(null);
    held = true;
    try { return await callback({ name: PROGRESS_WRITER_LOCK, mode: 'exclusive' }); }
    finally { held = false; }
  });
  return { request } as unknown as Pick<LockManager, 'request'>;
}

describe('progress writing ownership', () => {
  it('settles promptly when busy and allows retry after release', async () => {
    const locks = lockManager(), first = createProgressAccess(locks), second = createProgressAccess(locks);
    await first.acquire(); await second.acquire();
    expect(first.writable).toBe(true); expect(second.writable).toBe(false); expect(second.reason).toContain('只读快照');
    first.release(); expect(first.writable).toBe(false);
    await Promise.resolve(); await second.acquire(); expect(second.writable).toBe(true); second.release();
  });
  it('does not release the current lock when acquire is repeated', async () => {
    const locks = lockManager(), access = createProgressAccess(locks);
    await access.acquire(); await access.acquire(); expect(locks.request).toHaveBeenCalledTimes(1); access.release();
  });
  it('stays read-only when Web Locks is unsupported', async () => {
    vi.stubGlobal('navigator', {});
    const access = createProgressAccess(); await access.acquire();
    expect(access.writable).toBe(false); expect(access.reason).toContain('不支持 Web Locks');
  });
  it.each([() => { throw new Error('security'); }, () => Promise.reject(new Error('security'))])('handles failed lock requests', async request => {
    const access = createProgressAccess({ request } as Pick<LockManager, 'request'>);
    await access.acquire(); expect(access.writable).toBe(false); expect(access.reason).toContain('无法取得');
  });
  it('revokes an in-flight acquisition before its callback can grant permission', async () => {
    let callback!: (lock: Lock | null) => unknown;
    const request = vi.fn((_name, _options, run) => { callback = run; return Promise.resolve(); });
    const access = createProgressAccess({ request } as unknown as Pick<LockManager, 'request'>), pending = access.acquire();
    access.release(); callback({ name: PROGRESS_WRITER_LOCK, mode: 'exclusive' }); await pending;
    expect(access.writable).toBe(false);
  });
});
