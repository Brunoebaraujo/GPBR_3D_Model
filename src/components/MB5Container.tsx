import { Edges } from '@react-three/drei';
import { MB5_CONTAINER } from '../data/skus';
import { mmToThreeUnits } from '../utils/unitConversion';

const VolumeWireframe = ({
  dimensions,
  color,
  opacity,
  yOffset,
}: {
  dimensions: typeof MB5_CONTAINER.externalDimensions;
  color: string;
  opacity: number;
  yOffset: number;
}) => (
  <mesh position={[0, mmToThreeUnits(dimensions.height / 2 + yOffset), 0]}>
    <boxGeometry
      args={[
        mmToThreeUnits(dimensions.width),
        mmToThreeUnits(dimensions.height),
        mmToThreeUnits(dimensions.depth),
      ]}
    />
    <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    <Edges color={color} />
  </mesh>
);

export function MB5Container() {
  return (
    <group>
      <VolumeWireframe
        dimensions={MB5_CONTAINER.externalDimensions}
        color="#3d4752"
        opacity={0.08}
        yOffset={0}
      />
      <VolumeWireframe
        dimensions={MB5_CONTAINER.internalDimensions}
        color="#00a878"
        opacity={0.06}
        yOffset={0}
      />
    </group>
  );
}
