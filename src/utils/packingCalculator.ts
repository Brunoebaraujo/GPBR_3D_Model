import type { ContainerSpec, GridPackingResult, PackingObject, Vector3Mm } from '../types';

const getObjectVolume = (object: PackingObject): number => {
  if (object.type === 'cylinder') {
    return Math.PI * (object.dimensions.width / 2) ** 2 * object.dimensions.height;
  }

  return object.dimensions.width * object.dimensions.depth * object.dimensions.height;
};

export const calculateGridPacking = (
  container: ContainerSpec,
  object: PackingObject,
  spacingMm = 0,
): GridPackingResult => {
  const spacing = Math.max(0, spacingMm);
  const { width: internalWidth, depth: internalDepth, height: internalHeight } = container.internalDimensions;
  const { width: objectWidth, depth: objectDepth, height: objectHeight } = object.dimensions;

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

  if (
    objectWidth <= 0 ||
    objectDepth <= 0 ||
    objectHeight <= 0 ||
    objectWidth > internalWidth ||
    objectDepth > internalDepth ||
    objectHeight > internalHeight
  ) {
    return emptyResult('Object does not fit inside MB5.');
  }

  const countAlongAxis = (available: number, item: number) =>
    Math.floor((available + spacing) / (item + spacing));

  const countX = countAlongAxis(internalWidth, objectWidth);
  const countY = countAlongAxis(internalDepth, objectDepth);
  const countZ = countAlongAxis(internalHeight, objectHeight);
  const totalQuantity = countX * countY * countZ;
  const totalWeight = totalQuantity * object.weightKg;
  const remainingPayload = container.maxPayloadKg - totalWeight;
  const exceedsPayload = totalWeight > container.maxPayloadKg;
  const payloadLimitedQuantity =
    object.weightKg > 0 ? Math.floor(container.maxPayloadKg / object.weightKg) : totalQuantity;
  const containerVolume = internalWidth * internalDepth * internalHeight;
  const volumeUtilizationPercent =
    containerVolume > 0 ? ((getObjectVolume(object) * totalQuantity) / containerVolume) * 100 : 0;

  const positions: Vector3Mm[] = [];
  const startX = -internalWidth / 2 + objectWidth / 2;
  const startZ = -internalDepth / 2 + objectDepth / 2;

  for (let heightIndex = 0; heightIndex < countZ; heightIndex += 1) {
    for (let depthIndex = 0; depthIndex < countY; depthIndex += 1) {
      for (let xIndex = 0; xIndex < countX; xIndex += 1) {
        positions.push({
          x: startX + xIndex * (objectWidth + spacing),
          y: objectHeight / 2 + heightIndex * (objectHeight + spacing),
          z: startZ + depthIndex * (objectDepth + spacing),
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
