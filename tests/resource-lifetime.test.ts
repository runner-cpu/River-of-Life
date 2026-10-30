import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCreature } from '../src/scene/creatures';
import { releaseObjectResources, retainObjectResources } from '../src/scene/resource-lifetime';

describe('resources shared by simultaneously open museum views', () => {
  it('disposes shadow targets allocated after a chapter was retained', () => {
    const chapter = new THREE.Group(), sun = new THREE.DirectionalLight(); chapter.add(sun);
    retainObjectResources(chapter);
    sun.shadow.map = new THREE.WebGLRenderTarget(16, 16);
    const dispose = vi.spyOn(sun.shadow.map, 'dispose');
    releaseObjectResources(chapter); expect(dispose).toHaveBeenCalledTimes(1);
    releaseObjectResources(chapter); expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('releases removed placeholder resources while preserving cache resources still used by a specimen', () => {
    const creature = { id: 'example', form: 'frond' as const, color: '#ab735a' };
    const scene = new THREE.Group(), placeholder = createCreature(creature), specimen = createCreature(creature);
    scene.add(placeholder); retainObjectResources(scene); retainObjectResources(specimen);
    const shared = (placeholder.children.find(child => child instanceof THREE.Mesh && (child.geometry as THREE.SphereGeometry).type === 'SphereGeometry') as THREE.Mesh);
    const unique = placeholder.children.find(child => child instanceof THREE.Mesh && child.geometry.type === 'TubeGeometry') as THREE.Mesh;
    const sharedGeometry = vi.spyOn(shared.geometry, 'dispose'), sharedMaterial = vi.spyOn(shared.material as THREE.Material, 'dispose'), uniqueGeometry = vi.spyOn(unique.geometry, 'dispose');
    scene.remove(placeholder); releaseObjectResources(placeholder);
    expect(uniqueGeometry).toHaveBeenCalledTimes(1); expect(sharedGeometry).not.toHaveBeenCalled(); expect(sharedMaterial).not.toHaveBeenCalled();
    releaseObjectResources(scene); expect(sharedGeometry).not.toHaveBeenCalled();
    releaseObjectResources(specimen); expect(sharedGeometry).toHaveBeenCalledTimes(1); expect(sharedMaterial).toHaveBeenCalledTimes(1);
    releaseObjectResources(specimen); expect(sharedGeometry).toHaveBeenCalledTimes(1);
    sharedGeometry.mockRestore(); sharedMaterial.mockRestore(); uniqueGeometry.mockRestore();
  });

  it('keeps a shared texture alive until the final material owner closes', () => {
    const texture = new THREE.Texture(), first = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: texture })), second = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: texture }));
    retainObjectResources(first); retainObjectResources(second); const dispose = vi.spyOn(texture, 'dispose');
    releaseObjectResources(first); expect(dispose).not.toHaveBeenCalled();
    releaseObjectResources(second); expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('releases a lazily created bone texture only after the last skeleton owner closes', () => {
    const skeleton = new THREE.Skeleton([new THREE.Bone()]);
    const first = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const second = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    first.bind(skeleton); second.bind(skeleton);
    retainObjectResources(first); retainObjectResources(second);
    skeleton.computeBoneTexture();
    const dispose = vi.spyOn(skeleton.boneTexture!, 'dispose');
    releaseObjectResources(first); expect(dispose).not.toHaveBeenCalled();
    releaseObjectResources(second); expect(dispose).toHaveBeenCalledTimes(1);
    expect(skeleton.boneTexture).toBeNull();
    releaseObjectResources(second); expect(dispose).toHaveBeenCalledTimes(1);
  });
});
