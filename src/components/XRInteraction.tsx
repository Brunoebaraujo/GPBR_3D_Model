import { touchButton, type TouchState } from '../utils/xrTouch';
import { constrainCrates, explorationStart, constrainExploration, type Exploration } from '../utils/xrNavigation';
import { controllerHand } from './controllerHand';
import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, SphereGeometry, Group, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Quaternion, Raycaster, Vector3, WebGLRenderer, Euler } from 'three';
import { wallGrabPoint, supportedPose, captureStackPose, reduceLab, type Action, type Lab, type Pose } from '../utils/mb6Assembly';
import { boxGrabCorner, canGrabBox, canOperateLever, rayEndpoint, rayGrabbedPose, leverMotion, navigationInput, navigateRig, gripHeld, wallPullAngle, wallPullComplete, type LeverPhase, type Point3 } from '../utils/xrInteraction';

type Props = { exploration?: Exploration; lab: Lab; dispatch: (action: Action) => void; onRenderer: (renderer: WebGLRenderer | null) => void; onPresenting: (value: boolean) => void; onHint: (text: string) => void; children: ReactNode };
type LeverTarget = { boxId: number; index: number; direction: number };
type Target = { object: Object3D; boxId?: number; lever?: LeverTarget; activate?: () => void; panel: boolean; wall?: { boxId: number; index: number }; boxObject?: Object3D; hit: Vector3 };
type Hand = { source: XRInputSource | null; down: boolean; target: Target | null; anchor: Vector3; phase: LeverPhase; slideDirection: number; tracked: boolean; wallStart: number; radius: number };
type Grab = { id: number; object: Object3D; origin: Pose; start: [Point3, Point3]; candidate: Pose; distances: [number, number]; anchors: [Vector3, Vector3] };

// The viewer and controllers share a rig; the clipboard follows the left grip while held.
export function XRInteraction({ lab, dispatch, onRenderer, onPresenting, onHint, children, exploration }: Props) {
  const { gl, scene, camera } = useThree();
  const latest = useRef({ lab, dispatch, onHint, exploration }); latest.current = { lab, dispatch, onHint, exploration };
  const board = useRef<Group>(null);
  const feedback = useRef<() => void>(() => undefined);
  const supports = useRef(new Map<number, number | null>());
  useEffect(() => {
    if (lab.boxes.some(b => b.support !== null && supports.current.get(b.id) !== b.support)) feedback.current();
    supports.current = new Map(lab.boxes.map(b => [b.id, b.support]));
  }, [lab]);
  const tick = useRef<(dt: number, frame?: XRFrame) => void>(() => undefined);
  useFrame((_, dt, frame) => tick.current(dt, frame));
  useEffect(() => {
    gl.xr.enabled = true; gl.xr.setReferenceSpaceType('local-floor'); onRenderer(gl);
    const rig = new Group(); rig.position.z = 3; scene.add(rig);
    const originalParent = camera.parent;
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera instanceof PerspectiveCamera ? camera.fov : 48 };
    const touchStates=new Map<Object3D,TouchState>();
    const ray = new Raycaster(); ray.far = 5;
    let grab: Grab | null = null, active = false, message = '';
    let explorationKey = '';
    const resetExploration = () => {
      const config = latest.current.exploration;
      if (!config) return;
      const key = `${config.key}:${config.revision}:${config.mode}`;
      if (key === explorationKey) return;
      clear(true); explorationKey = key;
      const p = explorationStart(config); rig.position.set(p.x, p.y, p.z); rig.rotation.set(0, p.yaw, 0);
      menuIndex = -1;
    };
    let audio: AudioContext | null = null, menuIndex = -1, menuCooldown = 0;
    let focused: Object3D | null = null;
    const projectedHands = [controllerHand(), controllerHand()];
    projectedHands.forEach(hand => { hand.root.visible=false; scene.add(hand.root); });
    const hoveredLevers = new Set<Object3D>();
    const clearHover = () => { hoveredLevers.forEach(object => { object.userData.xrHovered = false; }); hoveredLevers.clear(); };
    const restoreWall = (h: Hand) => { if (h.target?.wall) h.target.object.userData.xrHeld = false; };
    const actions = () => { const result: Object3D[] = []; board.current?.traverse(o => { if (typeof o.userData.activate === 'function') result.push(o); }); return result; };
    const hint = (text: string) => { if (text !== message) { message = text; latest.current.onHint(text); } };
    const send = (action: Action) => {
      const next = reduceLab(latest.current.lab, action);
      latest.current.lab = next; latest.current.dispatch(action); return next;
    };
    const applyPose = (object: Object3D, p: Pose) => { object.position.set(p.x, p.y, p.z); object.rotation.set(0, p.yaw, 0); object.updateMatrixWorld(true); };
    const clear = (cancel: boolean) => {
      touchStates.clear();
      scene.traverse(o=>{if(o.userData.xrTouch)o.userData.pressed=false;});
      clearHover();
      if (grab) {
        const held = grab; grab = null;
        beams.forEach(beam => { beam.marker.visible=false; beam.beam.scale.z=1; beam.beam.position.z=-2; });
        if (!cancel) { send({ type: 'select', id: held.id }); const result = send({ type: 'drop', pose: held.candidate }); hint(result.message); }
        const box = latest.current.lab.boxes.find(b => b.id === held.id);
        applyPose(held.object, box?.pose ?? held.origin);
      }
      hands.forEach(h => { restoreWall(h); h.down = false; h.target = null; });
    };
    const hands: Hand[] = [0, 1].map(() => ({ source: null, down: false, target: null, anchor: new Vector3(), phase: 'lift', slideDirection: 1, tracked: false, wallStart: 0, radius: .5 }));
    feedback.current = () => {
      if (!active) return;
      if (audio?.state === 'running') {
        const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
        oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(900, now); oscillator.frequency.exponentialRampToValueAtTime(180, now + .07);
        gain.gain.setValueAtTime(.12, now); gain.gain.exponentialRampToValueAtTime(.001, now + .08);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(now); oscillator.stop(now + .09);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
      hands.forEach(h => {
        const actuators = (h.source?.gamepad as unknown as { hapticActuators?: Array<{ pulse: (strength: number, duration: number) => Promise<unknown> }> } | undefined)?.hapticActuators;
        actuators?.forEach(a => { try { void a.pulse(.6, 90).catch(() => undefined); } catch { /* optional device feedback */ } });
      });
    };
    const controllers = [0, 1].map(i => gl.xr.getController(i));
    const grips = [0, 1].map(i => gl.xr.getControllerGrip(i));
    const models = grips.map(grip => { const hand=controllerHand(); grip.add(hand.root); return hand; });
    const rayPose = (i: number) => {
      controllers[i].updateWorldMatrix(true, false);
      return { origin: controllers[i].getWorldPosition(new Vector3()), direction: new Vector3(0,0,-1).applyQuaternion(controllers[i].getWorldQuaternion(new Quaternion())) };
    };
    const endpoint = (i: number, distance: number) => { const pose = rayPose(i); return rayEndpoint(pose.origin, pose.direction, distance); };
    const point = (i: number) => grips[i].getWorldPosition(new Vector3());
    const visible = (object: Object3D) => { for (let p: Object3D | null = object; p; p = p.parent) if (!p.visible) return false; return true; };
    const aim = (i: number): Target | null => {
      controllers[i].updateWorldMatrix(true, false);
      ray.ray.origin.setFromMatrixPosition(controllers[i].matrixWorld);
      ray.ray.direction.set(0, 0, -1).applyQuaternion(controllers[i].getWorldQuaternion(new Quaternion()));
      for (const hit of ray.intersectObjects(scene.children, true)) {
        if (!(hit.object instanceof Mesh) || !visible(hit.object)) continue;
        let boxId: number | undefined, lever: LeverTarget | undefined, activate: (() => void) | undefined, panel = false, object = hit.object as Object3D;
        let wall: Target['wall'], boxObject: Object3D | undefined;
        for (let p: Object3D | null = hit.object; p; p = p.parent) {
          if (p.userData.xrTouch) return null;
          if (!activate && typeof p.userData.activate === 'function') activate = p.userData.activate;
          if (p.userData.xrWall && !lever) { wall = p.userData.xrWall; object = p; }
          if (p.userData.xrLever) { lever = p.userData.xrLever; object = p; }
          if (typeof p.userData.xrBoxId === 'number') { boxId = p.userData.xrBoxId; boxObject = p; if (!lever && !wall) object = p; }
          if (p.userData.xrPanel) panel = true;
        }
        if (panel || boxId !== undefined || activate) return { object, boxId, lever, activate, panel, wall, boxObject, hit: hit.point.clone() };
      }
      return null;
    };
    const begin = (i: number, source: XRInputSource) => {
      const h = hands[i]; h.source = source;
      if (!active || !h.tracked || h.down || grab || (source.handedness !== 'left' && source.handedness !== 'right')) return;
      try { audio ??= new AudioContext(); void audio.resume().catch(() => undefined); } catch { /* audio is optional */ }
      h.down = true;
      if (board.current?.visible && source.handedness === 'right' && menuIndex >= 0) { actions()[menuIndex]?.userData.activate(); return; }
      const target = aim(i); h.target = target;
      if (!target) return;
      if (target.panel) { if (source.handedness === 'right' && !hands.some((other, j) => j !== i && other.down)) target.activate?.(); return; }
      if (target.lever && !latest.current.lab.boxes.some(b => b.id === target.boxId && canGrabBox(latest.current.lab,b))) {
        if (hands.some((other, j) => j !== i && other.target?.lever?.boxId === target.lever!.boxId && other.target?.lever?.index === target.lever!.index && other.down)) { h.target = null; return; }
        const b = latest.current.lab.boxes.find(b => b.id === target.lever!.boxId)!;
        if (!canOperateLever(latest.current.lab, b, target.lever.index)) {
          hint('Retire a tampa e monte as paredes adjacentes antes de agarrar o ferrolho.'); h.target = null; return;
        }
        send({ type: 'select', id: b.id });
        h.phase = b.leverRaised[target.lever.index] ? 'open' : 'lift';
        h.slideDirection = target.lever.direction * (b.bolts[target.lever.index] ? -1 : 1);
        h.anchor.copy(target.object.worldToLocal(point(i)));
        hint('Ferrolho seguro: levante a alça, deslize para a lateral e rebata, mantendo o gatilho.'); return;
      }
      const b = latest.current.lab.boxes.find(b => b.id === target.boxId);
      if (b && canGrabBox(latest.current.lab, b)) {
        const corner = target.boxObject ? boxGrabCorner(target.boxObject.worldToLocal(target.hit.clone())) : null;
        if (corner === null) { h.target=null; hint('Para levantar, mire nos vértices superiores, não no meio das paredes.'); return; }
        const other = hands[1 - i];
        if (other.down && other.tracked && other.target?.boxId === b.id && hands[0].source?.handedness !== hands[1].source?.handedness) {
          const first = aim(1-i);
          if (first?.boxId !== b.id || !first.boxObject || boxGrabCorner(first.boxObject.worldToLocal(first.hit.clone())) === null || boxGrabCorner(first.boxObject.worldToLocal(first.hit.clone())) === corner) { hint('Mire em dois vértices superiores diferentes da mesma caixa e pressione novamente o segundo gatilho.'); h.down=false; h.target=null; return; }
          const hits: [Vector3, Vector3] = i === 0 ? [target.hit.clone(), first.hit.clone()] : [first.hit.clone(), target.hit.clone()];
          const object = target.boxObject!;
          object.updateWorldMatrix(true, false);
          grab = { id:b.id, object, origin:{...b.pose}, start:hits, candidate:{...b.pose},
            distances:[hits[0].distanceTo(rayPose(0).origin), hits[1].distanceTo(rayPose(1).origin)],
            anchors:[object.worldToLocal(hits[0].clone()), object.worldToLocal(hits[1].clone())] };
          clearHover();
          send({ type: 'select', id: b.id }); hint('Pontos fixados: mova e gire os controles para posicionar a caixa. Alcance constante; encaixe automático.');
        } else hint('Mantenha este gatilho e aponte a outra mão para outro vértice superior da mesma caixa.');
        return;
      }
      if (target.wall && b) {
        if (hands.some((other,j) => j !== i && other.down && other.target?.wall?.boxId === b.id && other.target?.wall?.index === target.wall!.index)) { h.target = null; return; }
        const state = reduceLab(latest.current.lab, { type: 'select', id: b.id });
        const probe = reduceLab(state, { type: 'wall', index: target.wall.index });
        if (probe.boxes === state.boxes) { target.object.userData.invalidUntil=performance.now()+900; if (b.walls[target.wall.index]) target.object.rotation.x=-.16; hint(probe.message); h.target = null; return; }
        send({ type: 'select', id: b.id });
        h.wallStart = b.walls[target.wall.index] ? 0 : -Math.PI / 2;
        const parent = target.object.parent!;
        h.anchor.copy(parent.worldToLocal(point(i)));
        const grip = wallGrabPoint(target.wall.index); h.radius = Math.hypot(grip.y, grip.z);
        target.object.userData.xrHeld = true; target.object.rotation.x = h.wallStart;
        hint('Parede segura: mantenha o gatilho e puxe até a posição final. Soltar antes devolve a parede.'); return;
      }
      // Never remove a completed box's lid when an attempted grab is blocked.
      if (b?.support !== null && b?.support !== undefined) { hint('Use Desempilhar no painel antes de levantar a caixa.'); return; }
      if (b && latest.current.lab.boxes.some(other => other.support === b.id)) { hint('Desempilhe a caixa superior primeiro.'); return; }
      target.activate?.();
    };
    const beams = controllers.map((controller, i) => {
      rig.add(controller, grips[i]);
      const beam = new Mesh(new BoxGeometry(0.003, 0.003, 4), new MeshBasicMaterial({ color: '#42e8cc' })); beam.position.z = -2; beam.raycast = () => undefined; controller.add(beam);
      const marker = new Mesh(new SphereGeometry(.018, 12, 8), new MeshBasicMaterial({color:'#168bff', depthTest:false})); marker.raycast=()=>undefined; marker.visible=false; marker.renderOrder=10; scene.add(marker);
      const connected = (event: { data: XRInputSource }) => { hands[i].source = event.data; };
      const disconnected = () => { clear(true); hands[i].source = null; hands[i].tracked = false; };
      const down = (event: { data: XRInputSource }) => begin(i, event.data);
      const up = () => { if (grab) clear(false); restoreWall(hands[i]); hands[i].down = false; hands[i].target = null; };
      controller.addEventListener('connected', connected); controller.addEventListener('disconnected', disconnected);
      controller.addEventListener('selectstart', down); controller.addEventListener('selectend', up);
      return { beam, marker, connected, disconnected, down, up };
    });
    const visibility = () => { if (gl.xr.getSession()?.visibilityState !== 'visible') clear(true); };
    const start = () => {
      clear(true); active = true; explorationKey = ''; rig.position.set(0, 0, 3); rig.rotation.set(0, 0, 0); resetExploration();
      saved.position.copy(camera.position); saved.quaternion.copy(camera.quaternion);
      if (camera instanceof PerspectiveCamera) saved.fov = camera.fov;
      rig.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity();
      gl.xr.getSession()?.addEventListener('visibilitychange', visibility); onPresenting(true);
      hint('Esquerda: virar e avançar/recuar. Segure o grip esquerdo para abrir a prancheta.');
    };
    const end = () => {
      projectedHands.forEach(hand=>{hand.root.visible=false;});
      clear(true); if (board.current) board.current.visible = false;
      gl.xr.getSession()?.removeEventListener('visibilitychange', visibility);
      if (active) { rig.remove(camera); originalParent?.add(camera); camera.position.copy(saved.position); camera.quaternion.copy(saved.quaternion);
        if (camera instanceof PerspectiveCamera) { camera.fov = saved.fov; camera.updateProjectionMatrix(); }
      }
      active = false; onPresenting(false);
    };
    gl.xr.addEventListener('sessionstart', start); gl.xr.addEventListener('sessionend', end);
    tick.current = (dt, frame) => {
      if (!active || !frame) return;
      resetExploration();
      const session = gl.xr.getSession(), space = gl.xr.getReferenceSpace();
      if (!session || !space || session.visibilityState !== 'visible') { clear(true); if (board.current) board.current.visible = false; return; }
      const viewer = frame.getViewerPose(space);
      if (!viewer) { clear(true); if (board.current) board.current.visible = false; return; }
      hands.forEach((h, i) => {
        h.tracked = !!h.source?.gripSpace && !!frame.getPose(h.source.gripSpace, space) && !!frame.getPose(h.source.targetRaySpace, space);
        if (!h.tracked && h.down) { clear(true); hint('Rastreamento perdido: agarre cancelado. A caixa voltou à origem.'); }
        models[i].root.visible=h.tracked; models[i].update(h.source?.gamepad?.buttons[0]?.value ?? (h.down?1:0),h.source?.handedness==='left');
        beams[i].beam.visible = h.tracked;
        beams[i].beam.material.color.set(h.down ? '#ffcd5c' : '#42e8cc');
        const distance = grab?.distances[i] ?? 4;
        beams[i].beam.scale.z = distance / 4; beams[i].beam.position.z = -distance / 2;
        beams[i].marker.visible = !!grab && h.tracked;
      });
      const pad = (side: XRHandedness) => hands.find(h => h.tracked && h.source?.handedness === side)?.source?.gamepad ?? null;
      const pads = { left: pad('left'), right: pad('right') };
      const left = hands.findIndex(h => h.tracked && h.source?.handedness === 'left');
      const menu = left >= 0 && gripHeld(pads.left) && !grab && !hands.some(h => h.down && h.target?.boxId !== undefined);
      if (board.current) {
        board.current.visible = menu;
        if (menu) {
          board.current.position.copy(grips[left].localToWorld(new Vector3(0,.25,-.12)));
          board.current.quaternion.copy(grips[left].getWorldQuaternion(new Quaternion())).multiply(new Quaternion().setFromEuler(new Euler(-.45,0,0)));
        }
      }
      if (focused instanceof Mesh) (focused.material as MeshBasicMaterial).color.set('#ffffff');
      focused = null;
      if (menu) {
        const items = actions(), stick = pads.right?.axes[3] ?? 0;
        menuCooldown = Math.max(0,menuCooldown-dt);
        if (Math.abs(stick)<.25) menuCooldown=0;
        else if (Math.abs(stick)>.6 && menuCooldown===0 && items.length) { menuIndex=(menuIndex+(stick>0?1:-1)+items.length)%items.length; menuCooldown=.3; }
        if (menuIndex>=0 && items.length) { menuIndex %= items.length; focused=items[menuIndex]; if (focused instanceof Mesh) (focused.material as MeshBasicMaterial).color.set('#72ffd0'); }
      } else { menuIndex=-1; menuCooldown=0; }
      const orientation = viewer.transform.orientation;
      const forward = new Vector3(0,0,-1).applyQuaternion(new Quaternion(orientation.x,orientation.y,orientation.z,orientation.w));
      const headYaw = Math.atan2(-forward.x,-forward.z);
      if (!menu && !hands.some(h => h.down || h.source?.gamepad?.buttons[0]?.pressed)) {
        const nav = navigationInput(pads,dt);
        const config = latest.current.exploration;
        if (config?.vehicle && config.mode === 'fly') {
          nav.forward = navigationInput({ left: null, right: pads.right }, dt).forward;
          const lift = pads.left?.axes[3] ?? 0;
          if (Math.abs(lift) > .18) rig.position.y -= lift * Math.min(dt, .05) * 1.5;
        }
        const next = navigateRig({ x:rig.position.x,y:rig.position.y,z:rig.position.z,yaw:rig.rotation.y },viewer.transform.position,headYaw,nav);
        const bounded = config ? constrainExploration(next, viewer.transform.position, config) : next;
        rig.position.set(bounded.x,bounded.y,bounded.z); rig.rotation.y=bounded.yaw; rig.updateMatrixWorld(true);
      }
      if (latest.current.exploration?.vehicle) {
        const bounded = constrainExploration({ x:rig.position.x, y:rig.position.y, z:rig.position.z, yaw:rig.rotation.y }, viewer.transform.position, latest.current.exploration);
        rig.position.set(bounded.x, bounded.y, bounded.z); rig.updateMatrixWorld(true);
      }
      if (latest.current.exploration?.key.startsWith('vr:')) {
        const bounded=constrainCrates({x:rig.position.x,y:rig.position.y,z:rig.position.z,yaw:rig.rotation.y},viewer.transform.position,latest.current.lab.boxes);
        rig.position.set(bounded.x,bounded.y,bounded.z);rig.updateMatrixWorld(true);
      }
      projectedHands.forEach((hand,i)=>{
        const target=hands[i].target;
        const holding=hands[i].tracked && hands[i].down && !!target?.wall && !!target.object.userData.xrHeld;
        hand.root.visible=holding;
        if(holding && target?.wall){
          models[i].root.visible=false;
          const grip = wallGrabPoint(target.wall.index);
          hand.root.position.copy(target.object.localToWorld(new Vector3(grip.x,grip.y,grip.z)));
          hand.root.quaternion.copy(target.object.getWorldQuaternion(new Quaternion()));
          hand.update(1,hands[i].source?.handedness==='left');
        }
      });
      // Only actual tracked fingertips/glove tips can press pedestal buttons; rays never do.
      const touches: Vector3[]=[];
      if(!grab && !menu && !hands.some(h=>h.down)) {
        for(const source of session.inputSources) {
          const joint=source.hand?.get('index-finger-tip');
          const pose=joint && frame.getJointPose?.(joint,space);
          if(pose) touches.push(rig.localToWorld(new Vector3(pose.transform.position.x,pose.transform.position.y,pose.transform.position.z)));
        }
        hands.forEach((h,i)=>{if(h.tracked && !h.source?.hand)touches.push(grips[i].localToWorld(new Vector3(0,0,-.10)));});
      }
      const currentButtons=new Set<Object3D>();
      scene.traverse(object=>{
        if(!object.userData.xrTouch)return;
        currentButtons.add(object);
        const enabled=visible(object) && !object.userData.disabled && !grab && !menu;
        const state=touchStates.get(object) ?? {armed:false,pressed:false};
        if(!enabled || touches.length===0){touchStates.set(object,{armed:false,pressed:false});object.userData.pressed=false;return;}
        const local=touches.map(p=>object.worldToLocal(p.clone()));
        const next=touchButton(state,local,object.userData.width,object.userData.height);
        touchStates.set(object,next);object.userData.pressed=next.pressed;
        if(next.fire){object.userData.onPress();feedback.current();}
      });
      for(const object of touchStates.keys())if(!currentButtons.has(object))touchStates.delete(object);
      clearHover();
      if (!grab && !menu) hands.forEach((hand, i) => {
        if (!hand.tracked) return;
        const target = hand.down ? hand.target : aim(i);
        if (!target?.lever || target.panel) return;
        const box = latest.current.lab.boxes.find(b => b.id === target.lever!.boxId);
        const occupied = hands.some((other,j) => j !== i && other.down && other.target?.lever?.boxId === target.lever!.boxId && other.target?.lever?.index === target.lever!.index);
        if (box && canOperateLever(latest.current.lab, box, target.lever.index) && !occupied) {
          hoveredLevers.add(target.object); target.object.userData.xrHovered=true;
          beams[i].beam.material.color.set('#168bff');
        }
      });
      if (grab) {
        const held = grab, b = latest.current.lab.boxes.find(b => b.id === held.id);
        if (!b || !canGrabBox(latest.current.lab, b)) { clear(true); return; }
        const previousCandidate = held.candidate;
        const physical = rayGrabbedPose(held.origin, held.start, [endpoint(0,held.distances[0]), endpoint(1,held.distances[1])], held.candidate.yaw);
        held.candidate = { ...physical, y:Math.max(0,Math.min(2.5,physical.y)) };
        held.candidate = supportedPose(b,held.candidate,latest.current.lab.boxes);
        const snapped = latest.current.lab.boxes.map(other=>captureStackPose({...b,pose:held.candidate},other)).find(Boolean);
        if (snapped) { held.candidate=snapped; clear(false); return; }
        const state = reduceLab(latest.current.lab, { type: 'select', id: held.id });
        const preview = reduceLab(state, { type: 'move', pose: held.candidate });
        const accepted = preview.boxes.find(box => box.id === held.id)!;
        if (accepted !== b) { held.candidate = accepted.pose; applyPose(held.object, accepted.pose); hint('Pontos fixados em azul: mova e gire os controles. Solte para apoiar; alinhe para encaixar.'); }
        else {
          // Release must use the last displayed, valid pose. A rejected controller
          // sample must not silently replace it and send the box back to its origin.
          held.candidate = previousCandidate;
          hint('Movimento bloqueado: eleve a caixa antes de aproximá-la da outra.');
        }
        held.object.updateWorldMatrix(true, false);
        beams.forEach((beam,i) => beam.marker.position.copy(held.object.localToWorld(held.anchors[i].clone())));
      } else hands.forEach((h, i) => {
        const target = h.target;
        if (!h.down || !h.tracked || !target) return;
        if (target.wall && !target.lever && target.object.userData.xrHeld) {
          const b = latest.current.lab.boxes.find(b=>b.id===target.wall!.boxId)!;
          const delta = target.object.parent!.worldToLocal(point(i)).sub(h.anchor);
          const angle=wallPullAngle(h.wallStart,h.radius,delta); target.object.rotation.x=angle;
          if (wallPullComplete(angle,!b.walls[target.wall.index]) || (b.walls[target.wall.index] && angle < -.12)) {
            send({type:'select',id:b.id}); const result=send({type:'wall',index:target.wall.index});
            restoreWall(h); h.target=null; hint(result.message);
          }
          return;
        }
        if (!target.lever || h.phase === 'done' || latest.current.lab.boxes.some(b=>b.id===target.boxId && canGrabBox(latest.current.lab,b))) return;
        const local = target.object.worldToLocal(point(i));
        const step = leverMotion(h.phase, local.clone().sub(h.anchor), h.slideDirection);
        if (!step) return;
        send({ type: 'select', id: target.lever.boxId });
        const before = latest.current.lab.boxes.find(b => b.id === target.lever!.boxId)!;
        const result = send({ type: 'lever', index: target.lever.index, step });
        const b = result.boxes.find(b => b.id === target.lever!.boxId)!;
        const applied = step === 'slide' ? b.bolts[target.lever.index] !== before.bolts[target.lever.index] : (step === 'lift' ? b.leverRaised[target.lever.index] : !b.leverRaised[target.lever.index]);
        if (applied) { h.phase = step === 'lift' ? 'slide' : step === 'slide' ? 'lower' : 'done'; h.anchor.copy(local); }
        hint(result.message);
      });
    };
    return () => {
      tick.current = () => undefined; feedback.current = () => undefined; end(); void audio?.close().catch(() => undefined); void gl.xr.getSession()?.end();
      gl.xr.removeEventListener('sessionstart', start); gl.xr.removeEventListener('sessionend', end);
      controllers.forEach((controller, i) => {
        const b = beams[i]; controller.removeEventListener('connected', b.connected); controller.removeEventListener('disconnected', b.disconnected);
        controller.removeEventListener('selectstart', b.down); controller.removeEventListener('selectend', b.up);
        grips[i].remove(models[i].root); models[i].dispose();
        scene.remove(b.marker); b.marker.geometry.dispose(); b.marker.material.dispose();
        controller.remove(b.beam); rig.remove(controller, grips[i]); b.beam.geometry.dispose(); b.beam.material.dispose();
      });
      projectedHands.forEach(hand=>{scene.remove(hand.root);hand.dispose();});
      scene.remove(rig); onRenderer(null);
    };
  }, [gl, scene, camera, onRenderer, onPresenting]);
  return <group ref={board} visible={false}  userData={{ xrPanel: true }}>{children}</group>;
}
