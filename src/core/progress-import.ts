type ImportFile = Pick<File, 'size' | 'text'>;
type ImportOptions = {
  active: () => boolean;
  canWrite: () => boolean;
  commit: (raw: string) => void;
  status: (message: string) => void;
  imported: () => void;
};

/** Each selection invalidates earlier reads, including empty or rejected selections. */
export function createProgressImport(options: ImportOptions) {
  let generation = 0;
  let disposed = false;
  const current = (request: number) => !disposed && generation === request && options.active();
  return {
    cancel() { generation++; },
    dispose() { disposed = true; generation++; },
    async select(file: ImportFile | undefined) {
      const request = ++generation;
      if (!current(request)) return;
      if (!file) { options.status('未选择记录文件。'); return; }
      if (!options.canWrite()) { options.status('当前为只读快照，无法导入。请重新加载以重试保存权限。'); return; }
      if (file.size > 400000) { options.status('记录文件过大，请选择导出的 JSON 记录。'); return; }
      options.status('正在读取探索记录…');
      try {
        const raw = await file.text();
        if (!current(request)) return;
        if (!options.canWrite()) { options.status('保存权限已失效，记录未导入。请重新加载后重试。'); return; }
        if (raw.length > 250000) throw new Error('记录文件过大。');
        options.commit(raw);
        options.status('探索记录已导入。');
        options.imported();
      } catch (error) {
        if (current(request)) options.status(error instanceof Error ? error.message : '记录文件无法读取，请重试。');
      }
    },
  };
}
