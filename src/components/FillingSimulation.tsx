import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, DoubleSide, MathUtils, Vector3, type Group } from 'three';
import { MB6, type Action, type Lab } from '../utils/mb6Assembly';
import { MB6_CONTAINER } from '../data/skus';
import { WAREHOUSE } from '../utils/assemblyWarehouse';
import { PanelText, TouchButton } from './TouchButton';

const interior = MB6_CONTAINER.internalDimensions;
const floor = MB6.h - interior.height / 1000;
const mouth = MB6.h - .015;
const parked = mouth + .32;
const nozzleHeight = .14;
const sides = 64;
const rings = 8;

export type FillingGrab = {
  move: (position: Vector3) => void;
  release: () => void;
};

function linerGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(sides * rings * 3), 3));
  const indices = [];
  for (let ring = 0; ring < rings - 1; ring++) {
    for (let i = 0; i < sides; i++) {
      const a = ring * sides + i;
      const b = ring * sides + (i + 1) % sides;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  geometry.setIndex(indices);
  return geometry;
}

function shapeLiner(geometry: BufferGeometry, fill: number, film: boolean) {
  const y = MathUtils.lerp(floor + .035, mouth - .10, fill);
  const width = MathUtils.lerp(.32, interior.width / 2000 - .011, fill);
  const depth = MathUtils.lerp(.34, interior.depth / 2000 - .011, fill);
  const shoulder = film ? MathUtils.lerp(floor + .06, y + .01, fill) : y;
  const profile = [
    [0, floor], [.88, floor], [1, floor + (y - floor) * .23],
    [1, shoulder - .008], [.94, shoulder], [.54, shoulder + (film ? .04 * fill : .006)],
    [film ? .054 / width : .12, film ? mouth - .025 : y + .012],
    [0, film ? mouth - .025 : y + .012],
  ];
  const positions = geometry.getAttribute('position');
  const exponent = MathUtils.lerp(.72, .20, fill);
  for (let i = 0; i < sides; i++) {
    const angle = i * Math.PI * 2 / sides;
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = Math.sign(c) * Math.abs(c) ** exponent;
    const z = Math.sign(s) * Math.abs(s) ** exponent;
    for (let ring = 0; ring < rings; ring++) {
      const [radius, height] = profile[ring];
      const wrinkle = film && ring > 0 && ring < 7 ? Math.sin(angle * 13 + ring * 1.2) * .008 * (1 - .7 * fill) : 0;
      positions.setXYZ(ring * sides + i, x * radius * (width + wrinkle), height + wrinkle, z * radius * (depth + wrinkle));
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

const ignoreRay = () => undefined;

function Cap() {
  return <>
    <mesh><cylinderGeometry args={[.053,.056,.027,32]}/><meshStandardMaterial color="#e3ebed" roughness={.38}/></mesh>
    {Array.from({ length: 24 }, (_, i) => {
      const angle = i * Math.PI / 12;
      return <mesh key={i} position={[Math.sin(angle)*.054,0,Math.cos(angle)*.054]} rotation={[0,angle,0]}>
        <boxGeometry args={[.004,.022,.003]}/><meshStandardMaterial color="#c1d2d9"/>
      </mesh>;
    })}
  </>;
}

export function FillingSimulation({ lab, dispatch, walking }: { lab: Lab; dispatch: (action: Action) => void; walking: boolean }) {
  const { gl, camera } = useThree();
  const stage = lab.filling;
  const { x, z } = lab.boxes[0].pose;
  const nozzle = useRef<Group>(null);
  const cap = useRef<Group>(null);
  const capOffset = useMemo(() => new Vector3(), []);
  const cable = useRef<Group>(null);
  const travel = useRef(WAREHOUSE.height - .25);
  const volume = useRef(0);
  const requested = useRef(false);
  const currentStage = useRef(stage);
  currentStage.current = stage;
  const lastShape = useRef(-1);
  const film = useMemo(() => linerGeometry(), []);
  const puree = useMemo(() => linerGeometry(), []);
  useEffect(() => () => { film.dispose(); puree.dispose(); }, [film, puree]);
  useEffect(() => { requested.current = false; }, [stage]);

  const advance = () => {
    if (currentStage.current !== stage || requested.current) return;
    requested.current = true;
    dispatch({ type: 'advance-filling' });
  };
  const target = new Vector3(x, mouth + .038, z);
  const grabNozzle = (start: Vector3): FillingGrab => ({
    move: position => {
      if (currentStage.current !== stage) return;
      const dy = position.y - start.y;
      if (stage === 'connect') {
        travel.current = MathUtils.clamp(parked + dy, mouth + .038, parked + .10);
        if (travel.current <= mouth + .058) advance();
      } else if (stage === 'full') {
        travel.current = MathUtils.clamp(mouth + .038 + dy, mouth + .038, parked);
        if (travel.current >= mouth + .22) advance();
      }
    },
    release: () => {
      if (currentStage.current === stage && !requested.current) travel.current = stage === 'connect' ? parked : mouth + .038;
    },
  });
  const grabCap = (): FillingGrab => ({
    move: position => { if (position.distanceTo(target) <= .10) advance(); },
    release: () => undefined,
  });
  const canGrab = stage === 'connect' || stage === 'full';
  const visible = !!stage && stage !== 'assembly';

  useFrame((_, delta) => {
    if (!visible) { travel.current = WAREHOUSE.height - .25; volume.current = 0; return; }
    const dt = Math.min(delta, .05);
    if (stage === 'lowering') {
      travel.current = Math.max(parked, travel.current - dt * 3);
      if (travel.current === parked) advance();
    }
    if (stage === 'filling') {
      travel.current = mouth + .038;
      volume.current = Math.min(1, volume.current + dt / 7);
      if (volume.current === 1) advance();
    }
    if (stage === 'cap' && !gl.xr.isPresenting && cap.current) {
      cap.current.visible = true;
      cap.current.position.copy(camera.localToWorld(capOffset.set(.27, -.20, -.7)));
      cap.current.quaternion.copy(camera.quaternion);
    }
    if (stage === 'cap') travel.current = mouth - nozzleHeight - .02;
    if (stage === 'sealed') travel.current = Math.min(WAREHOUSE.height - .25, travel.current + dt * 3);
    if (nozzle.current) nozzle.current.position.y = travel.current;
    if (cable.current) {
      cable.current.position.y = travel.current + nozzleHeight - .015;
      cable.current.scale.y = Math.max(.02, WAREHOUSE.height - cable.current.position.y);
    }
    if (lastShape.current !== volume.current) {
      shapeLiner(film, volume.current, true);
      if (volume.current > 0) shapeLiner(puree, volume.current, false);
      lastShape.current = volume.current;
    }
  });

  return <>
    <group position={[.25,0,6.5]} rotation={[0,Math.PI,0]}>
      <mesh position={[0,.045,0]}><boxGeometry args={[.74,.09,.52]}/><meshStandardMaterial color="#142532" metalness={.45}/></mesh>
      <mesh position={[0,.56,-.07]}><boxGeometry args={[.28,1.05,.27]}/><meshStandardMaterial color="#294656" metalness={.45}/></mesh>
      <group position={[0,1.14,0]} rotation={[-.24,0,0]}>
        <mesh position={[0,0,-.065]}><boxGeometry args={[.76,.44,.13]}/><meshStandardMaterial color="#203947" metalness={.45}/></mesh>
        <PanelText text="ENVASE MB6" width={.65} height={.08} position={[0,.125,.006]}/>
        <TouchButton walkable text={stage === 'sealed' ? 'SIMULAR NOVAMENTE' : 'SIMULAR ENVASE'} width={.64} position={[0,-.04,.04]}
          disabled={!!stage && stage !== 'sealed'} onPress={() => dispatch({ type:'start-filling' })}/>
      </group>
    </group>
    {stage && <group position={[x,1.75,z-.8]}>
      <PanelText text={lab.message} width={1.55} height={.13}/>
    </group>}
    {visible && <group position={[x,0,z]}>
      <mesh geometry={film} frustumCulled={false} raycast={ignoreRay} renderOrder={2}>
        <meshPhysicalMaterial color="#e1eef3" transparent opacity={.31} roughness={.24} metalness={.08} clearcoat={1} depthWrite={false} side={DoubleSide}/>
      </mesh>
      {stage !== 'lowering' && stage !== 'connect' && <mesh geometry={puree} frustumCulled={false} raycast={ignoreRay}>
        <meshStandardMaterial color="#ab2517" roughness={.43} side={DoubleSide}/>
      </mesh>}
      <group position={[0,mouth,0]} userData={stage === 'cap' ? {
        desktopGesture: { hint:'Mire no bocal e solte o botão esquerdo para colocar a tampa.', hover:()=>undefined, finish:advance },
      } : undefined} onClick={event => {
        if (stage !== 'cap' || walking || gl.xr.isPresenting) return;
        event.stopPropagation();
        advance();
      }}>
        <mesh position={[0,-.016,0]}><cylinderGeometry args={[.068,.074,.02,36]}/><meshStandardMaterial color="#007fcc" roughness={.33}/></mesh>
        <mesh><cylinderGeometry args={[.045,.05,.04,36,1,true]}/><meshStandardMaterial color="#008bdc" side={DoubleSide}/></mesh>
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,.021,0]}><ringGeometry args={[.034,.045,36]}/><meshStandardMaterial color="#45adfc" side={DoubleSide}/></mesh>
        {stage === 'sealed' && <group position={[0,.034,0]}><Cap/></group>}
      </group>
      <group ref={cable}>
        <mesh position={[0,.5,0]} raycast={ignoreRay}><cylinderGeometry args={[.028,.028,1,20]}/><meshStandardMaterial color="#34414a" roughness={.49} metalness={.45}/></mesh>
      </group>
      <group ref={nozzle} position={[0,WAREHOUSE.height-.25,0]} userData={canGrab ? {
        xrFillingGrab: grabNozzle,
        desktopGesture: {
          hint:stage === 'connect' ? 'Segure o terminal e mova o mouse para baixo.' : 'Segure o terminal e mova o mouse para cima.',
          hover:()=>undefined,
          finish:(_dx: number, dy: number) => { if (stage === 'connect' ? dy > 12 : dy < -12) advance(); },
        },
      } : undefined} onClick={event => {
        if (!canGrab || walking || gl.xr.isPresenting) return;
        event.stopPropagation();
        advance();
      }}>
        <mesh position={[0,.07,0]}><cylinderGeometry args={[.034,.032,nozzleHeight,32]}/><meshStandardMaterial color="#8a9ca4" metalness={.68} roughness={.26}/></mesh>
        {[.013,.041,.075,.108,.135].map(y => <mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}>
          <torusGeometry args={[.034,.006,8,24]}/><meshStandardMaterial color="#c6d3dd" metalness={.52} roughness={.28}/>
        </mesh>)}
      </group>
    </group>}
    {stage === 'cap' && <group name="mb6-filling-hand-cap" ref={cap} visible={false} userData={{ xrFillingGrab: grabCap, xrIgnoreRay: true }}><Cap/></group>}
  </>;
}
