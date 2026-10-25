import { useEffect, useRef, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { Action, Lab } from '../utils/mb6Assembly';
import { Label } from './VRWorkspace';
import { PanelText, TouchButton } from './TouchButton';

type Score = { name: string; ms: number };
const cacheKey = 'mb6-challenge-scores-v1';
const formatTime = (ms: number) => `${Math.floor(ms/60000).toString().padStart(2,'0')}:${(Math.floor(ms/1000)%60).toString().padStart(2,'0')}.${Math.floor(ms%1000/10).toString().padStart(2,'0')}`;
function readScores(): Score[] {
  try { const data: unknown=JSON.parse(sessionStorage.getItem(cacheKey) ?? '[]');
    return Array.isArray(data) ? data.filter((s): s is Score => typeof s?.name==='string' && Number.isFinite(s?.ms) && s.ms>=0).slice(0,10) : [];
  } catch { return []; }
}
function Completed() {
  const root=useRef<Group>(null);
  useFrame(({clock})=>{ if(root.current) root.current.scale.setScalar(1+Math.sin(clock.elapsedTime*5)*.035); });
  const [blue,setBlue]=useState(true);
  useEffect(()=>{const id=setInterval(()=>setBlue(v=>!v),300);return()=>clearInterval(id);},[]);
  return <group ref={root} position={[-.8,2.65,0]}>
    <Label text="" position={[0,0,-.01]} width={2.15} height={.48} color={blue?'#168bff':'#123553'}/>
    <Label text="CONCLUÍDO" position={[0,0,0]} width={2} height={.34} color="#102b41"/>
  </group>;
}
export function AssemblyChallenge({lab,dispatch}:{lab:Lab;dispatch:(a:Action)=>void}) {
  const {scene}=useThree();
  // Pedestal front edge: x=-.85+.75/2. Facing its controls, right is -Z.
  // Start the keyboard at that edge; .30 m right + .50 m toward the scoreboard.
  // Its left edge is -.71*.65 from the origin. Yaw 0 is perpendicular to pedestal yaw PI/2.
  const keyboardPosition: [number,number,number]=[-.85+.75/2+.71*.65,1.14,3-.3-.5];
  const [fallback,setFallback]=useState(false);
  const [started,setStarted]=useState<number|null>(null),[elapsed,setElapsed]=useState(0);
  const [finished,setFinished]=useState(false),[saved,setSaved]=useState(false),[name,setName]=useState('');
  const [scores,setScores]=useState(readScores);
  useEffect(()=>{if(!finished || saved)setFallback(false);},[finished,saved]);
  // Keep text entry inside XR: native focus can suspend the Quest session.
  const editName=()=>setFallback(true);
  const starting=useRef(false);
  const complete=!lab.practice && lab.boxes.some(b=>b.id===2 && b.support===1);
  useEffect(()=>{
    if(started===null || finished)return;
    if(complete){setElapsed(performance.now()-started);setFinished(true);return;}
    const id=setInterval(()=>setElapsed(performance.now()-started),100);
    return()=>clearInterval(id);
  },[started,finished,complete]);
  // A laboratory reset cancels an attempt without adding a score.
  useEffect(()=>{if(lab.practice){setStarted(null);setFinished(false);setSaved(false);setFallback(false);}},[lab.practice]);
  const first=lab.boxes[0];
  useEffect(()=>{
    if(starting.current){starting.current=false;return;}
    if(lab.boxes.length===1 && first.lid && first.walls.every(w=>!w)) {
      setStarted(null);setElapsed(0);setFinished(false);setSaved(false);setName('');
    }
  },[first,lab.boxes.length]);
  const start=()=>{setFallback(false);starting.current=true;dispatch({type:'reset'});setFinished(false);setSaved(false);setName('');setElapsed(0);setStarted(performance.now());};
  const save=()=>{
    if(!name.trim() || saved)return;
    const next=[...scores,{name:name.trim(),ms:elapsed}].sort((a,b)=>a.ms-b.ms).slice(0,10);
    setScores(next);setSaved(true);
    try{sessionStorage.setItem(cacheKey,JSON.stringify(next));}catch{/* In-memory scores remain available. */}
  };
  return <group>
    <group position={[-.85,0,3]} rotation={[0,Math.PI / 2,0]}>
      <mesh position={[0,.055,0]}><boxGeometry args={[1.25,.11,.75]}/><meshStandardMaterial color="#142532" metalness={.5} roughness={.4}/></mesh>
      <mesh position={[0,.55,-.12]}><boxGeometry args={[.5,1,.38]}/><meshStandardMaterial color="#294656" metalness={.45} roughness={.4}/></mesh>
      <group position={[0,1.18,0]} rotation={[-.3,0,0]}>
        <mesh position={[0,0,-.07]}><boxGeometry args={[1.36,.95,.14]}/><meshStandardMaterial color="#203947" metalness={.5} roughness={.35}/></mesh>
        <PanelText text="MONTAGEM MB6" width={1.17} height={.10} position={[0,.35,.006]}/>
        <PanelText text={formatTime(elapsed)} width={1.17} height={.16} position={[0,.19,.006]}/>
        <TouchButton text={started===null?'INICIAR':finished?'NOVO JOGO':'EM ANDAMENTO'} position={[-.32,-.02,.04]} disabled={started!==null && !finished} onPress={start}/>
        <TouchButton text="REINICIAR" position={[.32,-.02,.04]} color="#a94332" onPress={()=>dispatch({type:'reset'})}/>
        {finished && !saved ? <>
          <TouchButton text="DIGITAR NOME" position={[-.32,-.24,.04]} onPress={editName}/>
          <TouchButton text="SALVAR" position={[.32,-.24,.04]} disabled={!name.trim()} onPress={save}/>
        </> : <PanelText text={saved?'TEMPO SALVO NO PLACAR':'TOQUE COM A MÃO PARA APERTAR'} width={1.17} height={.09} position={[0,-.26,.006]}/>}
      </group>
      {finished && !saved && <group position={[0,1.82,-.17]}>
        <mesh position={[0,0,-.05]}><boxGeometry args={[1.38,.48,.10]}/><meshStandardMaterial color="#203947"/></mesh>
        <PanelText text={name || 'QUAL É O SEU NOME?'} width={1.25} height={.14} position={[0,.10,.006]}/>
        <TouchButton text={fallback?'FECHAR TECLADO 3D':'USAR TECLADO 3D'} position={[0,-.11,.04]} width={1.05} height={.12} onPress={()=>{if(fallback)setFallback(false);else editName();}}/>
      </group>}
      {finished && !saved && fallback && createPortal(<group position={keyboardPosition} rotation={[0,0,0]}><group rotation={[-.4,0,0]} scale={.65}><group>
        <mesh position={[0,-.05,-.07]}><boxGeometry args={[1.42,.93,.14]}/><meshStandardMaterial color="#203947"/></mesh>
        <PanelText text={(name || 'SEU NOME') + '  |'} width={1.3} height={.12} position={[0,.48,.04]}/>
        {['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map((row,r)=>row.split('').map((char,i)=><TouchButton key={char} text={char} position={[(i-(row.length-1)/2)*.135,.28-r*.18,.025]} width={.113} height={.14} onPress={()=>setName(n=>(n+char).slice(0,18))}/>))}
        <group position={[1.03,0,0]}>
          <mesh position={[0,-.02,-.07]}><boxGeometry args={[.55,.93,.14]}/><meshStandardMaterial color="#203947"/></mesh>
          <PanelText text="NÚMEROS" width={.48} height={.09} position={[0,.41,.025]}/>
          {['789','456','123'].map((row,r)=>row.split('').map((char,i)=><TouchButton key={char} text={char} position={[(i-1)*.17,.25-r*.18,.025]} width={.13} height={.14} onPress={()=>setName(n=>(n+char).slice(0,18))}/>))}
          <TouchButton text="0" position={[0,-.29,.025]} width={.47} height={.13} onPress={()=>setName(n=>(n+'0').slice(0,18))}/>
        </group>
        <TouchButton text="ESPAÇO" position={[-.46,-.29,.025]} width={.39} height={.13} onPress={()=>setName(n=>(n+' ').slice(0,18))}/>
        <TouchButton text="APAGAR" position={[0,-.29,.025]} width={.39} height={.13} onPress={()=>setName(n=>n.slice(0,-1))}/>
        <TouchButton text="SALVAR" position={[.46,-.29,.025]} width={.39} height={.13} disabled={!name.trim()} onPress={save}/>
      </group></group></group>,scene)}
    </group>
    <Label text="PLACAR · MONTAGEM MB6" position={[0,2.45,-2.3]} width={3.2} height={.25}/>
    {scores.length===0 && <Label text="Complete as duas caixas e registre seu tempo" position={[0,2.1,-2.3]} width={3.2} height={.2}/>}
    {scores.map((s,i)=><Label key={i} text={`${i+1}. ${s.name}    ${formatTime(s.ms)}`} position={[0,2.1-i*.18,-2.3]} width={3.2} height={.16}/>)}
    {complete && <Completed/>}

  </group>;
}
