export const PROGRESS_WRITER_LOCK = 'life-museum-progress-writer';

/** A lock is held until release; a busy origin never queues another writer. */
export function createProgressAccess(locks: Pick<LockManager, 'request'> | undefined = typeof navigator === 'undefined' ? undefined : navigator.locks) {
  let writable = false;
  let reason = '正在确认探索记录的保存权限。';
  let generation = 0;
  let releaseLock: (() => void) | undefined;
  let acquiring: Promise<void> | undefined;
  return {
    get writable() { return writable; },
    get reason() { return reason; },
    acquire(): Promise<void> {
      if (writable) return Promise.resolve();
      if (acquiring) return acquiring;
      if (!locks) {
        reason = '当前浏览器不支持 Web Locks，无法协调多个窗口的保存。当前仅供只读浏览，可导出记录备份。';
        return Promise.resolve();
      }
      const requestGeneration = ++generation;
      acquiring = new Promise<void>(resolve => {
        const fail = () => {
          if (generation === requestGeneration) { writable = false; reason = '无法取得探索记录的保存权限。当前仅供只读浏览，可导出记录备份。'; }
          resolve();
        };
        try {
          void locks.request(PROGRESS_WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, lock => {
            if (generation !== requestGeneration) { resolve(); return; }
            if (!lock) {
              reason = '另一个窗口正在保存探索记录。当前是只读快照；请关闭该窗口后重新加载，可随时导出此快照。';
              resolve(); return;
            }
            writable = true; reason = '';
            const held = new Promise<void>(release => { releaseLock = release; });
            resolve();
            return held;
          }).catch(fail);
        } catch { fail(); }
      }).finally(() => { acquiring = undefined; });
      return acquiring;
    },
    release() {
      // Revoke permission synchronously, before allowing a new owner to enter.
      writable = false; reason = '页面已离开，重新加载后才能继续保存探索记录。';
      generation++; releaseLock?.(); releaseLock = undefined;
    },
  };
}
