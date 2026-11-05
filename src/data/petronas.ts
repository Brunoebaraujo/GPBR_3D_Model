import type { DimensionsMm, PackingObjectType } from '../types';

export interface PetronasSku {
  id: string;
  label: string;
  kind: PackingObjectType;
  dimensions?: DimensionsMm;
  color: string;
  sourceNote?: string;
  cageQuantities?: { cage32?: number; cage48?: number; cage114?: number; cage90?: number };
}

/**
 * Dimensões transcritas das referências Petronas enviadas em 04/11/2026.
 * Eixos X, Y, Z representam largura, profundidade e altura, em milímetros.
 * As quantidades nas gaiolas são histórico de referência, NÃO capacidades Goodpack.
 * Nenhum peso bruto foi fornecido; preenchimento do peso pertence à simulação.
 */
/** BD (baldes) can be stacked only with the same SKU, with at most three units in a vertical column. */
export const MAX_BD_STACK_LAYERS = 3;
export const isPetronasBd = (skuId: string): boolean => skuId.startsWith('bd');

export const PETRONAS_SKUS: PetronasSku[] = [
  { id: 'cx24x1', label: 'CX 24×1 (24 frascos de 1 L)', kind: 'block', dimensions: { width: 476, depth: 357, height: 310 }, color: '#2878cb', cageQuantities: { cage32: 18, cage48: 30, cage114: 24 } },
  { id: 'cx12x1', label: 'CX 12×1 (12 frascos de 1 L)', kind: 'block', dimensions: { width: 352, depth: 232, height: 223 }, color: '#0b9b8b', cageQuantities: { cage32: 30, cage48: 65, cage114: 52 } },
  { id: 'cx4x4', label: 'CX 4×4 (4 frascos de 4 L)', kind: 'block', dimensions: { width: 442, depth: 442, height: 217 }, color: '#b56d22', cageQuantities: { cage90: 20 } },
  { id: 'cx6x4', label: 'CX 6×4 (6 frascos de 4 L)', kind: 'block', dimensions: { width: 448, depth: 326, height: 270 }, color: '#8a60ce', cageQuantities: { cage32: 12, cage48: 24, cage114: 18 } },
  { id: 'cx24x05', label: 'CX 24×0,5 (24 frascos de 0,5 L)', kind: 'block', dimensions: { width: 444, depth: 257, height: 167 }, color: '#c34d80', cageQuantities: { cage32: 24, cage48: 48, cage114: 48 } },
  { id: 'cx36x05', label: 'CX 36×0,5 KG', kind: 'block', dimensions: { width: 472, depth: 352, height: 242 }, color: '#4a83a1', cageQuantities: { cage32: 12, cage48: 24, cage114: 18 } },
  { id: 'bd10kg', label: 'BD 10 KG (tambor)', kind: 'cylinder', dimensions: { width: 270, depth: 270, height: 287 }, color: '#cc7852', sourceNote: 'Ø270 mm informado como diâmetro superior; confirmar diâmetro externo máximo.', cageQuantities: { cage32: 32, cage48: 48, cage114: 48 } },
  { id: 'bd20kg', label: 'BD 20 KG (tambor)', kind: 'cylinder', dimensions: { width: 303, depth: 303, height: 426 }, color: '#7c9270', sourceNote: 'Ø303 mm informado como diâmetro superior; confirmar diâmetro externo máximo.', cageQuantities: { cage32: 12, cage48: 24, cage114: 24 } },
  { id: 'bd20l', label: 'BD 20 L', kind: 'block', dimensions: { width: 398, depth: 272, height: 272 }, color: '#567d44', cageQuantities: { cage32: 26, cage48: 39, cage114: 26 } },
  { id: 'cx24x1kg', label: 'CX 24×1 KG (dimensões pendentes)', kind: 'block', color: '#8c9096', sourceNote: 'SKU presente na tabela de gaiolas, sem dimensões na lista fornecida. Não assumir equivalência a CX 24×1.', cageQuantities: { cage32: 12, cage48: 24, cage114: 18 } },
];
