/** Render only visible scenes, and park static scenes until an interaction invalidates them. */
export class RenderLoop {
  private frame = 0;
  private visible = true;
  private disposed = false;
  private observer: IntersectionObserver;

  constructor(element: HTMLElement, private render: (time: number) => boolean) {
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      this.refresh();
    });
    this.observer.observe(element);
    document.addEventListener('visibilitychange', this.refresh);
    this.request();
  }

  request = () => {
    if (!this.disposed && this.visible && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.tick);
  };

  private refresh = () => {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.request();
  };

  private tick = (time: number) => {
    this.frame = 0;
    if (this.disposed || !this.visible || document.hidden) return;
    if (this.render(time)) this.request();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.refresh);
  }
}
