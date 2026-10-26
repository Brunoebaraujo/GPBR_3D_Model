import { useCallback, useRef, useState } from 'react';
import { tutorialSample, tutorialState, type TutorialSample } from '../utils/locomotionTutorial';
export function useLocomotionTutorial(){
  const [step,setStep]=useState(-2);
  const state=useRef(tutorialState()),offered=useRef(false);
  const go=useCallback((next:number)=>{state.current=tutorialState(next);setStep(next);},[]);
  const offer=useCallback(()=>{if(!offered.current){offered.current=true;if(state.current.step===-2)go(-1);}},[go]);
  const report=useCallback((sample:TutorialSample)=>{
    const next=tutorialSample(state.current,sample),changed=next.step!==state.current.step;
    state.current=next;if(changed)setStep(next.step);
  },[]);
  return {step,go,offer,report};
}
