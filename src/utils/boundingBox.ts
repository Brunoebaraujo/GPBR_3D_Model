import { Box3, Euler, Matrix4, Vector3 } from 'three';
import type { DimensionsMm, PackingObject, Vector3Mm } from '../types';
import { rotationDegreesToRadians } from './unitConversion';

export interface RotatedBoundingBox extends DimensionsMm {
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
}

// Analytical bounds: exact for boxes and circular cylinders, without tessellation error.
export const getRotatedBoundingBox = (object: PackingObject): RotatedBoundingBox => {
  const { width, depth, height } = object.dimensions;
  const e = new Matrix4().makeRotationFromEuler(new Euler(...rotationDegreesToRadians(object.rotation), 'XYZ')).elements;
  const extent = (row: number) => object.type === 'cylinder'
    ? Math.abs(e[row + 4]) * height / 2 + width / 2 * Math.hypot(e[row], e[row + 8])
    : (Math.abs(e[row]) * width + Math.abs(e[row + 4]) * height + Math.abs(e[row + 8]) * depth) / 2;
  const halfX = extent(0), halfY = extent(2), halfZ = extent(1);
  return { width: 2 * halfX, depth: 2 * halfY, height: 2 * halfZ, minX: -halfX, maxX: halfX, minY: -halfY, maxY: halfY, minZ: -halfZ, maxZ: halfZ };
};
export const getPackingObjectBounds = (object: PackingObject, position: Vector3Mm = object.position): RotatedBoundingBox => {
  const b = getRotatedBoundingBox(object);
  return { ...b, minX: b.minX + position.x, maxX: b.maxX + position.x, minY: b.minY + position.y, maxY: b.maxY + position.y, minZ: b.minZ + position.z, maxZ: b.maxZ + position.z };
};
export const getPackingObjectBox = (object: PackingObject, position?: Vector3Mm): Box3 => {
  const b = getPackingObjectBounds(object, position);
  return new Box3(new Vector3(b.minX, b.minY, b.minZ), new Vector3(b.maxX, b.maxY, b.maxZ));
};
export const getRotatedBoundingBoxDimensions = (object: PackingObject): DimensionsMm => {
  const { width, depth, height } = getRotatedBoundingBox(object);
  return { width, depth, height };
};
export const calculateRotatedBoundingBox = getRotatedBoundingBox;
