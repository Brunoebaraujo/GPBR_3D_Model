import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Quaternion, Vector3 } from 'three';
import { PanelText } from './TouchButton';
import { TUTORIAL_STEPS } from '../utils/locomotionTutorial';
function TutorialButton({text,x,run}:{text:string;x:number;run:()=>void}){
  return <group position={[x,-.27,.025]} userData={{activate:run}} onClick={e=>{e.stopPropagation();run();}}>
    <mesh><boxGeometry args={[.54,.13,.025]}/><meshBasicMaterial color="#087c70"/></mesh>
    <PanelText text={text} width={.50} height={.09} position={[0,0,.014]}/>
  </group>;
}
export function LocomotionTutorial({step,onStep}:{step:number;onStep:(step:number)=>void}){
  const positioned=useRef(false);
  const root=useRef<Group>(null),{gl,camera}=useThree();
  const vectors=useRef({eye:new Vector3(),direction:new Vector3(),rotation:new Quaternion(),target:new Vector3()});
  useFrame((_,dt)=>{
    if(!root.current)return;
    const v=vectors.current,view=gl.xr.isPresenting?gl.xr.getCamera():camera;
    view.getWorldPosition(v.eye);view.getWorldQuaternion(v.rotation);
    v.direction.set(0,0,-1).applyQuaternion(v.rotation);v.direction.y=0;v.direction.normalize();
    v.target.copy(v.eye).addScaledVector(v.direction,1.55);v.target.y-=.12;
    if(!positioned.current){root.current.position.copy(v.target);positioned.current=true;}
    else root.current.position.lerp(v.target,Math.min(1,dt*10));
    root.current.rotation.set(0,Math.atan2(-v.direction.x,-v.direction.z),0);
    const session=gl.xr.getSession();
    root.current.visible=!session || (session.visibilityState==='visible' && !Array.from(session.inputSources).some(s=>s.handedness==='left' && s.gamepad?.buttons[4]?.pressed));
  });
  if(step===-2)return null;
  const lesson=TUTORIAL_STEPS[step];
  const title=step===-1?'Quer aprender a se locomover?':step===8?'Pronto para explorar':`${step+1}/${TUTORIAL_STEPS.length} · ${lesson.title}`;
  const lines=step===-1?['Tutorial opcional, com uma ação por vez.','Aponte com a mão direita e aperte o gatilho.']:step===8?['Use os analógicos para circular e X para a prancheta.','Você pode repetir este tutorial quando quiser.']:lesson.lines;
  return <group ref={root} userData={{xrPanel:true}}>
    <mesh><boxGeometry args={[1.34,.82,.035]}/><meshBasicMaterial color="#122937"/></mesh>
    <PanelText text={title} width={1.24} height={.12} position={[0,.29,.025]}/>
    <PanelText text={lesson?.cue ?? 'LOCOMOÇÃO · MB6'} width={1.22} height={.13} position={[0,.12,.025]} color="#205765"/>
    {lines.map((line,i)=><PanelText key={line} text={line} width={1.24} height={.075} position={[0,-.035-i*.09,.025]}/>)}
    <TutorialButton text={step===-1?'Começar':step===8?'Repetir':'Pular etapa'} x={-.30} run={()=>onStep(step===-1||step===8?0:step+1)}/>
    <TutorialButton text={step===-1?'Agora não':step===8?'Concluir':'Sair do tutorial'} x={.30} run={()=>onStep(-2)}/>
  </group>;
}
