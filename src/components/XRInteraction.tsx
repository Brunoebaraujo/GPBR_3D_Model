import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Quaternion, Raycaster, Vector3, WebGLRenderer } from 'three';
import { fitsStack, reduceLab, type Action, type Lab, type Pose } from '../utils/mb6Assembly';
import { canGrabBox, grabbedPose, leverMotion, navigationInput, navigateRig, type LeverPhase, type Point3 } from '../utils/xrInteraction';

type Props = { lab: Lab; dispatch: (action: Action) => void; onRenderer: (renderer: WebGLRenderer | null) => void; onPresenting: (value: boolean) => void; onHint: (text: string) => void; children: ReactNode };
type LeverTarget = { boxId: number; index: number; direction: number };
type Target = { object: Object3D; boxId?: number; lever?: LeverTarget; activate?: () => void; panel: boolean };
type Hand = { source: XRInputSource | null; down: boolean; target: Target | null; anchor: Vector3; phase: LeverPhase; slideDirection: number; tracked: boolean };
type Grab = { id: number; object: Object3D; origin: Pose; start: [Point3, Point3]; candidate: Pose };

// The viewer and controllers share a rig; the action panel stays in the scene.
export function XRInteraction({ lab, dispatch, onRenderer, onPresenting, onHint, children }: Props) {
  const { gl, scene, camera } = useThree();
  const latest = useRef({ lab, dispatch, onHint }); latest.current = { lab, dispatch, onHint };
  const board = useRef<Group>(null);
  const tick = useRef<(dt: number, frame?: XRFrame) => void>(() => undefined);
  useFrame((_, dt, frame) => tick.current(dt, frame));
  useEffect(() => {
    gl.xr.enabled = true; gl.xr.setReferenceSpaceType('local-floor'); onRenderer(gl);
    const rig = new Group(); rig.position.z = 3; scene.add(rig);
    const originalParent = camera.parent;
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera instanceof PerspectiveCamera ? camera.fov : 48 };
    const ray = new Raycaster(); ray.far = 5;
    let grab: Grab | null = null, active = false, message = '';
    const hint = (text: string) => { if (text !== message) { message = text; latest.current.onHint(text); } };
    const send = (action: Action) => {
      const next = reduceLab(latest.current.lab, action);
      latest.current.lab = next; latest.current.dispatch(action); return next;
    };
    const applyPose = (object: Object3D, p: Pose) => { object.position.set(p.x, p.y, p.z); object.rotation.set(0, p.yaw, 0); object.updateMatrixWorld(true); };
    const clear = (cancel: boolean) => {
      if (grab) {
        const held = grab; grab = null;
        if (!cancel) { send({ type: 'select', id: held.id }); const result = send({ type: 'drop', pose: held.candidate }); hint(result.message); }
        const box = latest.current.lab.boxes.find(b => b.id === held.id);
        applyPose(held.object, box?.pose ?? held.origin);
      }
      hands.forEach(h => { h.down = false; h.target = null; });
    };
    const hands: Hand[] = [0, 1].map(() => ({ source: null, down: false, target: null, anchor: new Vector3(), phase: 'lift', slideDirection: 1, tracked: false }));
    const controllers = [0, 1].map(i => gl.xr.getController(i));
    const grips = [0, 1].map(i => gl.xr.getControllerGrip(i));
    const point = (i: number) => grips[i].getWorldPosition(new Vector3());
    const visible = (object: Object3D) => { for (let p: Object3D | null = object; p; p = p.parent) if (!p.visible) return false; return true; };
    const aim = (i: number): Target | null => {
      controllers[i].updateWorldMatrix(true, false);
      ray.ray.origin.setFromMatrixPosition(controllers[i].matrixWorld);
      ray.ray.direction.set(0, 0, -1).applyQuaternion(controllers[i].getWorldQuaternion(new Quaternion()));
      for (const hit of ray.intersectObjects(scene.children, true)) {
        if (!(hit.object instanceof Mesh) || !visible(hit.object)) continue;
        let boxId: number | undefined, lever: LeverTarget | undefined, activate: (() => void) | undefined, panel = false, object = hit.object as Object3D;
        for (let p: Object3D | null = hit.object; p; p = p.parent) {
          if (!activate && typeof p.userData.activate === 'function') activate = p.userData.activate;
          if (p.userData.xrLever) { lever = p.userData.xrLever; object = p; }
          if (typeof p.userData.xrBoxId === 'number') { boxId = p.userData.xrBoxId; if (!lever) object = p; }
          if (p.userData.xrPanel) panel = true;
        }
        // The left ray cannot click through its own wrist panel.
        if (panel && hands[i].source?.handedness === 'left') continue;
        if (panel || boxId !== undefined || activate) return { object, boxId, lever, activate, panel };
      }
      return null;
    };
    const begin = (i: number, source: XRInputSource) => {
      const h = hands[i]; h.source = source;
      if (!active || !h.tracked || h.down || grab || (source.handedness !== 'left' && source.handedness !== 'right')) return;
      h.down = true;
      const target = aim(i); h.target = target;
      if (!target) return;
      if (target.panel) { if (!hands.some((other, j) => j !== i && other.down)) target.activate?.(); return; }
      if (target.lever) {
        if (hands.some((other, j) => j !== i && other.target?.lever?.boxId === target.lever!.boxId && other.target?.lever?.index === target.lever!.index && other.down)) { h.target = null; return; }
        const b = latest.current.lab.boxes.find(b => b.id === target.lever!.boxId)!;
        if (b.lid || b.support !== null || latest.current.lab.boxes.some(other => other.support === b.id) || !b.walls[target.lever.index] || !b.walls[(target.lever.index + 1) % 4]) {
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
        const other = hands[1 - i];
        if (other.down && other.tracked && other.target?.boxId === b.id && !other.target.lever && hands[0].source?.handedness !== hands[1].source?.handedness) {
          grab = { id: b.id, object: target.object, origin: { ...b.pose }, start: [point(0), point(1)], candidate: { ...b.pose } };
          send({ type: 'select', id: b.id }); hint('Caixa segura: mova as duas mãos. Solte um gatilho para apoiar no piso ou encaixar.');
        } else hint('Mantenha este gatilho e aponte a outra mão para a mesma caixa.');
        return;
      }
      // Never remove a completed box's lid when an attempted grab is blocked.
      if (b?.support !== null && b?.support !== undefined) { hint('Use Desempilhar no painel antes de levantar a caixa.'); return; }
      if (b && latest.current.lab.boxes.some(other => other.support === b.id)) { hint('Desempilhe a caixa superior primeiro.'); return; }
      target.activate?.();
    };
    const beams = controllers.map((controller, i) => {
      rig.add(controller, grips[i]);
      const beam = new Mesh(new BoxGeometry(0.003, 0.003, 4), new MeshBasicMaterial({ color: '#42e8cc' })); beam.position.z = -2; beam.raycast = () => undefined; controller.add(beam);
      const connected = (event: { data: XRInputSource }) => { hands[i].source = event.data; };
      const disconnected = () => { clear(true); hands[i].source = null; hands[i].tracked = false; };
      const down = (event: { data: XRInputSource }) => begin(i, event.data);
      const up = () => { if (grab) clear(false); hands[i].down = false; hands[i].target = null; };
      controller.addEventListener('connected', connected); controller.addEventListener('disconnected', disconnected);
      controller.addEventListener('selectstart', down); controller.addEventListener('selectend', up);
      return { beam, connected, disconnected, down, up };
    });
    const visibility = () => { if (gl.xr.getSession()?.visibilityState !== 'visible') clear(true); };
    const start = () => {
      clear(true); active = true; rig.position.set(0, 0, 3); rig.rotation.set(0, 0, 0);
      saved.position.copy(camera.position); saved.quaternion.copy(camera.quaternion);
      if (camera instanceof PerspectiveCamera) saved.fov = camera.fov;
      rig.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity();
      gl.xr.getSession()?.addEventListener('visibilitychange', visibility); onPresenting(true);
      hint('Painel à esquerda da entrada. Analógico direito: andar; esquerdo: virar no próprio eixo.');
    };
    const end = () => {
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
      const session = gl.xr.getSession(), space = gl.xr.getReferenceSpace();
      if (!session || !space || session.visibilityState !== 'visible') { clear(true); if (board.current) board.current.visible = false; return; }
      const viewer = frame.getViewerPose(space);
      if (!viewer) { clear(true); if (board.current) board.current.visible = false; return; }
      hands.forEach((h, i) => {
        h.tracked = !!h.source?.gripSpace && !!frame.getPose(h.source.gripSpace, space) && !!frame.getPose(h.source.targetRaySpace, space);
        if (!h.tracked && h.down) { clear(true); hint('Rastreamento perdido: agarre cancelado. A caixa voltou à origem.'); }
        beams[i].beam.visible = h.tracked;
        beams[i].beam.material.color.set(h.down ? '#ffcd5c' : '#42e8cc');
      });
      if (!hands.some(h => h.down || h.source?.gamepad?.buttons[0]?.pressed)) {
        const pad = (side: XRHandedness) => hands.find(h => h.tracked && h.source?.handedness === side)?.source?.gamepad ?? null;
        const nav = navigationInput({ left: pad('left'), right: pad('right') }, dt);
        const orientation = viewer.transform.orientation;
        const forward = new Vector3(0, 0, -1).applyQuaternion(new Quaternion(orientation.x, orientation.y, orientation.z, orientation.w));
        const headYaw = Math.atan2(-forward.x, -forward.z);
        const next = navigateRig({ x: rig.position.x, y: rig.position.y, z: rig.position.z, yaw: rig.rotation.y }, viewer.transform.position, headYaw, nav);
        rig.position.set(next.x, next.y, next.z); rig.rotation.y = next.yaw;
        rig.updateMatrixWorld(true);
      }
      if (board.current) board.current.visible = true;
      if (grab) {
        const held = grab, b = latest.current.lab.boxes.find(b => b.id === held.id);
        if (!b || !canGrabBox(latest.current.lab, b)) { clear(true); return; }
        held.candidate = grabbedPose(held.origin, held.start, [point(0), point(1)]);
        const state = reduceLab(latest.current.lab, { type: 'select', id: held.id });
        const preview = reduceLab(state, { type: 'move', pose: held.candidate });
        const accepted = preview.boxes.find(box => box.id === held.id)!;
        const stack = state.boxes.some(other => fitsStack({ ...b, pose: held.candidate }, other));
        if (accepted !== b || stack) { applyPose(held.object, held.candidate); hint(stack ? 'Quatro pés alinhados: solte um gatilho para encaixar.' : 'Caixa segura: mova as mãos; solte perto do piso ou dos quatro vértices.'); }
        else hint('Movimento bloqueado: eleve a caixa antes de aproximá-la da outra.');
      } else hands.forEach((h, i) => {
        const target = h.target;
        if (!h.down || !h.tracked || !target?.lever || h.phase === 'done') return;
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
      tick.current = () => undefined; end(); void gl.xr.getSession()?.end();
      gl.xr.removeEventListener('sessionstart', start); gl.xr.removeEventListener('sessionend', end);
      controllers.forEach((controller, i) => {
        const b = beams[i]; controller.removeEventListener('connected', b.connected); controller.removeEventListener('disconnected', b.disconnected);
        controller.removeEventListener('selectstart', b.down); controller.removeEventListener('selectend', b.up);
        controller.remove(b.beam); rig.remove(controller, grips[i]); b.beam.geometry.dispose(); b.beam.material.dispose();
      });
      scene.remove(rig); onRenderer(null);
    };
  }, [gl, scene, camera, onRenderer, onPresenting]);
  return <group ref={board} visible={false} position={[-2, 1.45, 2.5]} rotation={[0, Math.PI / 2, 0]} scale={2} userData={{ xrPanel: true }}>{children}</group>;
}
