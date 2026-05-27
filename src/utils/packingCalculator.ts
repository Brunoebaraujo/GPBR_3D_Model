import type { ContainerSpec, GridPackingResult, PackingObject, Vector3Mm } from '../types';
import { getPackingObjectBounds, getRotatedBoundingBox } from './boundingBox';

const EPSILON = 1e-6;

const isInsideBounds = (
  bounds: ReturnType<typeof getPackingObjectBounds>,
  limits: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number },
) =>
  bounds.minX >= limits.xMin - EPSILON &&
  bounds.maxX <= limits.xMax + EPSILON &&
  bounds.minY >= limits.yMin - EPSILON &&
  bounds.maxY <= limits.yMax + EPSILON &&
  bounds.minZ >= limits.zMin - EPSILON &&
  bounds.maxZ <= limits.zMax + EPSILON;

export const calculateGridPacking = (
  container: ContainerSpec,
  object: PackingObject,
  spacingMm = 0,
): GridPackingResult => {
  const spacing = Math.max(0, spacingMm);
  const { width: internalWidth, depth: internalDepth, height: internalHeight } = container.internalDimensions;
  const originBounds = getRotatedBoundingBox(object);
  const { width: effectiveWidth, depth: effectiveDepth, height: effectiveHeight } = originBounds;

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

  const limits = {
    xMin: -internalWidth / 2,
    xMax: internalWidth / 2,
    yMin: -internalDepth / 2,
    yMax: internalDepth / 2,
    zMin: 0,
    zMax: internalHeight,
  };

  const firstPosition = {
    x: limits.xMin - originBounds.minX,
    y: limits.yMin - originBounds.minY,
    z: limits.zMin - originBounds.minZ,
  };

  const positions: Vector3Mm[] = [];
  let rejectedCount = 0;

  for (let iz = 0; iz < countZ; iz += 1) {
    for (let iy = 0; iy < countY; iy += 1) {
      for (let ix = 0; ix < countX; ix += 1) {
        const position = {
          x: firstPosition.x + ix * stepX,
          y: firstPosition.y + iy * stepY,
          z: firstPosition.z + iz * stepZ,
        };
        const bounds = getPackingObjectBounds(object, position);

        if (isInsideBounds(bounds, limits)) {
          positions.push(position);
        } else {
          rejectedCount += 1;
        }
      }
    }
  }

  const totalQuantity = positions.length;
  const totalWeight = totalQuantity * object.weightKg;
  const remainingPayload = container.maxPayloadKg - totalWeight;
  const exceedsPayload = totalWeight > container.maxPayloadKg;
  const payloadLimitedQuantity =
    object.weightKg > 0 ? Math.floor(container.maxPayloadKg / object.weightKg) : totalQuantity;
  const containerVolume = internalWidth * internalDepth * internalHeight;
  const objectVolume = effectiveWidth * effectiveDepth * effectiveHeight;
  const volumeUtilizationPercent =
    containerVolume > 0 ? ((objectVolume * totalQuantity) / containerVolume) * 100 : 0;

  if (rejectedCount > 0) {
    console.warn(`${rejectedCount} generated object(s) were skipped because their Box3 exceeded MB5 limits.`);
  }

  const warnings = [
    exceedsPayload ? 'Payload limit exceeded.' : undefined,
    rejectedCount > 0 ? `${rejectedCount} generated object(s) were skipped because their Box3 exceeded MB5 limits.` : undefined,
  ].filter(Boolean);

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
    warning: warnings.length > 0 ? warnings.join(' ') : undefined,
  };
};
