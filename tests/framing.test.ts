import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { frameObject } from '../src/scene/framing';

describe('inspection framing', () => {
  it.each([.55, 1, 1.8, 2.5])('keeps wide, tall and offset specimens visible at aspect %s', aspect => {
    for (const dimensions of [[5,1,2], [1,6,1], [2,2,7]]) {
      const bounds = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(5,-.2,3),new THREE.Vector3(...dimensions));
      const fit = frameObject(bounds,42,aspect), camera = new THREE.PerspectiveCamera(42,aspect,.1,180);
      camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
      for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
        const projected = new THREE.Vector3(x,y,z).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(.76); expect(Math.abs(projected.y)).toBeLessThan(.76);
        expect(projected.z).toBeGreaterThan(-1); expect(projected.z).toBeLessThan(1);
      }
    }
  });
  it('rejects an empty box instead of moving the camera to invalid coordinates',()=>{
    expect(()=>frameObject(new THREE.Box3(),42,1)).toThrow();
  });
  it('shows a long specimen side-on regardless of its imported forward axis',()=>{
    for(const axis of ['x','z'] as const) {
      const size=new THREE.Vector3(1,1,1);size[axis]=8;
      const bounds=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(),size);
      const fit=frameObject(bounds,42,1.8),camera=new THREE.PerspectiveCamera(42,1.8,.1,180);
      camera.position.copy(fit.position);camera.lookAt(fit.target);camera.updateMatrixWorld();
      const head=new THREE.Vector3(),tail=new THREE.Vector3();head[axis]=-4;tail[axis]=4;
      expect(Math.abs(head.project(camera).x-tail.project(camera).x)).toBeGreaterThan(.9);
    }
  });
});
