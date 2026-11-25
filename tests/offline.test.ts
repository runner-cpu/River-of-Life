import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareOffline } from '../src/core/offline';

describe('offline preparation failure recovery', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('rejects bounded readiness when installation never activates', async () => {
    const operation = prepareOffline({ ready: new Promise(() => {}) } as unknown as ServiceWorkerContainer, Promise.resolve({} as ServiceWorkerRegistration), 50);
    const checked = expect(operation).rejects.toThrow('准备超时');
    await vi.advanceTimersByTimeAsync(51); await checked;
  });

  it('reports a failed registration immediately', async () => {
    await expect(prepareOffline({} as ServiceWorkerContainer, Promise.resolve(undefined))).rejects.toThrow('注册失败');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports a redundant installer without waiting for the readiness deadline', async () => {
    const worker = new EventTarget() as ServiceWorker & { state: string }; Object.defineProperty(worker, 'state', { value: 'installing', writable: true });
    const operation = prepareOffline({ ready: new Promise(() => {}) } as unknown as ServiceWorkerContainer, Promise.resolve({ installing: worker } as unknown as ServiceWorkerRegistration), 1000);
    const checked = expect(operation).rejects.toThrow('安装失败');
    await Promise.resolve(); (worker as { state: string }).state = 'redundant'; worker.dispatchEvent(new Event('statechange'));
    await checked; expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a silent cache reply and closes both ports', async () => {
    const first = { onmessage: null, onmessageerror: null, close: vi.fn() }, second = { close: vi.fn() };
    vi.stubGlobal('MessageChannel', class { port1 = first; port2 = second; });
    const active = { postMessage: vi.fn() };
    const operation = prepareOffline({} as ServiceWorkerContainer, Promise.resolve({ active } as unknown as ServiceWorkerRegistration), 50, 80);
    const checked = expect(operation).rejects.toThrow('缓存等待超时');
    await vi.advanceTimersByTimeAsync(81); await checked;
    expect(active.postMessage).toHaveBeenCalledWith({ type: 'CACHE_ALL', progress: true }, [second]); expect(first.close).toHaveBeenCalledOnce(); expect(second.close).toHaveBeenCalledOnce();
  });

  it('reports bounded progress but resolves only after the final cache result', async () => {
    const first = {onmessage: undefined as undefined | ((event: {data:unknown}) => void), close:vi.fn()}, second = {close:vi.fn()};
    vi.stubGlobal('MessageChannel', class {port1=first;port2=second;});
    const progress=vi.fn(),done=vi.fn(),active={postMessage:vi.fn()};
    const operation=prepareOffline({} as ServiceWorkerContainer,Promise.resolve({active} as unknown as ServiceWorkerRegistration),50,80,progress).then(done);
    await vi.advanceTimersByTimeAsync(0);
    first.onmessage!({data:{type:'progress',completed:1,total:3}});
    first.onmessage!({data:{type:'progress',completed:5,total:3}});
    await Promise.resolve();expect(done).not.toHaveBeenCalled();expect(progress).toHaveBeenCalledExactlyOnceWith({completed:1,total:3});
    first.onmessage!({data:{ok:true}});await operation;expect(done).toHaveBeenCalledWith(true);expect(first.close).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  });
});

describe('download deadlines', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  async function start(idle = 45_000, absolute?: number) {
    const port = {onmessage: null as ((event: {data: unknown}) => void) | null, onmessageerror: null, close: vi.fn()};
    const other = {close: vi.fn()};
    vi.stubGlobal('MessageChannel', class {port1 = port; port2 = other;});
    const progress = vi.fn();
    const done = prepareOffline({} as ServiceWorkerContainer, Promise.resolve({active:{postMessage: vi.fn()}} as unknown as ServiceWorkerRegistration), 50, idle, progress, absolute).catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(0);
    return {done, port, other, progress, send: (completed: number, total = 5) => port.onmessage!({data:{type:'progress', completed, total}})};
  }
  it('allows ongoing progress beyond 45 seconds and releases message handlers', async () => {
    const h = await start(); await vi.advanceTimersByTimeAsync(40_000); h.send(1);
    await vi.advanceTimersByTimeAsync(30_000); h.send(2); h.port.onmessage!({data:{ok:true}});
    expect(await h.done).toBe(true); expect(h.port.onmessage).toBeNull(); expect(h.port.onmessageerror).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });
  it('does not extend the deadline for repeated, decreasing or inconsistent progress', async () => {
    const h = await start(100); h.send(2); await vi.advanceTimersByTimeAsync(95);
    h.send(2); h.send(1); h.send(3, 20); await vi.advanceTimersByTimeAsync(6);
    expect(await h.done).toContain('缓存等待超时'); expect(h.progress).toHaveBeenCalledTimes(1); expect(h.other.close).toHaveBeenCalledOnce();
  });
  it('enforces a ten-minute maximum even when progress keeps advancing', async () => {
    const h = await start(240_000); for (let i = 1; i < 4; i++) {await vi.advanceTimersByTimeAsync(180_000); h.send(i);}
    await vi.advanceTimersByTimeAsync(60_001);
    expect(await h.done).toContain('总时限'); expect(vi.getTimerCount()).toBe(0);
  });
});
