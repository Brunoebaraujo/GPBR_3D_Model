export const TUTORIAL_STEPS = [
  {title:'Olhe ao redor',cue:'HEADSET  ↔',lines:['Vire a cabeça um pouco para um dos lados.','Você pode observar sem sair do lugar.']},
  {title:'Avance um pouco',cue:'DIREITO  ↑',lines:['Solte os gatilhos. Empurre o analógico direito para frente.','Solte o analógico para parar. Não precisa andar fisicamente.']},
  {title:'Volte um pouco',cue:'DIREITO  ↓',lines:['Puxe o analógico direito para trás.','Faça um movimento curto e solte para parar.']},
  {title:'Desloque para a direita',cue:'DIREITO  →',lines:['Empurre o analógico direito para a direita.','Você se desloca de lado, sem girar.']},
  {title:'Desloque para a esquerda',cue:'DIREITO  ←',lines:['Empurre o analógico direito para a esquerda.','Volte um pouco e solte para parar.']},
  {title:'Vire com o controle esquerdo',cue:'ESQUERDO  ↔',lines:['Mova o analógico esquerdo para um dos lados.','Para frente e para trás, ele também permite caminhar.']},
  {title:'Abra a prancheta',cue:'ESQUERDO  X',lines:['Segure o botão X do controle esquerdo.','Soltar X esconde a prancheta.']},
  {title:'Selecione na prancheta',cue:'SEGURE X  +  GATILHO DIREITO',lines:['Segure X e mire em “Concluir tutorial”.','Confirme com o gatilho direito. O analógico direito também seleciona.']},
] as const;
export type TutorialState={step:number;amount:number;headYaw:number|null;neutral:boolean};
// -2 closed, -1 invitation, 0..7 exercise, 8 completed.
export const tutorialState=(step=-2):TutorialState=>({step,amount:0,headYaw:null,neutral:false});
export type TutorialSample={headYaw:number;distance:number;turn:number;rightX:number;rightY:number;leftX:number;menu:boolean;dt:number;moving:boolean};
export function tutorialSample(state:TutorialState,s:TutorialSample):TutorialState {
  if(state.step<0 || state.step>=7 || !Object.values(s).every(v=>typeof v==='boolean'||Number.isFinite(v)))return state;
  if(state.step===0){
    if(state.headYaw===null)return {...state,headYaw:s.headYaw};
    const delta=Math.atan2(Math.sin(s.headYaw-state.headYaw),Math.cos(s.headYaw-state.headYaw));
    return Math.abs(delta)>.3?tutorialState(1):state;
  }
  if(state.step===6)return s.menu?tutorialState(7):state;
  const axis=state.step===5?s.leftX:state.step<=2?s.rightY:s.rightX;
  if(!state.neutral)return Math.abs(axis)<.18?{...state,neutral:true}:state;
  if(!s.moving || s.menu)return state;
  const correct=state.step===1||state.step===4?axis<-.3:state.step===5?Math.abs(axis)>.3:axis>.3;
  if(!correct)return state;
  const amount=state.amount+(state.step===5?Math.min(Math.abs(s.turn),.08):Math.min(s.distance,.08));
  return amount >= (state.step===5?.28:.22)?tutorialState(state.step+1):{...state,amount};
}
