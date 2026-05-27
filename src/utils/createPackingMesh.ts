import { BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { PackingObject, Vector3Mm } from '../types';
import { degreesToRadians } from './unitConversion';

const material = new MeshBasicMaterial();

export const createPackingMesh = (object: PackingObject, position?: Vector3Mm): Mesh => {
  const { width, depth, height } = object.dimensions;
  const geometry =
    object.type === 'cylinder'
      ? new CylinderGeometry(width / 2, width / 2, height, 40)
      : new BoxGeometry(width, height, depth);

  const mesh = new Mesh(geometry, material);
  mesh.rotation.set(
    degreesToRadians(object.rotation.x),
    degreesToRadians(object.rotation.z),
    degreesToRadians(object.rotation.y),
    'XYZ',
  );

  if (position) {
    mesh.position.set(position.x, position.z, position.y);
  }

  mesh.updateMatrixWorld(true);

  return mesh;
};
