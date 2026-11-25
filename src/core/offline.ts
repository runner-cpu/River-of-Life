function deadline<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), milliseconds);
    operation.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

const maxDownloadTime = 10 * 60_000;

export async function prepareOffline(container: ServiceWorkerContainer, registration: Promise<ServiceWorkerRegistration | undefined>, readinessTimeout = 12000, cacheTimeout = 90_000, onProgress?: (progress: { completed: number; total: number }) => void, absoluteTimeout = maxDownloadTime) {
  let cleanupInstall = () => {}, finished = false;
  try {
    const active = await deadline((async () => {
      const registered = await registration;
      if (finished) throw new Error('离线服务准备已超时。');
      if (!registered) throw new Error('离线服务注册失败，请联网后重试。');
      if (registered.active) return registered.active;
      const worker = registered.installing || registered.waiting;
      const failed = new Promise<never>((_, reject) => {
        if (!worker) return;
        const changed = () => { if (worker.state === 'redundant') reject(new Error('离线服务安装失败，请联网后重试。')); };
        worker.addEventListener('statechange', changed); cleanupInstall = () => worker.removeEventListener('statechange', changed); changed();
      });
      const ready = await Promise.race([container.ready, failed]);
      if (!ready.active) throw new Error('离线服务尚未就绪，请稍后重试。');
      return ready.active;
    })(), readinessTimeout, '离线服务准备超时，请检查网络后重试。');
    const channel = new MessageChannel();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let absoluteTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const resetIdleTimer = () => {
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => reject(new Error('离线缓存等待超时，请联网后重试。')), cacheTimeout);
        };
        resetIdleTimer();
        absoluteTimer = setTimeout(() => reject(new Error('已到离线下载总时限，请联网后重试。')), Math.min(absoluteTimeout, maxDownloadTime));
        let lastCompleted = -1, expectedTotal: number | undefined;
        channel.port1.onmessage = event => {
          const data = event.data;
          if (typeof data?.ok === 'boolean') return resolve(data.ok);
          if (data?.type !== 'progress') return;
          const {completed, total} = data;
          if (!Number.isSafeInteger(total) || total <= 0 || (expectedTotal !== undefined && total !== expectedTotal) ||
              !Number.isSafeInteger(completed) || completed < 0 || completed > total || completed <= lastCompleted) return;
          expectedTotal = total;
          lastCompleted = completed;
          if (completed > 0) resetIdleTimer();
          onProgress?.({completed, total});
        };
        channel.port1.onmessageerror = () => reject(new Error('离线缓存回复无效，请重试。'));
        active.postMessage({ type: 'CACHE_ALL', progress: true }, [channel.port2]);
      });
    } finally {
      clearTimeout(idleTimer); clearTimeout(absoluteTimer);
      channel.port1.onmessage = null; channel.port1.onmessageerror = null;
      channel.port1.close(); channel.port2.close();
    }
  } finally { finished = true; cleanupInstall(); }
}
