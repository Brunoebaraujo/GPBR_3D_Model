import { Euler, Vector3 } from 'three';
import type { PackingObject, RotationDeg, TopFace } from '../types';
import { rotationDegreesToRadians } from './unitConversion';

export const TOP_FACES: { value: TopFace; label: string; normal: [number, number, number] }[] = [
  { value: '+z', label: 'Superior (+Z)', normal: [0, 1, 0] },
  { value: '-z', label: 'Inferior (−Z)', normal: [0, -1, 0] },
  { value: '+x', label: 'Direita (+X)', normal: [1, 0, 0] },
  { value: '-x', label: 'Esquerda (−X)', normal: [-1, 0, 0] },
  { value: '+y', label: 'Frontal (+Y)', normal: [0, 0, 1] },
  { value: '-y', label: 'Traseira (−Y)', normal: [0, 0, -1] },
];
export const getObjectVolume = (object: PackingObject): number => {
  const { width, depth, height } = object.dimensions;
  return object.type === 'cylinder' ? Math.PI * (width / 2) ** 2 * height : width * depth * height;
};
export const isTopUp = (object: PackingObject, rotation: RotationDeg = object.rotation): boolean => {
  const normal = TOP_FACES.find(face => face.value === (object.topFace ?? '+z'))!.normal;
  const vector = new Vector3(...normal).applyEuler(new Euler(...rotationDegreesToRadians(rotation), 'XYZ'));
  return vector.y > 1 - 1e-6;
};
export const isUprightCylinder = (object: PackingObject): boolean => {
  const axis = new Vector3(0, 1, 0).applyEuler(new Euler(...rotationDegreesToRadians(object.rotation), 'XYZ'));
  return object.type === 'cylinder' && Math.abs(axis.y) > 1 - 1e-6;
};
export const getFaceFromMaterial = (object: PackingObject, index: number): TopFace | null =>
  object.type === 'cylinder'
    ? index === 1 ? '+z' : index === 2 ? '-z' : null
    : (['+x', '-x', '+z', '-z', '+y', '-y'] as TopFace[])[index] ?? null;
export const faceColor = (object: PackingObject, index: number) => {
  const face = getFaceFromMaterial(object, index);
  const top = object.topFace ?? '+z';
  const opposite = `${top[0] === '+' ? '-' : '+'}${top[1]}`;
  return face === top ? '#16a05d' : face === opposite ? '#e06a2d' : object.color;
};
