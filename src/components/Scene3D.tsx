import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera, TransformControls } from '@react-three/drei';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mesh } from 'three';
import type { PackingObject, TransformMode } from '../types';
import { MB5Container } from './MB5Container';
import { PackingObject as PackingObjectMesh } from './PackingObject';
import {
  packingPositionToThree,
  threePositionToPacking,
  threeRotationToPackingDegrees,
  threeUnitsToMm,
} from '../utils/unitConversion';

interface Scene3DProps {
  objects: PackingObject[];
  selectedObjectId: string | null;
  transformMode: TransformMode;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (object: PackingObject) => void;
}

interface ControlledPackingObjectProps {
  object: PackingObject;
  isSelected: boolean;
  transformMode: TransformMode;
  onSelectObject: (id: string) => void;
  onUpdateObject: (object: PackingObject) => void;
  onDraggingChange: (isDragging: boolean) => void;
}

function ControlledPackingObject({
  object,
  isSelected,
  transformMode,
  onSelectObject,
  onUpdateObject,
  onDraggingChange,
}: ControlledPackingObjectProps) {
  const objectRef = useRef<Mesh>(null);
  const transformControlsRef = useRef<any>(null);

  const handleDraggingChanged = useCallback(
    (event: { value: boolean }) => {
      onDraggingChange(event.value);
    },
    [onDraggingChange],
  );

  useEffect(() => {
    if (!objectRef.current) {
      return;
    }

    const [threeX, threeY, threeZ] = packingPositionToThree(object.position);
    const { x, y, z } = objectRef.current.position;
    if (
      Math.abs(threeUnitsToMm(x - threeX)) > 0.5 ||
      Math.abs(threeUnitsToMm(y - threeY)) > 0.5 ||
      Math.abs(threeUnitsToMm(z - threeZ)) > 0.5
    ) {
      objectRef.current.position.set(threeX, threeY, threeZ);
    }
  }, [object.position.x, object.position.y, object.position.z]);

  useEffect(() => {
    const controls = transformControlsRef.current;

    if (!controls) {
      return;
    }

    controls.addEventListener('dragging-changed', handleDraggingChanged);

    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [handleDraggingChanged]);

  const syncTransform = () => {
    if (!objectRef.current) {
      return;
    }

    onUpdateObject({
      ...object,
      position: threePositionToPacking(objectRef.current.position),
      rotation: threeRotationToPackingDegrees(objectRef.current.rotation),
    });
  };

  const objectElement = (
    <PackingObjectMesh
      ref={objectRef}
      object={object}
      isSelected={isSelected}
      onSelect={onSelectObject}
    />
  );

  if (!isSelected) {
    return objectElement;
  }

  return (
    <TransformControls ref={transformControlsRef} mode={transformMode} onObjectChange={syncTransform}>
      {objectElement}
    </TransformControls>
  );
}

export function Scene3D({
  objects,
  selectedObjectId,
  transformMode,
  onSelectObject,
  onUpdateObject,
}: Scene3DProps) {
  const [isTransformDragging, setIsTransformDragging] = useState(false);

  return (
    <div className="scene-shell">
      <Canvas shadows onPointerMissed={() => onSelectObject(null)}>
        <PerspectiveCamera makeDefault position={[1.9, 1.7, 2.4]} fov={48} />
        <color attach="background" args={['#eef2f5']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 5, 4]} intensity={1.3} castShadow />
        <MB5Container />
        {objects.map((object) => (
          <ControlledPackingObject
            key={object.id}
            object={object}
            isSelected={object.id === selectedObjectId}
            transformMode={transformMode}
            onSelectObject={onSelectObject}
            onUpdateObject={onUpdateObject}
            onDraggingChange={setIsTransformDragging}
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
        <OrbitControls enablePan enableZoom enabled={!isTransformDragging} makeDefault />
      </Canvas>
    </div>
  );
}
