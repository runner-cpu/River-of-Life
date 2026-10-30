function deadline<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), milliseconds);
    operation.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

export async function prepareOffline(container: ServiceWorkerContainer, registration: Promise<ServiceWorkerRegistration | undefined>, readinessTimeout = 12000, cacheTimeout = 45000, onProgress?: (progress: { completed: number; total: number }) => void) {
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
    try {
      return await deadline(new Promise<boolean>((resolve, reject) => {
        channel.port1.onmessage = event => {
          const data=event.data;
          if (data?.type === 'progress') {
            if (Number.isInteger(data.completed) && Number.isInteger(data.total) && data.total>0 && data.completed>=0 && data.completed<=data.total) onProgress?.({completed:data.completed,total:data.total});
          } else if (typeof data?.ok === 'boolean') resolve(data.ok);
        };
        channel.port1.onmessageerror = () => reject(new Error('离线缓存回复无效，请重试。'));
        active.postMessage({ type: 'CACHE_ALL', progress: true }, [channel.port2]);
      }), cacheTimeout, '离线缓存等待超时，请联网后重试。');
    } finally { channel.port1.close(); channel.port2.close(); }
  } finally { finished = true; cleanupInstall(); }
}
