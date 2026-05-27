import { Box3, Vector3 } from 'three';
import type { DimensionsMm, PackingObject, Vector3Mm } from '../types';
import { createPackingMesh } from './createPackingMesh';

export interface RotatedBoundingBox extends DimensionsMm {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

const EPSILON = 1e-7;

const normalizeValue = (value: number): number => {
  if (Math.abs(value) < EPSILON) {
    return 0;
  }

  const nearestInteger = Math.round(value);

  return Math.abs(value - nearestInteger) < EPSILON ? nearestInteger : value;
};

const normalizeVector = (vector: Vector3Mm): Vector3Mm => ({
  x: normalizeValue(vector.x),
  y: normalizeValue(vector.y),
  z: normalizeValue(vector.z),
});

const disposeMesh = (mesh: ReturnType<typeof createPackingMesh>) => {
  mesh.geometry.dispose();
};

export const getPackingObjectBox = (object: PackingObject, position?: Vector3Mm): Box3 => {
  const mesh = createPackingMesh(object, position);
  const box = new Box3().setFromObject(mesh);
  disposeMesh(mesh);

  return box;
};

export const getRotatedBoundingBox = (object: PackingObject): RotatedBoundingBox => {
  const box = getPackingObjectBox(object, { x: 0, y: 0, z: 0 });
  const size = normalizeVector(box.getSize(new Vector3()));

  return {
    width: size.x,
    depth: size.y,
    height: size.z,
    minX: normalizeValue(box.min.x),
    maxX: normalizeValue(box.max.x),
    minY: normalizeValue(box.min.y),
    maxY: normalizeValue(box.max.y),
    minZ: normalizeValue(box.min.z),
    maxZ: normalizeValue(box.max.z),
  };
};

export const getRotatedBoundingBoxDimensions = (object: PackingObject): DimensionsMm => {
  const { width, depth, height } = getRotatedBoundingBox(object);

  return { width, depth, height };
};

export const getPackingObjectBounds = (object: PackingObject, position = object.position): RotatedBoundingBox => {
  const box = getPackingObjectBox(object, position);
  const size = normalizeVector(box.getSize(new Vector3()));

  return {
    width: size.x,
    depth: size.y,
    height: size.z,
    minX: normalizeValue(box.min.x),
    maxX: normalizeValue(box.max.x),
    minY: normalizeValue(box.min.y),
    maxY: normalizeValue(box.max.y),
    minZ: normalizeValue(box.min.z),
    maxZ: normalizeValue(box.max.z),
  };
};

export const calculateRotatedBoundingBox = getRotatedBoundingBox;
