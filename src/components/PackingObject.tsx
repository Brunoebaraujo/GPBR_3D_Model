import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { forwardRef } from 'react';
import type { Mesh } from 'three';
import type { PackingObject as PackingObjectType } from '../types';
import { mmToThreeUnits, packingPositionToThree, rotationDegreesToRadians } from '../utils/unitConversion';

interface PackingObjectProps {
  object: PackingObjectType;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const BODY_COLOR = '#2f80ed';
const TOP_COLOR = '#16a05d';
const BOTTOM_COLOR = '#e06a2d';
const EDGE_SELECTED_COLOR = '#f5c542';
const EDGE_DEFAULT_COLOR = '#20262d';

export const PackingObject = forwardRef<Mesh, PackingObjectProps>(function PackingObject(
  { object, isSelected, onSelect },
  ref,
) {
  const { width, depth, height } = object.dimensions;
  const opacity = isSelected ? 0.92 : 0.78;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(object.id);
  };

  const materialProps = {
    roughness: 0.55,
    metalness: 0.04,
    transparent: true,
    opacity,
  };

  return (
    <mesh
      ref={ref}
      position={packingPositionToThree(object.position)}
      rotation={rotationDegreesToRadians(object.rotation)}
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      {object.type === 'cylinder' ? (
        <>
          <cylinderGeometry
            args={[
              mmToThreeUnits(width / 2),
              mmToThreeUnits(width / 2),
              mmToThreeUnits(height),
              40,
            ]}
          />
          <meshStandardMaterial attach="material-0" color={BODY_COLOR} {...materialProps} />
          <meshStandardMaterial attach="material-1" color={TOP_COLOR} {...materialProps} />
          <meshStandardMaterial attach="material-2" color={BOTTOM_COLOR} {...materialProps} />
        </>
      ) : (
        <>
          <boxGeometry args={[mmToThreeUnits(width), mmToThreeUnits(height), mmToThreeUnits(depth)]} />
          <meshStandardMaterial attach="material-0" color={BODY_COLOR} {...materialProps} />
          <meshStandardMaterial attach="material-1" color={BODY_COLOR} {...materialProps} />
          <meshStandardMaterial attach="material-2" color={TOP_COLOR} {...materialProps} />
          <meshStandardMaterial attach="material-3" color={BOTTOM_COLOR} {...materialProps} />
          <meshStandardMaterial attach="material-4" color={BODY_COLOR} {...materialProps} />
          <meshStandardMaterial attach="material-5" color={BODY_COLOR} {...materialProps} />
        </>
      )}
      <Edges color={isSelected ? EDGE_SELECTED_COLOR : EDGE_DEFAULT_COLOR} />
    </mesh>
  );
});
