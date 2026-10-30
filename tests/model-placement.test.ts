import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { placeModel } from '../src/scene/model-placement';

describe('imported animated model placement', () => {
  it('keeps animation-owned transforms intact while placing a tiny source on the ground', () => {
    const source = new THREE.Group(); source.name = 'animated-source';
    source.position.set(8, 4, -3); source.scale.setScalar(.01);
    source.add(new THREE.Mesh(new THREE.BoxGeometry(4, 2, 6), new THREE.MeshBasicMaterial()));
    const clip = new THREE.AnimationClip('Idle', 1, [new THREE.VectorKeyframeTrack('animated-source.position', [0, 1], [8, 4, -3, 8.01, 4, -3])]);
    const placed = placeModel(source, [clip], 3);
    expect(source.position.toArray()).toEqual([8, 4, -3]); expect(source.scale.x).toBe(.01);
    const box = new THREE.Box3().setFromObject(placed.root, true);
    expect(box.min.y).toBeCloseTo(0); expect(box.getSize(new THREE.Vector3()).z).toBeCloseTo(3);
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0);
    const framing = placed.root.position.clone(); placed.mixer!.update(.5);
    expect(placed.root.position.equals(framing)).toBe(true);
    expect(source.position.x).toBeGreaterThan(8);
    placed.mixer!.stopAllAction(); placed.mixer!.uncacheRoot(placed.root);
  });

  it('measures the actual skinned pose after initial bone animation', () => {
    const geometry = new THREE.BoxGeometry(2, 4, 6), count = geometry.attributes.position.count;
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4); for (let index = 0; index < count; index++) weights[index * 4] = 1;
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    const bone = new THREE.Bone(); bone.name = 'body-bone'; mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
    const source = new THREE.Group(); source.add(mesh); source.scale.setScalar(.01);
    const clip = new THREE.AnimationClip('Idle', 1, [new THREE.VectorKeyframeTrack('body-bone.position', [0, 1], [7, 20, -4, 7, 21, -4])]);
    const placed = placeModel(source, [clip], 3);
    const box = new THREE.Box3().setFromObject(placed.root, true);
    expect(box.min.y).toBeCloseTo(0); expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0); expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0);
    expect(box.getSize(new THREE.Vector3()).z).toBeCloseTo(3);
    placed.mixer!.stopAllAction(); placed.mixer!.uncacheRoot(placed.root);
  });
});
