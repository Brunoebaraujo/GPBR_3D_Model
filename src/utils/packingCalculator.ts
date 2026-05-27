import type { ContainerSpec, GridPackingResult, PackingObject, Vector3Mm } from '../types';
import { getRotatedBoundingBox } from './boundingBox';

const getObjectVolume = (object: PackingObject): number => {
  const { width, depth, height } = getRotatedBoundingBox(object);

  return width * depth * height;
};

export const calculateGridPacking = (
  container: ContainerSpec,
  object: PackingObject,
  spacingMm = 0,
): GridPackingResult => {
  const spacing = Math.max(0, spacingMm);
  const { width: internalWidth, depth: internalDepth, height: internalHeight } = container.internalDimensions;
  const {
    width: effectiveWidth,
    depth: effectiveDepth,
    height: effectiveHeight,
    offset,
  } = getRotatedBoundingBox(object);

  const emptyResult = (warning?: string): GridPackingResult => ({
    countX: 0,
    countY: 0,
    countZ: 0,
    totalQuantity: 0,
    payloadLimitedQuantity: 0,
    totalWeight: 0,
    remainingPayload: container.maxPayloadKg,
    exceedsPayload: false,
    volumeUtilizationPercent: 0,
    positions: [],
    warning,
  });

  if (effectiveWidth <= 0 || effectiveDepth <= 0 || effectiveHeight <= 0) {
    return emptyResult('Object has invalid transformed dimensions.');
  }

  if (
    effectiveWidth > internalWidth ||
    effectiveDepth > internalDepth ||
    effectiveHeight > internalHeight
  ) {
    return emptyResult('Object does not fit inside MB5.');
  }

  const stepX = effectiveWidth + spacing;
  const stepY = effectiveDepth + spacing;
  const stepZ = effectiveHeight + spacing;

  const countX = Math.floor((internalWidth + spacing) / stepX);
  const countY = Math.floor((internalDepth + spacing) / stepY);
  const countZ = Math.floor((internalHeight + spacing) / stepZ);
  const totalQuantity = countX * countY * countZ;
  const totalWeight = totalQuantity * object.weightKg;
  const remainingPayload = container.maxPayloadKg - totalWeight;
  const exceedsPayload = totalWeight > container.maxPayloadKg;
  const payloadLimitedQuantity =
    object.weightKg > 0 ? Math.floor(container.maxPayloadKg / object.weightKg) : totalQuantity;
  const containerVolume = internalWidth * internalDepth * internalHeight;
  const volumeUtilizationPercent =
    containerVolume > 0 ? ((getObjectVolume(object) * totalQuantity) / containerVolume) * 100 : 0;

  const xMin = -internalWidth / 2;
  const yMin = -internalDepth / 2;
  const zMin = 0;

  const positions: Vector3Mm[] = [];

  for (let iz = 0; iz < countZ; iz += 1) {
    for (let iy = 0; iy < countY; iy += 1) {
      for (let ix = 0; ix < countX; ix += 1) {
        const bboxCenterX = xMin + effectiveWidth / 2 + ix * stepX;
        const bboxCenterY = yMin + effectiveDepth / 2 + iy * stepY;
        const bboxCenterZ = zMin + effectiveHeight / 2 + iz * stepZ;

        positions.push({
          x: bboxCenterX + offset.x,
          y: bboxCenterY + offset.y,
          z: bboxCenterZ + offset.z,
        });
      }
    }
  }

  return {
    countX,
    countY,
    countZ,
    totalQuantity,
    payloadLimitedQuantity,
    totalWeight,
    remainingPayload,
    exceedsPayload,
    volumeUtilizationPercent,
    positions,
    warning: exceedsPayload ? 'Payload limit exceeded.' : undefined,
  };
};
