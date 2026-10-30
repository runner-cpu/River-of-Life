import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EpochCinematic } from '../src/scene/epoch-cinematic';

const harness = vi.hoisted(() => ({ renderers: [] as any[], observers: [] as any[], fail: false }));
vi.mock('three', async importOriginal => {
  const original = await importOriginal<typeof import('three')>();
  return { ...original, WebGLRenderer: class {
    domElement = Object.assign(new EventTarget(), { setAttribute: vi.fn(), remove: vi.fn() });
    info = { render: { triangles: 0, calls: 0 } }; pixelRatio = 0; scene?: THREE.Scene; camera?: THREE.Camera;
    dispose = vi.fn(); forceContextLoss = vi.fn(); setSize = vi.fn();
    setPixelRatio(value: number) { this.pixelRatio = value; }
    render(scene: THREE.Scene, camera: THREE.Camera) {
      this.scene = scene; this.camera = camera; this.info.render = { triangles: 0, calls: 0 };
      scene.traverse(object => {
        if (object instanceof original.Mesh) { this.info.render.triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3 * (object instanceof original.InstancedMesh ? object.count : 1); this.info.render.calls++; }
        if (object instanceof original.Points) this.info.render.calls++;
      });
    }
    constructor() { if (harness.fail) throw new Error('WebGL unavailable'); harness.renderers.push(this); }
  } };
});
const container = () => ({ append: vi.fn(), replaceChildren: vi.fn(), querySelector: vi.fn(() => null), getBoundingClientRect: () => ({ width: 600, height: 500 }) }) as unknown as HTMLElement;
beforeEach(() => {
  harness.renderers.length = 0; harness.observers.length = 0; harness.fail = false;
  vi.stubGlobal('window', { devicePixelRatio: 3, innerWidth: 390 });
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); constructor() { harness.observers.push(this); } });
  vi.stubGlobal('document', { createElement: () => ({ className: '', textContent: '' }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('on-demand epoch graphics ownership', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('builds chapter %s within the geometry budget and frees each resource exactly once', chapter => {
    const element = container(), cinematic = new EpochCinematic(element, chapter, { reducedMotion: false });
    const renderer = harness.renderers[0], resources = new Set<THREE.BufferGeometry | THREE.Material>();
    renderer.scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) { resources.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material); }
    });
    expect(cinematic.stats.webgl).toBe(true); expect(cinematic.stats.triangles).toBeGreaterThan(100);
    expect(cinematic.stats.triangles).toBeLessThan(30000); expect(cinematic.stats.drawCalls).toBeLessThan(80); expect(cinematic.stats.pixelRatio).toBe(1.3);
    const spies = [...resources].map(resource => vi.spyOn(resource, 'dispose'));
    cinematic.render(7); cinematic.dispose(); cinematic.dispose();
    spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    expect(renderer.dispose).toHaveBeenCalledTimes(1); expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1); expect(harness.observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(element.replaceChildren).toHaveBeenCalledTimes(1); expect(cinematic.stats.webgl).toBe(false);
  });
  it('holds a static camera, particles and objects at the same keyframe in reduced motion', () => {
    const cinematic = new EpochCinematic(container(), 6, { reducedMotion: true }), renderer = harness.renderers[0];
    cinematic.render(1); const camera = renderer.camera.position.clone();
    const particles = renderer.scene.children.find((child: THREE.Object3D) => child instanceof THREE.Points) as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    expect(particles.material.uniforms.time.value).toBe(5);
    cinematic.render(9); expect(renderer.camera.position.toArray()).toEqual(camera.toArray()); expect(particles.material.uniforms.time.value).toBe(5);
    cinematic.setReducedMotion(false); expect(renderer.camera.position.distanceTo(camera)).toBeGreaterThan(1); expect(particles.material.uniforms.time.value).toBe(9);
    cinematic.dispose();
  });
  it('caps desktop and low-quality pixels separately', () => {
    vi.stubGlobal('window', { devicePixelRatio: 3, innerWidth: 1440 });
    const desktop = new EpochCinematic(container(), 1, { reducedMotion: true }); expect(desktop.stats.pixelRatio).toBe(1.7); desktop.dispose();
    const low = new EpochCinematic(container(), 1, { reducedMotion: true, quality: 'low' }); expect(low.stats.pixelRatio).toBe(1); low.dispose();
  });
  it('falls back to readable content when WebGL creation fails', () => {
    harness.fail = true; const element = container(), cinematic = new EpochCinematic(element, 1, { reducedMotion: true });
    expect(cinematic.stats.webgl).toBe(false); expect(element.append).toHaveBeenCalledWith(expect.objectContaining({ className: 'epoch-fallback' })); cinematic.dispose();
  });
  it('releases a lost context immediately and ignores stale observer callbacks after disposal', () => {
    const element = container(), cinematic = new EpochCinematic(element, 8, { reducedMotion: false }), renderer = harness.renderers[0];
    renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(cinematic.stats.webgl).toBe(false); expect(renderer.dispose).toHaveBeenCalledTimes(1); cinematic.render(6); cinematic.dispose();
    expect(renderer.dispose).toHaveBeenCalledTimes(1); expect(element.append).toHaveBeenCalledWith(expect.objectContaining({ className: 'epoch-fallback' }));
  });
});
