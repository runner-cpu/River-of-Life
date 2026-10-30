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
