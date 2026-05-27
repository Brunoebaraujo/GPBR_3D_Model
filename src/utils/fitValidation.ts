import type { ContainerSpec, FitValidationResult, PackingObject } from '../types';
import { calculateRotatedBoundingBox } from './boundingBox';

const getBoxVolume = (dimensions: PackingObject['dimensions']): number =>
  dimensions.width * dimensions.depth * dimensions.height;

const getObjectVolume = (object: PackingObject): number => {
  const bounds = calculateRotatedBoundingBox(object);

  return getBoxVolume(bounds);
};

const getObjectBounds = (object: PackingObject) => {
  const { width, depth, height } = calculateRotatedBoundingBox(object);
  const { x, y, z } = object.position;

  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minY: y - height / 2,
    maxY: y + height / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  };
};

const getContainerBounds = (container: ContainerSpec) => {
  const { width, depth, height } = container.internalDimensions;

  return {
    minX: -width / 2,
    maxX: width / 2,
    minY: 0,
    maxY: height,
    minZ: -depth / 2,
    maxZ: depth / 2,
  };
};

export const validateFit = (
  objects: PackingObject[],
  container: ContainerSpec,
): FitValidationResult => {
  const containerBounds = getContainerBounds(container);
  const internalVolumeMm3 = getBoxVolume(container.internalDimensions);
  const occupiedVolumeMm3 = objects.reduce((total, object) => total + getObjectVolume(object), 0);
  const totalObjectWeightKg = objects.reduce((total, object) => total + object.weightKg, 0);
  const remainingPayloadKg = container.maxPayloadKg - totalObjectWeightKg;
  const volumeUtilizationPercent = internalVolumeMm3 > 0 ? (occupiedVolumeMm3 / internalVolumeMm3) * 100 : 0;

  const objectResults = objects.map((object) => {
    const warnings: string[] = [];
    const bounds = getObjectBounds(object);

    if (
      bounds.maxX - bounds.minX > container.internalDimensions.width ||
      bounds.maxZ - bounds.minZ > container.internalDimensions.depth ||
      bounds.maxY - bounds.minY > container.internalDimensions.height
    ) {
      warnings.push(`${object.name} dimensions exceed MB5 usable dimensions.`);
    }

    if (
      bounds.minX < containerBounds.minX ||
      bounds.maxX > containerBounds.maxX ||
      bounds.minY < containerBounds.minY ||
      bounds.maxY > containerBounds.maxY ||
      bounds.minZ < containerBounds.minZ ||
      bounds.maxZ > containerBounds.maxZ
    ) {
      warnings.push(`${object.name} is outside the usable internal volume.`);
    }

    return {
      objectId: object.id,
      fits: warnings.length === 0,
      warnings,
    };
  });

  const warnings = objectResults.flatMap((result) => result.warnings);

  if (totalObjectWeightKg > container.maxPayloadKg) {
    warnings.push('Total object weight exceeds MB5 maximum payload.');
  }

  if (volumeUtilizationPercent > 100) {
    warnings.push('Volume utilization exceeds 100%.');
  }

  return {
    fits: warnings.length === 0,
    volumeUtilizationPercent,
    occupiedVolumeMm3,
    internalVolumeMm3,
    totalObjectWeightKg,
    remainingPayloadKg,
    objectCount: objects.length,
    warnings,
    objectResults,
  };
};
