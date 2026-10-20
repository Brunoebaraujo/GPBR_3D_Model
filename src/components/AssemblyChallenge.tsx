import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Action, Lab } from '../utils/mb6Assembly';
import { Label } from './VRWorkspace';

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
  const [started,setStarted]=useState<number|null>(null),[elapsed,setElapsed]=useState(0);
  const [finished,setFinished]=useState(false),[saved,setSaved]=useState(false),[name,setName]=useState('');
  const [scores,setScores]=useState(readScores);
  const starting=useRef(false);
  const complete=lab.boxes.some(b=>b.id===2 && b.support===1);
  useEffect(()=>{
    if(started===null || finished)return;
    if(complete){setElapsed(performance.now()-started);setFinished(true);return;}
    const id=setInterval(()=>setElapsed(performance.now()-started),50);
    return()=>clearInterval(id);
  },[started,finished,complete]);
  // A laboratory reset cancels an attempt without adding a score.
  const first=lab.boxes[0];
  useEffect(()=>{
    if(starting.current){starting.current=false;return;}
    if(lab.boxes.length===1 && first.lid && first.walls.every(w=>!w)) {
      setStarted(null);setElapsed(0);setFinished(false);setSaved(false);setName('');
    }
  },[first,lab.boxes.length]);
  const start=()=>{starting.current=true;dispatch({type:'reset'});setFinished(false);setSaved(false);setName('');setElapsed(0);setStarted(performance.now());};
  const save=()=>{
    if(!name.trim() || saved)return;
    const next=[...scores,{name:name.trim(),ms:elapsed}].sort((a,b)=>a.ms-b.ms).slice(0,10);
    setScores(next);setSaved(true);
    try{sessionStorage.setItem(cacheKey,JSON.stringify(next));}catch{/* In-memory scores remain available. */}
  };
  return <group>
    <Label text={started===null?'INICIAR':finished?'NOVA TENTATIVA':'EM ANDAMENTO'} position={[-2,1.45,.6]} width={.85} height={.22} color="#087c70" action={started===null || finished?start:undefined}/>
    <Label text={formatTime(elapsed)} position={[-2,1.15,.6]} width={.85} height={.19}/>
    <Label text="PLACAR · MONTAGEM MB6" position={[0,2.45,-2.3]} width={3.2} height={.25}/>
    {scores.length===0 && <Label text="Complete as duas caixas e registre seu tempo" position={[0,2.1,-2.3]} width={3.2} height={.2}/>}
    {scores.map((s,i)=><Label key={i} text={`${i+1}. ${s.name}    ${formatTime(s.ms)}`} position={[0,2.1-i*.18,-2.3]} width={3.2} height={.16}/>)}
    {complete && <Completed/>}
    {finished && !saved && <group position={[0,1.8,1.2]}>
      <Label text={`Seu tempo: ${formatTime(elapsed)} · Digite seu nome`} position={[0,.45,0]} width={2.4} height={.2}/>
      <Label text={name || '_'} position={[0,.2,0]} width={2.4} height={.2}/>
      {'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map((char,i)=><Label key={char} text={char} position={[-1.1+(i%9)*.275,-Math.floor(i/9)*.2,0]} width={.24} height={.16} action={()=>setName(n=>(n+char).slice(0,18))}/>)}
      <Label text="ESPAÇO" position={[-.8,-.85,0]} width={.7} height={.18} action={()=>setName(n=>(n+' ').slice(0,18))}/>
      <Label text="APAGAR" position={[0,-.85,0]} width={.7} height={.18} action={()=>setName(n=>n.slice(0,-1))}/>
      <Label text="SALVAR" position={[.8,-.85,0]} width={.7} height={.18} color="#087c70" action={save}/>
    </group>}
  </group>;
}
