import * as THREE from 'three';

type Resource = THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.Skeleton | THREE.LightShadow;
const owners = new WeakMap<THREE.Object3D, Set<Resource>>();
const references = new WeakMap<Resource, number>();

// Creature factories share cached resources across scene and specimen renderers.
// Count live mesh owners so closing either view cannot invalidate the other.
export function retainObjectResources(root: THREE.Object3D) {
  root.traverse(object => {
    if (owners.has(object)) return;
    const resources = new Set<Resource>();
    if (object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight || object instanceof THREE.PointLight) {
      resources.add(object.shadow);
    } else if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
      resources.add(object.geometry);
      // Skeletons allocate a bone texture lazily, after the loader's retain call.
      // Retain the skeleton itself so its eventual texture is freed on last release.
      if (object instanceof THREE.SkinnedMesh) resources.add(object.skeleton);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
      }
    } else return;
    owners.set(object, resources);
    resources.forEach(resource => references.set(resource, (references.get(resource) || 0) + 1));
  });
}

export function releaseObjectResources(root: THREE.Object3D) {
  root.traverse(object => {
    const resources = owners.get(object); if (!resources) return;
    owners.delete(object);
    resources.forEach(resource => {
      const remaining = (references.get(resource) || 1) - 1;
      if (remaining) references.set(resource, remaining);
      else { references.delete(resource); resource.dispose(); }
    });
  });
}
