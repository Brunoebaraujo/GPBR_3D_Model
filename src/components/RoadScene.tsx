import { Canvas, useThree } from "@react-three/fiber";
import {
  Edges,
  Grid,
  Html,
  OrbitControls,
  PerspectiveCamera,
  TransformControls,
} from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  footprint,
  cargoBodies,
  bodyOffset,
  couplingGap,
  sceneLength,
  moveRoadUnits,
  validateRoad,
  type RoadState,
  type RoadUnit,
} from "../utils/roadLoading";

export type RoadCamera = "perspective" | "top" | "side" | "rear";
interface Props {
  state: RoadState;
  selected: string[];
  camera: RoadCamera;
  opacity: number;
  roof: boolean;
  sides: boolean;
  snap: boolean;
  onSelect: (id: string, multiple: boolean) => void;
  onMove: (units: RoadUnit[]) => boolean;
  onDragMessage: (message: string) => void;
}
function Box({
  size,
  position,
  color,
  opacity = 1,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  opacity?: number;
}) {
  return (
    <mesh position={position} raycast={() => undefined}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
      />
      <Edges color="#516574" />
    </mesh>
  );
}
function Vehicle({
  state,
  opacity,
  roof,
  sides,
}: Pick<Props, "state" | "opacity" | "roof" | "sides">) {
  const v = state.vehicle,
    bodies = cargoBodies(v),
    length = sceneLength(v) / 1000,
    firstWidth = v.width / 1000;
  return (
    <group>
      {bodies.map((body, index) => {
        const w = body.width / 1000,
          h = body.height / 1000,
          l = body.length / 1000;
        return (
          <group key={index} position={[0, 0, bodyOffset(v, index) / 1000]}>
            <Box size={[w, 0.08, l]} position={[0, -0.05, 0]} color="#63788a" />
            {sides && (
              <>
                <Box
                  size={[0.015, h, l]}
                  position={[-w / 2, h / 2, 0]}
                  color="#88bbcb"
                  opacity={opacity}
                />
                <Box
                  size={[0.015, h, l]}
                  position={[w / 2, h / 2, 0]}
                  color="#88bbcb"
                  opacity={opacity}
                />
              </>
            )}
            {roof && (
              <Box
                size={[w, 0.015, l]}
                position={[0, h, 0]}
                color="#88bbcb"
                opacity={opacity}
              />
            )}
            <Box
              size={[w, h, 0.015]}
              position={[0, h / 2, -l / 2]}
              color="#88bbcb"
              opacity={opacity}
            />
            <Box
              size={[w, h, 0.015]}
              position={[0, h / 2, l / 2]}
              color="#88bbcb"
              opacity={opacity}
            />
            {[-w / 2, w / 2].map((x) =>
              [l / 2 - 0.7, l / 2 - 1.4].map((z) => (
                <mesh
                  key={`${x}-${z}`}
                  position={[x, -0.32, z]}
                  rotation={[0, 0, Math.PI / 2]}
                  raycast={() => undefined}
                >
                  <cylinderGeometry args={[0.32, 0.32, 0.22, 16]} />
                  <meshStandardMaterial color="#26313c" />
                </mesh>
              )),
            )}
            {bodies.length > 1 && (
              <Html position={[w / 2 + 0.55, h + 0.2, 0]} center>
                <span className="road-label">COMPARTIMENTO {index + 1}</span>
              </Html>
            )}
          </group>
        );
      })}
      {v.secondBody && (
        <Box
          size={[0.3, 0.15, couplingGap(v) / 1000]}
          position={[0, -0.2, (v.length - v.secondBody.length) / 2000]}
          color="#486171"
        />
      )}
      <Box
        size={[firstWidth * 0.93, 1.65, 1.65]}
        position={[0, 0.6, -length / 2 - 1.25]}
        color="#176a90"
      />
      <Box
        size={[firstWidth * 0.78, 0.55, 0.03]}
        position={[0, 1.05, -length / 2 - 2.09]}
        color="#15344a"
      />
      {[-firstWidth / 2, firstWidth / 2].map((x) => (
        <mesh
          key={x}
          position={[x, -0.32, -length / 2 - 1.4]}
          rotation={[0, 0, Math.PI / 2]}
          raycast={() => undefined}
        >
          <cylinderGeometry args={[0.32, 0.32, 0.22, 16]} />
          <meshStandardMaterial color="#26313c" />
        </mesh>
      ))}
      <Html position={[0, 2.05, -length / 2 - 1.2]} center>
        <span className="road-label front-label">FRENTE</span>
      </Html>
      <Html position={[0, 0, length / 2 + 0.4]} center>
        <span className="road-label">TRASEIRA</span>
      </Html>
    </group>
  );
}
function UnitMesh({
  unit,
  index,
  selected,
  invalid,
  onSelect,
  offset = [0, 0, 0],
  worldOffset = 0,
}: {
  unit: RoadUnit;
  index: number;
  selected: boolean;
  invalid: boolean;
  onSelect: Props["onSelect"];
  offset?: number[];
  worldOffset?: number;
}) {
  const d = footprint(unit),
    w = d.width / 1000,
    h = d.height / 1000,
    l = d.length / 1000;
  const color = invalid
    ? "#e24b4b"
    : unit.model === "MB5"
      ? "#2787aa"
      : "#17a781";
  return (
    <group
      position={[
        unit.x / 1000 - offset[0],
        (unit.z + d.height / 2) / 1000 - offset[1],
        (unit.y + worldOffset) / 1000 - offset[2],
      ]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(unit.id, e.shiftKey || e.ctrlKey || e.metaKey);
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w - 0.025, h - 0.07, l - 0.025]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.25} />
        <Edges
          color={selected ? "#ffcc46" : "#24505d"}
          lineWidth={selected ? 2 : 1}
        />
      </mesh>
      {[-w / 2 + 0.025, w / 2 - 0.025].map((x) =>
        [-l / 2 + 0.025, l / 2 - 0.025].map((z) => (
          <Box
            key={`${x}-${z}`}
            size={[0.045, h, 0.045]}
            position={[x, 0, z]}
            color={invalid ? "#ee6262" : "#c2cbd0"}
          />
        )),
      )}
      <Box
        size={[w, 0.07, l]}
        position={[0, -h / 2 + 0.035, 0]}
        color="#aab9c0"
      />
      {unit.model === "MB6" && (
        <Box
          size={[w, 0.025, l]}
          position={[0, h / 2 - 0.012, 0]}
          color="#c2cbd0"
        />
      )}
      <Html
        position={[0, h / 2 + 0.03, 0]}
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none" }}
      >
        <span className={`road-label ${selected ? "selected-label" : ""}`}>
          {unit.model} · {index + 1}
          {unit.locked ? " 🔒" : ""}
        </span>
      </Html>
    </group>
  );
}
function CameraRig({ view, length }: { view: RoadCamera; length: number }) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;
    const l = length / 1000,
      distance = Math.max(7, l * 1.1);
    const poses: Record<RoadCamera, [number, number, number]> = {
      perspective: [distance * 0.8, distance * 0.65, distance * 0.85],
      top: [0, ((l + 3) / (2 * Math.tan(Math.PI / 8))) * 1.15 + 1, -0.999],
      side: [
        Math.max(
          distance * 1.2,
          ((l + 3) / ((2 * Math.tan(Math.PI / 8) * size.width) / size.height)) *
            1.15,
        ),
        1.3,
        -1,
      ],
      rear: [0, 1.8, distance],
    };
    camera.position.set(...poses[view]);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 1, -1);
    controls.current?.target.set(0, 1, -1);
    controls.current?.update();
  }, [camera, view, length, size.width, size.height]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minDistance={2}
      maxDistance={120}
    />
  );
}
function SceneContent(props: Props) {
  const { state, selected, onSelect, onMove, snap, onDragMessage } = props;
  const selectionGroup = useRef<Group>(null!);
  const [dragUnits, setDragUnits] = useState<RoadUnit[] | null>(null);
  const [reset, setReset] = useState(0);
  const pending = useRef<RoadUnit[] | null>(null);
  const dragging = useRef(false);
  const moving = state.units.filter(
    (u) => selected.includes(u.id) && !u.locked,
  );
  const pivot: [number, number, number] = moving.length
    ? [
        moving[0].x / 1000,
        moving[0].z / 1000,
        (moving[0].y + bodyOffset(state.vehicle, moving[0].compartment ?? 0)) /
          1000,
      ]
    : [0, 0, 0];
  const live = dragUnits ?? state.units,
    result = validateRoad({ ...state, units: live });
  const begin = () => {
    dragging.current = true;
    pending.current = null;
  };
  const update = () => {
    if (!dragging.current || !selectionGroup.current) return;
    const p = selectionGroup.current.position;
    const next = moveRoadUnits(
      state,
      selected,
      {
        x: (p.x - pivot[0]) * 1000,
        y: (p.z - pivot[2]) * 1000,
        z: (p.y - pivot[1]) * 1000,
      },
      snap,
    );
    pending.current = next;
    setDragUnits(next);
    const first = next.find((u) => u.id === moving[0]?.id);
    if (first)
      selectionGroup.current.position.set(
        first.x / 1000,
        first.z / 1000,
        (first.y + bodyOffset(state.vehicle, first.compartment ?? 0)) / 1000,
      );
    const validation = validateRoad({ ...state, units: next });
    onDragMessage(
      validation.errors[0] ?? "Posição válida. Solte para confirmar.",
    );
  };
  const finish = () => {
    dragging.current = false;
    if (pending.current) onMove(pending.current);
    pending.current = null;
    setDragUnits(null);
    setReset((n) => n + 1);
  };
  const transformKey = `${reset}-${moving.map((u) => `${u.id},${u.x},${u.y},${u.z},${u.turned}`).join(";")}`;
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[8, 12, 5]} intensity={2} castShadow />
      <Vehicle {...props} />
      {state.units
        .filter((u) => !moving.some((m) => m.id === u.id))
        .map((u) => (
          <UnitMesh
            key={u.id}
            unit={u}
            worldOffset={bodyOffset(state.vehicle, u.compartment ?? 0)}
            index={state.units.indexOf(u)}
            selected={selected.includes(u.id)}
            invalid={result.invalidIds.has(u.id)}
            onSelect={onSelect}
          />
        ))}
      {moving.length > 0 && (
        <group key={transformKey}>
          <group ref={selectionGroup} position={pivot}>
            {moving.map((u) => (
              <UnitMesh
                key={u.id}
                unit={u}
                worldOffset={bodyOffset(state.vehicle, u.compartment ?? 0)}
                index={state.units.indexOf(u)}
                selected
                invalid={result.invalidIds.has(u.id)}
                onSelect={onSelect}
                offset={pivot}
              />
            ))}
          </group>
          <TransformControls
            object={selectionGroup}
            mode="translate"
            size={0.85}
            onMouseDown={begin}
            onObjectChange={update}
            onMouseUp={finish}
          />
        </group>
      )}
      <Grid
        position={[0, -0.1, 0]}
        args={[30, 30]}
        cellSize={1}
        sectionSize={5}
        fadeDistance={35}
        cellColor="#c5d5de"
        sectionColor="#9eb5c3"
      />
      <CameraRig view={props.camera} length={sceneLength(state.vehicle)} />
    </>
  );
}
export function RoadScene(props: Props) {
  return (
    <Canvas shadows>
      <PerspectiveCamera
        makeDefault
        position={[12, 10, 14]}
        fov={45}
        near={0.1}
        far={250}
      />
      <color attach="background" args={["#eaf1f5"]} />
      <SceneContent {...props} />
    </Canvas>
  );
}
