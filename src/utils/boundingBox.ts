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

const disposeMesh = (mesh: ReturnType<typeof createPackingMesh>) => {
  mesh.geometry.dispose();
};

const convertThreeBoxToPackingBox = (box: Box3): Box3 =>
  new Box3(
    new Vector3(box.min.x, box.min.z, box.min.y),
    new Vector3(box.max.x, box.max.z, box.max.y),
  );

export const getPackingObjectBox = (object: PackingObject, position?: Vector3Mm): Box3 => {
  const mesh = createPackingMesh(object, position);
  const threeBox = new Box3().setFromObject(mesh);
  disposeMesh(mesh);

  return convertThreeBoxToPackingBox(threeBox);
};

const toRotatedBoundingBox = (box: Box3): RotatedBoundingBox => {
  const size = box.getSize(new Vector3());

  return {
    width: normalizeValue(size.x),
    depth: normalizeValue(size.y),
    height: normalizeValue(size.z),
    minX: normalizeValue(box.min.x),
    maxX: normalizeValue(box.max.x),
    minY: normalizeValue(box.min.y),
    maxY: normalizeValue(box.max.y),
    minZ: normalizeValue(box.min.z),
    maxZ: normalizeValue(box.max.z),
  };
};

export const getRotatedBoundingBox = (object: PackingObject): RotatedBoundingBox =>
  toRotatedBoundingBox(getPackingObjectBox(object, { x: 0, y: 0, z: 0 }));

export const getRotatedBoundingBoxDimensions = (object: PackingObject): DimensionsMm => {
  const { width, depth, height } = getRotatedBoundingBox(object);

  return { width, depth, height };
};

export const getPackingObjectBounds = (object: PackingObject, position = object.position): RotatedBoundingBox =>
  toRotatedBoundingBox(getPackingObjectBox(object, position));

export const calculateRotatedBoundingBox = getRotatedBoundingBox;
