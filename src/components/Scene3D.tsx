import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { PackingObject } from '../types';
import { MB5Container } from './MB5Container';
import { PackingObject as PackingObjectMesh } from './PackingObject';

interface Scene3DProps {
  objects: PackingObject[];
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
}

export function Scene3D({ objects, selectedObjectId, onSelectObject }: Scene3DProps) {
  return (
    <div className="scene-shell">
      <Canvas shadows onPointerMissed={() => onSelectObject(null)}>
        <PerspectiveCamera makeDefault position={[1.9, 1.7, 2.4]} fov={48} />
        <color attach="background" args={['#eef2f5']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 5, 4]} intensity={1.3} castShadow />
        <MB5Container />
        {objects.map((object) => (
          <PackingObjectMesh
            key={object.id}
            object={object}
            isSelected={object.id === selectedObjectId}
            onSelect={onSelectObject}
          />
        ))}
        <Grid
          args={[5, 5]}
          cellSize={0.25}
          cellThickness={0.5}
          sectionSize={1}
          sectionThickness={1}
          fadeDistance={8}
          fadeStrength={1}
          infiniteGrid
        />
        <OrbitControls enablePan enableZoom makeDefault />
      </Canvas>
    </div>
  );
}
