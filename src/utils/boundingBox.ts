import type { DimensionsMm, PackingObject, RotationDeg } from '../types';
import { degreesToRadians } from './unitConversion';

const normalizeSmallValue = (value: number): number => (Math.abs(value) < 1e-9 ? 0 : value);

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

const rotateCorner = (
  corner: { x: number; y: number; z: number },
  rotation: RotationDeg,
) => {
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

export const getRotatedBoundingBoxDimensions = (object: PackingObject): DimensionsMm => {
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

  const minX = Math.min(...corners.map((corner) => corner.x));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const minY = Math.min(...corners.map((corner) => corner.y));
  const maxY = Math.max(...corners.map((corner) => corner.y));
  const minZ = Math.min(...corners.map((corner) => corner.z));
  const maxZ = Math.max(...corners.map((corner) => corner.z));

  return {
    width: normalizeSmallValue(maxX - minX),
    depth: normalizeSmallValue(maxY - minY),
    height: normalizeSmallValue(maxZ - minZ),
  };
};

export const calculateRotatedBoundingBox = getRotatedBoundingBoxDimensions;
