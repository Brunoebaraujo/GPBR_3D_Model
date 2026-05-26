import { Edges } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { PackingObject as PackingObjectType } from '../types';
import { mmToThreeUnits, rotationDegreesToRadians } from '../utils/unitConversion';

interface PackingObjectProps {
  object: PackingObjectType;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function PackingObject({ object, isSelected, onSelect }: PackingObjectProps) {
  const { width, depth, height } = object.dimensions;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(object.id);
  };

  return (
    <mesh
      position={[
        mmToThreeUnits(object.position.x),
        mmToThreeUnits(object.position.y),
        mmToThreeUnits(object.position.z),
      ]}
      rotation={rotationDegreesToRadians(object.rotation)}
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      {object.type === 'cylinder' ? (
        <cylinderGeometry
          args={[
            mmToThreeUnits(width / 2),
            mmToThreeUnits(width / 2),
            mmToThreeUnits(height),
            40,
          ]}
        />
      ) : (
        <boxGeometry args={[mmToThreeUnits(width), mmToThreeUnits(height), mmToThreeUnits(depth)]} />
      )}
      <meshStandardMaterial
        color={object.color}
        roughness={0.55}
        metalness={0.04}
        transparent
        opacity={isSelected ? 0.92 : 0.78}
      />
      <Edges color={isSelected ? '#f5c542' : '#20262d'} />
    </mesh>
  );
}
