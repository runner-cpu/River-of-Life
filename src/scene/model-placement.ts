import * as THREE from 'three';

/** Frame an initial animated pose without overwriting transforms owned by GLTF tracks. */
export function placeModel(source: THREE.Group, clips: THREE.AnimationClip[], length: number) {
  const root = new THREE.Group();
  root.add(source);
  const mixer = clips.length ? new THREE.AnimationMixer(root) : undefined;
  if (mixer) {
    mixer.clipAction(clips.find(clip => /idle/i.test(clip.name)) || clips.find(clip => /walk/i.test(clip.name)) || clips[0]).play();
    mixer.update(0);
  }
  source.updateMatrixWorld(true);
  source.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  const box = new THREE.Box3().setFromObject(source, true);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent <= 0) {
    mixer?.stopAllAction(); mixer?.uncacheRoot(root);
    throw new Error('Model has no finite visible extent');
  }
  const scale = length / extent;
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);
  return { root, mixer };
}
