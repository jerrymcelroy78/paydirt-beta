/** PAYDIRT Phase B: challenge selection, never mastery or completion assessment.
 * No network, clock, randomness, DOM or persistence side effects.
 * Evidence is supplied by a reviewed prompt adapter; legacy substring scores are not evidence.
 */
export const LEVELS = Object.freeze(['easy', 'steady', 'intensive', 'boot']);
export const POLICY = Object.freeze({version:'phase-b-1', strongWords:25, weakWords:10, lessonFraction:2/3, consecutiveLessons:2, minimumAnswers:3});
const levelOf = value => LEVELS.includes(value) ? value : 'steady';
export function initialChallengeState(level='steady') {
  return {version:POLICY.version, level:levelOf(level), manualRevision:0, streak:{signal:null,count:0}, lastAttemptKey:null, lastSequence:null};
}
export function normalizeChallengeState(value, fallback='steady') {
  if (!value || value.version !== POLICY.version || !LEVELS.includes(value.level)) return initialChallengeState(fallback);
  const state={version:POLICY.version,level:value.level,manualRevision:value.manualRevision,streak:{signal:value.streak?.signal,count:value.streak?.count},lastAttemptKey:value.lastAttemptKey,lastSequence:value.lastSequence};
  state.manualRevision=Number.isSafeInteger(state.manualRevision)&&state.manualRevision>=0?state.manualRevision:0;
  state.lastAttemptKey=typeof state.lastAttemptKey==='string'?state.lastAttemptKey:null;
  state.lastSequence=Number.isSafeInteger(state.lastSequence)&&state.lastSequence>=0?state.lastSequence:null;
  if (!['strong','weak'].includes(state.streak?.signal)||!Number.isInteger(state.streak.count)||state.streak.count<1||state.streak.count>=POLICY.consecutiveLessons) state.streak={signal:null,count:0};
  return state;
}
export function resetForManualMode(previous, level) {
  if (!LEVELS.includes(level)) throw new Error('Unknown existing challenge level');
  const state=normalizeChallengeState(previous,level);state.level=level;state.manualRevision++;state.streak={signal:null,count:0};return state;
}
export function classifyAnswer(answer) {
  if (!answer || answer.eligible !== true) return 'ineligible';
  if (answer.contentAvailable !== true || !Number.isInteger(answer.words) || answer.words < 0) return 'unknown';
  // Concise answers accepted by the reviewed question definition cannot be penalized for length.
  if (answer.conciseAccepted === true) return 'neutral';
  // CI271: exempt question kinds never supply weak evidence, even with absent detail.
  if (answer.lengthWeaknessExempt === true) return answer.concreteDetail === 'present' ? 'neutral' : 'unknown';
  if (!['present','absent'].includes(answer.concreteDetail)) return 'unknown';
  if (answer.words >= POLICY.strongWords && answer.concreteDetail === 'present') return 'strong';
  if ((answer.words < POLICY.weakWords && answer.lengthWeaknessExempt !== true) || answer.concreteDetail === 'absent') return 'weak';
  return 'neutral';
}
export function classifyLesson(answers=[]) {
  const signals=answers.map(classifyAnswer).filter(x=>x!=='ineligible');
  const counts={strong:0,weak:0,neutral:0,unknown:0};for(const signal of signals)counts[signal]++;
  // Keep at least the original three-answer evidence base; short/uncertain rounds do not auto-escalate.
  if (signals.length < POLICY.minimumAnswers || counts.unknown) return {signal:'unknown',eligible:signals.length,required:null,counts};
  const required=Math.ceil(signals.length*POLICY.lessonFraction);
  return {signal:counts.strong>=required?'strong':counts.weak>=required?'weak':'neutral',eligible:signals.length,required,counts};
}
export function decideAdaptation({previousState,currentLevel='steady',lessonId,attemptId,lessonKind='lesson',completed=true,explicitDifficulty=null,answerSignals=[],manualRevision,eventSequence}={}) {
  const state=normalizeChallengeState(previousState,currentLevel), from=state.level;
  const result=(reason,detail={})=>({from,nextLevel:state.level,changed:state.level!==from,reason,policyVersion:POLICY.version,nextState:state,...detail});
  if (typeof lessonId!=='string'||!lessonId||!Number.isSafeInteger(attemptId)||attemptId<1) return result('invalid-attempt');
  const key=JSON.stringify([lessonId,attemptId]);
  if(state.lastAttemptKey===key)return result('duplicate');
  if(state.lastSequence!==null&&eventSequence===undefined)return result('missing-sequence');
  if(eventSequence!==undefined&&(!Number.isSafeInteger(eventSequence)||eventSequence<0))return result('invalid-sequence');
  if(eventSequence!==undefined&&state.lastSequence!==null&&eventSequence<=state.lastSequence)return result('stale-event');
  state.lastAttemptKey=key; if(eventSequence!==undefined)state.lastSequence=eventSequence;
  if(manualRevision!==undefined&&manualRevision!==state.manualRevision){state.streak={signal:null,count:0};return result('manual-override');}
  let step=0,reason='hold';
  // CI-234: Just right permits conservative two-lesson inference; only directional requests override it.
  if(explicitDifficulty==='Too easy'||explicitDifficulty==='Too hard') {
    state.streak={signal:null,count:0};
    step=explicitDifficulty==='Too easy'?1:explicitDifficulty==='Too hard'?-1:0;reason='explicit-feedback';
  } else if(!completed||lessonKind==='measure') {
    state.streak={signal:null,count:0};return result(!completed?'incomplete-round':'fixed-measurement');
  } else {
    const evidence=classifyLesson(answerSignals),signal=evidence.signal;
    if(signal!=='strong'&&signal!=='weak'){state.streak={signal:null,count:0};return result('insufficient-or-mixed-evidence',{evidence});}
    const count=state.streak.signal===signal?state.streak.count+1:1;
    state.streak={signal,count};
    if(count<POLICY.consecutiveLessons)return result('await-consecutive-lesson',{evidence});
    step=signal==='strong'?1:-1;reason='consecutive-'+signal;state.streak={signal:null,count:0};
  }
  const index=LEVELS.indexOf(from);state.level=LEVELS[Math.max(0,Math.min(LEVELS.length-1,index+step))];
  return result(step&&state.level===from?'level-boundary':reason);
}
export function effectiveChallengeMode(modes, manualLevel, state) {
  const manual=levelOf(manualLevel), level=normalizeChallengeState(state,manual).level;
  return {...modes[level],level,perDay:modes[manual].perDay}; // Do not silently change the user's daily schedule.
}
export function allowBetweenQuestionAcknowledgement(level) { return !['intensive','boot'].includes(level); }
/** Integration boundary for the incoming reviewed bank/evaluator. Never infer detail from legacy m.spec. */
export function answerSignalFor(question, metrics, evidence=null) {
  const eligible=typeof question?.id==='string' && question.id.length>0 && question.challengeEligible===true && !['greet','close','rapid'].includes(question.t) && !question.isFU;
  const reviewed=evidence?.reviewed===true && typeof evidence.version==='string' && evidence.version.length>0;
  return {questionId:question?.id??null,eligible,words:metrics?.words,
    contentAvailable:reviewed&&evidence.contentAvailable===true,
    concreteDetail:reviewed&&['present','absent'].includes(evidence.concreteDetail)?evidence.concreteDetail:'unknown',
    lengthWeaknessExempt:['availability','start-date','yes-no','safety-confirmation'].includes(question?.answerKind),
    conciseAccepted:reviewed&&evidence.conciseAccepted===true,evidenceVersion:reviewed?evidence.version:null};
}
