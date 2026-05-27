import type { DimensionsMm, PackingObject, RotationDeg } from '../types';
import { degreesToRadians } from './unitConversion';

export interface RotatedBoundingBox extends DimensionsMm {
  effectiveWidth: number;
  effectiveDepth: number;
  effectiveHeight: number;
}

const withEffectiveAliases = (dimensions: DimensionsMm): RotatedBoundingBox => ({
  ...dimensions,
  effectiveWidth: dimensions.width,
  effectiveDepth: dimensions.depth,
  effectiveHeight: dimensions.height,
});

const getBoxRotatedDimensions = (
  dimensions: DimensionsMm,
  rotation: RotationDeg,
): RotatedBoundingBox => {
  const x = degreesToRadians(rotation.x);
  const y = degreesToRadians(rotation.y);
  const z = degreesToRadians(rotation.z);

  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);

  const matrix = [
    [c * e, -c * f, d],
    [a * f + b * d * e, a * e - b * d * f, -b * c],
    [b * f - a * d * e, b * e + a * d * f, a * c],
  ];

  const { width, depth, height } = dimensions;

  // Packing uses width/depth/height as its occupied axes, so Z rotation is
  // treated as a turn in the floor footprint.
  return withEffectiveAliases({
    width:
      Math.abs(matrix[0][0]) * width +
      Math.abs(matrix[0][1]) * depth +
      Math.abs(matrix[0][2]) * height,
    depth:
      Math.abs(matrix[1][0]) * width +
      Math.abs(matrix[1][1]) * depth +
      Math.abs(matrix[1][2]) * height,
    height:
      Math.abs(matrix[2][0]) * width +
      Math.abs(matrix[2][1]) * depth +
      Math.abs(matrix[2][2]) * height,
  });
};

const getCylinderRotatedDimensions = (
  dimensions: DimensionsMm,
  rotation: RotationDeg,
): RotatedBoundingBox => {
  const diameter = dimensions.width;

  return getBoxRotatedDimensions(
    {
      width: diameter,
      depth: diameter,
      height: dimensions.height,
    },
    rotation,
  );
};

export const calculateRotatedBoundingBox = (object: PackingObject): RotatedBoundingBox =>
  object.type === 'cylinder'
    ? getCylinderRotatedDimensions(object.dimensions, object.rotation)
    : getBoxRotatedDimensions(object.dimensions, object.rotation);
