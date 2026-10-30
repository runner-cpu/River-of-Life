import * as THREE from 'three';

/** Fit every bounding-box corner, including its depth, into a perspective view. */
export function frameObject(bounds: THREE.Box3, fov: number, aspect: number) {
  const size = bounds.getSize(new THREE.Vector3()), target = bounds.getCenter(new THREE.Vector3());
  if (bounds.isEmpty() || !Number.isFinite(size.length()) || aspect <= 0) throw new Error('Cannot frame empty or invalid bounds');
  // Imported models do not share a forward axis. View the longer horizontal
  // dimension from its side so long necks and tails do not collapse head-on.
  const direction = (size.z > size.x * 1.2 ? new THREE.Vector3(6, 1.8, 2) : new THREE.Vector3(2, 1.8, 6)).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const vertical = Math.tan(THREE.MathUtils.degToRad(fov / 2)), horizontal = vertical * aspect;
  let distance = .5;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(target), depth = point.dot(direction);
    distance = Math.max(distance, depth + Math.abs(point.dot(right)) * 1.35 / horizontal, depth + Math.abs(point.dot(up)) * 1.35 / vertical);
  }
  return { target, position: target.clone().addScaledVector(direction, distance), minDistance: Math.max(.2, size.length() * .22), maxDistance: distance * 3 };
}
