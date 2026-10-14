import { Edges } from "@react-three/drei";
import type { ContainerSpec } from "../types";
import { mmToThreeUnits } from "../utils/unitConversion";

const VolumeWireframe = ({
  dimensions,
  color,
  opacity,
  yOffset,
}: {
  dimensions: ContainerSpec["externalDimensions"];
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
    <meshBasicMaterial
      color={color}
      transparent
      opacity={opacity}
      depthWrite={false}
    />
    <Edges color={color} />
  </mesh>
);

export function GoodpackContainer({ container }: { container: ContainerSpec }) {
  return (
    <group>
      <VolumeWireframe
        dimensions={container.externalDimensions}
        color="#3d4752"
        opacity={0.08}
        yOffset={0}
      />
      <VolumeWireframe
        dimensions={container.internalDimensions}
        color="#00a878"
        opacity={0.06}
        yOffset={0}
      />
    </group>
  );
}
