import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';
import type { Group } from 'three';
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

export const PackingObject = forwardRef<Group, PackingObjectProps>(function PackingObject(
  { object, isSelected, onSelect },
  forwardedRef,
) {
  const groupRef = useRef<Group | null>(null);
  const { width, depth, height } = object.dimensions;
  const opacity = isSelected ? 0.92 : 0.78;

  const setGroupRef = useCallback(
    (group: Group | null) => {
      groupRef.current = group;

      if (typeof forwardedRef === 'function') {
        forwardedRef(group);
      } else if (forwardedRef) {
        forwardedRef.current = group;
      }
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const [x, y, z] = packingPositionToThree(object.position);
    const [rotationX, rotationY, rotationZ] = rotationDegreesToRadians(object.rotation);

    group.position.set(x, y, z);
    group.rotation.set(rotationX, rotationY, rotationZ, 'XYZ');
    group.updateMatrixWorld(true);
  }, [
    object.position.x,
    object.position.y,
    object.position.z,
    object.rotation.x,
    object.rotation.y,
    object.rotation.z,
  ]);

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
    <group ref={setGroupRef} onClick={handleClick}>
      <mesh castShadow receiveShadow>
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
    </group>
  );
});
