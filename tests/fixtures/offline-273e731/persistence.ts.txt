const STARTUP_TIMEOUT = 4000;

/** A blocked or stalled database must not prevent the local backup from opening. */
export function openProgressDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('life-museum', 1);
    let settled = false;
    const fail = () => { if(settled)return;settled=true;clearTimeout(timer);reject(new Error('Database unavailable')); };
    const timer = setTimeout(fail, STARTUP_TIMEOUT);
    request.onblocked = request.onerror = fail;
    request.onupgradeneeded = () => {
      if(settled) { request.transaction?.abort();return; }
      if(!request.result.objectStoreNames.contains('progress')) request.result.createObjectStore('progress');
    };
    request.onsuccess = () => {
      if(settled) {request.result.close();return;}
      settled=true;clearTimeout(timer);
      request.result.onversionchange=()=>request.result.close();
      resolve(request.result);
    };
  });
}

export function readCurrentProgress(database: IDBDatabase): Promise<unknown> {
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction('progress');
    const request=transaction.objectStore('progress').get('current');
    let settled=false;
    const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);reject(new Error('Database read unavailable'));};
    const timer=setTimeout(fail,STARTUP_TIMEOUT);
    request.onerror=transaction.onabort=fail;
    request.onsuccess=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(request.result);};
  });
}
