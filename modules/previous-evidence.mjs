/** CI-228: narrow local practice-estimate signals, not semantic or mastery assessment.
 * Entire clauses must match a contextual rule; an isolated kitchen word earns no credit.
 * Unsupported/ambiguous answers stay unknown. No service calls or raw-text persistence.
 */
const supported=new Set(['SS-S-01','SS-S-02','SS-S-03','SS-I-01','SS-I-02','SS-I-03','SS-BC-03','SYT-S-02','SYT-I-02','CI-S-01','CI-S-02','CI-I-01','CI-I-02','CI-I-03']);
const exemptKinds=new Set(['availability','start-date','yes-no','safety-confirmation']);
const wordCount=text=>(text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)||[]).length;
// Meaningful action/object relations, deliberately small coverage. All clauses must be recognized.
const actionRules=[
 /^(?:in my (?:school kitchen|lab),? )?i (?:prepared|washed|chopped) (?:the )?vegetables for (?:service|class)$/,
 /^i checked the recipe before (?:prep|service)$/,
 /^i asked my instructor to confirm the portion sizes$/,
 /^i organized my station before (?:prep|service)$/,
 /^i checked (?:the )?(?:food temperatures|temps) before service$/,
 /^i sanitized my station before (?:prep|service)$/,
 /^i read the tickets before (?:plating|service)$/,
 /^i checked my mise en place before service$/
];
export function evaluateAnswer({question,text,inputStatus,storyIntake}={}) {
 const words=typeof text==='string'?wordCount(text):0;
 const base={reviewed:true,version:'ci228-conservative-1',label:'practice estimate',words,contentAvailable:false,concreteDetail:'unknown',conciseAccepted:false,lengthWeaknessExempt:exemptKinds.has(question?.answerKind)};
 const out=(reason,detail={})=>({...base,reason,...detail});
 if(!question?.id||typeof question.q!=='string'||question.isFU)return out('unsupported-prompt');
 if(inputStatus!=='complete'||typeof text!=='string'||!text.trim())return out('missing-content');
 base.contentAvailable=true;
 // Exact structured intake evidence, never derive experience from an answer substring.
 if(/externship/i.test(question.q)&&storyIntake?.externshipConfirmed!==true)return out('experience-unverified');
 if(/four years/i.test(question.q)&&storyIntake?.fourYearsConfirmed!==true)return out('experience-unverified');
 const t=text.toLowerCase().replace(/’/g,"'").replace(/\s+/g,' ').trim();
 if(question.id==='FI-S-01'&&/^i (?:can start|am available from) (?:today|tomorrow|next monday|immediately)[.!]?$/.test(t))return out('concise-availability',{concreteDetail:'present',conciseAccepted:true});
 if(question.id==='CI-S-03'&&/^i (?:would )?ask (?:the chef|my instructor) to (?:clarify|explain)(?: the instruction)?[.!]?$/.test(t))return out('concise-clarification',{concreteDetail:'present',conciseAccepted:true});
 if(!supported.has(question.id))return out('unsupported-context');
 if(/^i (?:cannot|can't) think of an example[.!]?$/.test(t)&&question.id.startsWith('SS-'))return out('explicit-no-example',{concreteDetail:'absent'});
 const clauses=t.replace(/[.!]$/,'').split(/[.!]\s+/);
 // Duplicated clauses or unmatched additions (including negation/nonsense) cannot inflate evidence.
 if(new Set(clauses).size!==clauses.length||!clauses.length||!clauses.every(c=>actionRules.some(r=>r.test(c))))return out('ambiguous-or-unrecognized');
 // Narrative prompts need an explicit context and at least two distinct actions. This is still only a heuristic.
 if(question.id.startsWith('SS-')&&(!/^in my (?:school kitchen|lab)\b/.test(clauses[0])||clauses.length<2))return out('narrative-context-insufficient');
 return out('recognized-action-relations',{concreteDetail:'present',conciseAccepted:words<10});
}
