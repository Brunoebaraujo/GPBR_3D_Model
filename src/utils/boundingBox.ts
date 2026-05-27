import type { DimensionsMm, PackingObject, RotationDeg, Vector3Mm } from '../types';
import { degreesToRadians } from './unitConversion';

export interface RotatedBoundingBox extends DimensionsMm {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  offset: Vector3Mm;
}

const EPSILON = 1e-9;

const normalizeSmallValue = (value: number): number => {
  if (Math.abs(value) < EPSILON) {
    return 0;
  }

  const nearestInteger = Math.round(value);

  return Math.abs(value - nearestInteger) < EPSILON ? nearestInteger : value;
};

const getTemplateDimensions = (object: PackingObject): DimensionsMm => {
  if (object.type !== 'cylinder') {
    return object.dimensions;
  }

  const diameter = object.dimensions.width;

  return {
    width: diameter,
    depth: diameter,
    height: object.dimensions.height,
  };
};

const rotateCorner = (corner: Vector3Mm, rotation: RotationDeg): Vector3Mm => {
  const rotationX = degreesToRadians(rotation.x);
  const rotationY = degreesToRadians(rotation.y);
  const rotationZ = degreesToRadians(rotation.z);

  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const cosZ = Math.cos(rotationZ);
  const sinZ = Math.sin(rotationZ);

  const afterX = {
    x: corner.x,
    y: corner.y * cosX - corner.z * sinX,
    z: corner.y * sinX + corner.z * cosX,
  };

  const afterY = {
    x: afterX.x * cosY + afterX.z * sinY,
    y: afterX.y,
    z: -afterX.x * sinY + afterX.z * cosY,
  };

  return {
    x: afterY.x * cosZ - afterY.y * sinZ,
    y: afterY.x * sinZ + afterY.y * cosZ,
    z: afterY.z,
  };
};

export const getRotatedBoundingBox = (object: PackingObject): RotatedBoundingBox => {
  const { width, depth, height } = getTemplateDimensions(object);
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const halfHeight = height / 2;

  const corners = [-1, 1].flatMap((xSign) =>
    [-1, 1].flatMap((ySign) =>
      [-1, 1].map((zSign) =>
        rotateCorner(
          {
            x: xSign * halfWidth,
            y: ySign * halfDepth,
            z: zSign * halfHeight,
          },
          object.rotation,
        ),
      ),
    ),
  );

  const minX = normalizeSmallValue(Math.min(...corners.map((corner) => corner.x)));
  const maxX = normalizeSmallValue(Math.max(...corners.map((corner) => corner.x)));
  const minY = normalizeSmallValue(Math.min(...corners.map((corner) => corner.y)));
  const maxY = normalizeSmallValue(Math.max(...corners.map((corner) => corner.y)));
  const minZ = normalizeSmallValue(Math.min(...corners.map((corner) => corner.z)));
  const maxZ = normalizeSmallValue(Math.max(...corners.map((corner) => corner.z)));

  const effectiveWidth = normalizeSmallValue(maxX - minX);
  const effectiveDepth = normalizeSmallValue(maxY - minY);
  const effectiveHeight = normalizeSmallValue(maxZ - minZ);

  return {
    width: effectiveWidth,
    depth: effectiveDepth,
    height: effectiveHeight,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    offset: {
      x: normalizeSmallValue(-minX - effectiveWidth / 2),
      y: normalizeSmallValue(-minY - effectiveDepth / 2),
      z: normalizeSmallValue(-minZ - effectiveHeight / 2),
    },
  };
};

export const getRotatedBoundingBoxDimensions = (object: PackingObject): DimensionsMm => {
  const { width, depth, height } = getRotatedBoundingBox(object);

  return { width, depth, height };
};

export const calculateRotatedBoundingBox = getRotatedBoundingBox;
