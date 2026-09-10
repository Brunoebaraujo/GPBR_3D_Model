import { faceColor, getFaceFromMaterial } from '../utils/productGeometry';
import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';
import type { Group } from 'three';
import type { PackingObject as PackingObjectType, TopFace } from '../types';
import { mmToThreeUnits, packingPositionToThree, rotationDegreesToRadians } from '../utils/unitConversion';

interface PackingObjectProps {
  object: PackingObjectType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPickTop?: (face: TopFace) => void;
}

const EDGE_SELECTED_COLOR = '#f5c542';
const EDGE_DEFAULT_COLOR = '#20262d';

export const PackingObject = forwardRef<Group, PackingObjectProps>(function PackingObject(
  { object, isSelected, onSelect, onPickTop },
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
    if (onPickTop && event.face) {
      const face = getFaceFromMaterial(object, event.face.materialIndex);
      if (face) onPickTop(face);
    }
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
            <meshStandardMaterial attach="material-0" color={faceColor(object, 0)} {...materialProps} />
            <meshStandardMaterial attach="material-1" color={faceColor(object, 1)} {...materialProps} />
            <meshStandardMaterial attach="material-2" color={faceColor(object, 2)} {...materialProps} />
          </>
        ) : (
          <>
            <boxGeometry args={[mmToThreeUnits(width), mmToThreeUnits(height), mmToThreeUnits(depth)]} />
            <meshStandardMaterial attach="material-0" color={faceColor(object, 0)} {...materialProps} />
            <meshStandardMaterial attach="material-1" color={faceColor(object, 1)} {...materialProps} />
            <meshStandardMaterial attach="material-2" color={faceColor(object, 2)} {...materialProps} />
            <meshStandardMaterial attach="material-3" color={faceColor(object, 3)} {...materialProps} />
            <meshStandardMaterial attach="material-4" color={faceColor(object, 4)} {...materialProps} />
            <meshStandardMaterial attach="material-5" color={faceColor(object, 5)} {...materialProps} />
          </>
        )}
        <Edges color={isSelected ? EDGE_SELECTED_COLOR : EDGE_DEFAULT_COLOR} />
      </mesh>
    </group>
  );
});
