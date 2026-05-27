import { BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { PackingObject, Vector3Mm } from '../types';
import { degreesToRadians } from './unitConversion';

const material = new MeshBasicMaterial();

export const createPackingMesh = (object: PackingObject, position?: Vector3Mm): Mesh => {
  const { width, depth, height } = object.dimensions;
  const geometry =
    object.type === 'cylinder'
      ? new CylinderGeometry(width / 2, width / 2, height, 40)
      : new BoxGeometry(width, depth, height);

  if (object.type === 'cylinder') {
    geometry.rotateX(Math.PI / 2);
  }

  const mesh = new Mesh(geometry, material);
  mesh.rotation.set(
    degreesToRadians(object.rotation.x),
    degreesToRadians(object.rotation.y),
    degreesToRadians(object.rotation.z),
    'XYZ',
  );

  if (position) {
    mesh.position.set(position.x, position.y, position.z);
  }

  mesh.updateMatrixWorld(true);

  return mesh;
};
