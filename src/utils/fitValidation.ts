import { Euler, Matrix3, Matrix4, Vector3 } from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import type { ContainerSpec, FitValidationResult, PackingObject } from '../types';
import { getPackingObjectBounds } from './boundingBox';
import { getObjectVolume, isTopUp, isUprightCylinder } from './productGeometry';
import { rotationDegreesToRadians } from './unitConversion';

const EPSILON = 1e-5;
const orientedBox = (object: PackingObject) => {
  const d = object.dimensions, p = object.position;
  const rotation = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...rotationDegreesToRadians(object.rotation), 'XYZ')));
  return new OBB(new Vector3(p.x, p.z, p.y), new Vector3(d.width / 2 - EPSILON, d.height / 2 - EPSILON, (object.type === 'cylinder' ? d.width : d.depth) / 2 - EPSILON), rotation);
};
export const validateFit = (objects: PackingObject[], container: ContainerSpec): FitValidationResult => {
  const d = container.internalDimensions;
  const internalVolumeMm3 = d.width * d.depth * d.height;
  const occupiedVolumeMm3 = objects.reduce((sum, object) => sum + getObjectVolume(object), 0);
  const totalObjectWeightKg = objects.reduce((sum, object) => sum + object.weightKg, 0);
  const objectResults = objects.map(object => {
    const bounds = getPackingObjectBounds(object), warnings: string[] = [];
    if (![...Object.values(object.dimensions), ...Object.values(object.position), ...Object.values(object.rotation), object.weightKg].every(Number.isFinite) || Object.values(object.dimensions).some(v => v <= 0) || object.weightKg < 0) warnings.push(`${object.name}: dados inválidos.`);
    if (bounds.minX < -d.width / 2 - EPSILON || bounds.maxX > d.width / 2 + EPSILON || bounds.minY < -d.depth / 2 - EPSILON || bounds.maxY > d.depth / 2 + EPSILON || bounds.minZ < -EPSILON || bounds.maxZ > d.height + EPSILON) warnings.push(`${object.name}: fora do volume útil do MB5.`);
    if (object.keepTopUp && !isTopUp(object)) warnings.push(`${object.name}: o topo deve permanecer para cima.`);
    return { objectId: object.id, fits: warnings.length === 0, warnings };
  });
  // Sweep along X for broad-phase rejection; test boxes using SAT and vertical cylinders by radius.
  const entries = objects.map((object, index) => ({ object, index, bounds: getPackingObjectBounds(object), obb: orientedBox(object) })).sort((a,b) => a.bounds.minX - b.bounds.minX);
  let collisions = 0, conservative = false;
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const a = entries[i], b = entries[j];
    if (b.bounds.minX >= a.bounds.maxX - EPSILON) break;
    if (a.bounds.maxY <= b.bounds.minY + EPSILON || b.bounds.maxY <= a.bounds.minY + EPSILON || a.bounds.maxZ <= b.bounds.minZ + EPSILON || b.bounds.maxZ <= a.bounds.minZ + EPSILON) continue;
    const cylinders = isUprightCylinder(a.object) && isUprightCylinder(b.object);
    const intersects = cylinders ? Math.hypot(a.object.position.x - b.object.position.x, a.object.position.y - b.object.position.y) < (a.object.dimensions.width + b.object.dimensions.width) / 2 - EPSILON : a.obb.intersectsOBB(b.obb);
    if (!intersects) continue;
    collisions++;
    conservative ||= !cylinders && (a.object.type === 'cylinder' || b.object.type === 'cylinder');
    objectResults[a.index].fits = false; objectResults[b.index].fits = false;
  }
  const warnings = objectResults.flatMap(result => result.warnings);
  if (collisions) warnings.push(conservative ? `${collisions} possível(is) sobreposição(ões). Cilindros inclinados ou misturados a blocos usam envelopes conservadores.` : `${collisions} sobreposição(ões) entre produtos.`);
  if (totalObjectWeightKg > container.maxPayloadKg + EPSILON) warnings.push('Peso total excede a carga máxima do MB5.');
  const volumeUtilizationPercent = occupiedVolumeMm3 / internalVolumeMm3 * 100;
  if (volumeUtilizationPercent > 100 + EPSILON) warnings.push('Volume dos produtos excede 100% do volume útil.');
  return { fits: warnings.length === 0, volumeUtilizationPercent, occupiedVolumeMm3, internalVolumeMm3, totalObjectWeightKg, remainingPayloadKg: container.maxPayloadKg - totalObjectWeightKg, objectCount: objects.length, warnings, objectResults };
};
