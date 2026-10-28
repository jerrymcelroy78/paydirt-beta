import {decideAdaptation as coreDecision} from './core.mjs';
export * from './core.mjs';
/** CI-228 accepted feedback-managed floor. Explicit manual Easy remains available. */
export function decideAdaptation(input, {manualLevel}={}) {
 if(!['easy','steady','intensive','boot'].includes(manualLevel))throw new Error('Manual level required for accepted floor policy');
 const result=coreDecision(input);
 if(manualLevel!=='easy'&&result.from==='steady'&&result.nextLevel==='easy')return {...result,nextLevel:'steady',changed:false,reason:'steady-floor',nextState:{...result.nextState,level:'steady'}};
 return result;
}
