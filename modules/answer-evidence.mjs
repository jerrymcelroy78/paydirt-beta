import {evaluateAnswer as previousEvidence} from './previous-evidence.mjs';
/** CI269/271 question-specific, local practice signals. A closed clause grammar is
 * deliberately conservative: unrecognized clauses or mismatched intent => unknown.
 * This is not truth verification, broad semantics, mastery or a validated score.
 */
const reviewedPrompts={"SS-S-01": "Tell me about something you cooked that made you proud.", "SS-S-02": "Tell me about a mistake you made in culinary school.", "SS-S-03": "Describe a time you helped a classmate in the kitchen.", "SYT-S-01": "What culinary subjects did you study?", "SYT-S-02": "What did you practice most in lab?", "SYT-S-03": "What did hands-on school or lab practice add to your classroom training?", "FS-I-01": "Why should I keep talking to you after the first minute?", "FS-I-02": "Give me your best 30-second introduction.", "FS-I-03": "What do you want a chef to remember about you?", "SS-I-01": "Tell me about a dish that went wrong and how you recovered.", "SS-I-02": "Describe a time your station got busy during training.", "SS-I-03": "Tell me about feedback that changed how you cook.", "SYT-I-01": "How does your culinary education help you on day one?", "SYT-I-02": "What did lab work teach you that a textbook could not?", "SYT-I-03": "How would you explain your training without overstating your experience?"};
const VERSION='ci269-question-context-1';
const required={
 'FS-I-01':['value','training','procedure'], 'FS-I-02':['identity','training','goal'], 'FS-I-03':['remember','example','benefit'],
 'SS-S-01':['cooked','pride'], 'SS-S-02':['mistake','recovery','improved'], 'SS-S-03':['helpContext','helpAction','teamResult'],
 'SS-I-01':['mistake','recovery','improved'], 'SS-I-02':['pressure','prioritized','teamResult'], 'SS-I-03':['feedback','changed','improved'],
 'SYT-S-01':['subjects','practice','benefit'], 'SYT-S-02':['practiceFocus','practice','improved'], 'SYT-S-03':['handsOn','practice','transfer'],
 'SYT-I-01':['education','practice','procedure'], 'SYT-I-02':['handsOn','practice','transfer'], 'SYT-I-03':['honestContext','practice','limits']
};
// Exact brief responses are relevant but sparse signals for these non-exempt prompts.
// Their weakness is only a challenge heuristic, never an answer-quality judgment.
const brief={
 'FS-I-01':/^i can (?:prepare|chop) (?:the )?vegetables$/,
 'FS-I-02':/^i am a culinary (?:student|graduate)$/,
 'FS-I-03':/^i want to be remembered for (?:sanitation|careful prep)$/,
 'SS-I-01':/^i burned (?:the )?sauce and remade it$/,
 'SS-I-02':/^i prioritized prep when (?:our|my) station got busy$/,
 'SS-I-03':/^feedback helped me cut vegetables evenly$/
};
const rules=[];
const add=(pattern,tags)=>rules.push({re:new RegExp('^(?:'+pattern+')$'),tags:tags.split(' ')});
const context='(?:(?:in|during|at) (?:my |our |the )?(?:school kitchen|class|lab),? )?';
const food='(?:vegetable soup|soup|sauce|bread|vegetables)';
add(context+'i (?:prepared|cooked) (?:a |the )?'+food,'cooked');
add('i checked the recipe before cooking and tasted the '+food+' before serving','practice');
add('i was proud because the '+food+' was (?:balanced|ready|well seasoned) and my classmates enjoyed it','pride');
add(context+'(?:i burned the sauce|my sauce burned because the heat was too high)','mistake');
add('i told my instructor(?: about the mistake)? and started a (?:fresh|new) batch','recovery');
add('i reduced the heat and checked the pan (?:more often|frequently) so the (?:second batch|replacement sauce) was ready','improved');
add(context+'a classmate was behind on prep','helpContext');
add('i asked what help was needed and chopped the vegetables for their station','helpAction');
add('we checked the recipe together and finished the prep before service','teamResult');
add(context+'my station fell behind on prep','pressure');
add('i listed the remaining tasks and asked my instructor which task came first','prioritized');
add('i prepared the vegetables before plating and we finished the prep before service','teamResult');
add('my instructor said my vegetable pieces were uneven','feedback');
add('i slowed down and checked the sizes after each cut','changed');
add('after more practice the pieces were consistent and cooked evenly in the next class','improved');
add('i studied (?:sanitation, knife skills and baking|knife skills, baking and sanitation) at culinary school','subjects');
add(context+'i practiced safe food handling and measured ingredients for recipes','practice');
add('sanitation helped me organize a clean station and prevent cross contamination','benefit');
add('i practiced knife skills most often in lab','practiceFocus');
add('i chopped vegetables into even pieces and checked the sizes with my instructor','practice');
add('repeating the task helped me work more consistently while keeping my station organized','improved');
add('hands on lab practice helped me apply classroom lessons','handsOn');
add('i measured ingredients and adjusted the heat while cooking(?: a sauce)?','practice');
add('seeing the sauce change taught me when to (?:lower|reduce) the heat instead of only reading about it','transfer');
add('my culinary education gives me sanitation habits and knife skills for the first day','education');
add('i can organize a clean station and measure ingredients accurately','practice');
add('i would ask the chef to explain the kitchen procedures before starting','procedure');
add('lab work taught me to notice how a sauce changes with heat','handsOn');
add('watching the sauce thicken helped me connect the classroom lesson to an actual task','transfer');
add('my experience comes from culinary school and supervised lab practice','honestContext');
add('i practiced knife skills and sanitation with my instructor','practice');
add('i would describe those tasks accurately and ask for guidance with unfamiliar restaurant procedures','limits');
add('i can contribute careful prep and sanitation habits from culinary school','value');
add('i practiced knife skills in lab and checked my station before cooking','training');
add('i would ask the chef about priorities before starting work','procedure');
add('i am a culinary (?:student|graduate) with hands on school kitchen experience','identity');
add('i practiced knife skills and sanitation in lab','training');
add("i want to learn (?:this kitchen procedures|this kitchen's procedures|the kitchen procedures) and contribute reliable prep while asking for guidance",'goal');
add('i want the chef to remember my careful preparation and willingness to learn','remember');
add(context+'i checked the recipe before prep and asked my instructor to confirm portion sizes','example');
add('those habits helped me work consistently','benefit');
const wordsOf=t=>t.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)||[];
function canonical(text){return text.toLowerCase().replace(/’/g,"'").replace(/\bfood hygiene\b/g,'sanitation').replace(/\bteacher\b/g,'instructor').replace(/\bcarrots\b/g,'vegetables').replace(/\bmade\b/g,'prepared').replace(/\blowered\b/g,'reduced').replace(/\s+/g,' ').trim();}
export function evaluateAnswer(input={}){
 const {question,text,inputStatus,storyIntake}=input, id=question?.id;
 if(!required[id])return previousEvidence(input);
 const words=typeof text==='string'?wordsOf(text).length:0;
 const base={reviewed:true,version:VERSION,label:'practice estimate',words,contentAvailable:false,concreteDetail:'unknown',conciseAccepted:false,lengthWeaknessExempt:['availability','start-date','yes-no','safety-confirmation'].includes(question?.answerKind)};
 const out=(reason,extra={})=>({...base,reason,...extra});
 if(!question?.q||question.isFU)return out('unsupported-prompt');
 if(question.q!==reviewedPrompts[id])return out('prompt-version-mismatch');
 if(inputStatus!=='complete'||typeof text!=='string'||!text.trim())return out('missing-content');
 base.contentAvailable=true;
 if(/externship/i.test(question.q)&&storyIntake?.externshipConfirmed!==true)return out('experience-unverified');
 if(/four years/i.test(question.q)&&storyIntake?.fourYearsConfirmed!==true)return out('experience-unverified');
 const t=canonical(text);
 // Claimed negation/quotation/alternatives must not be erased before extracting positive actions.
 if(/["“”]/.test(t)||/\b(?:not|never|no|cannot|can't|didn't|don't|pretend|imagine)\b/.test(t))return out('ambiguous-negation-or-quotation');
 const bare=t.replace(/[.!]$/,'');
 if(brief[id]?.test(bare))return out('relevant-brief-response',{concreteDetail:'present'});
 const clauses=bare.split(/[.!]\s+/);if(new Set(clauses).size!==clauses.length)return out('repeated-clause');
 const tags=new Set();
 for(const clause of clauses){const found=rules.filter(r=>r.re.test(clause));if(!found.length)return out('unrecognized-clause');for(const r of found)for(const tag of r.tags)tags.add(tag);}
 if(!required[id].every(t=>tags.has(t)))return out('question-intent-not-established');
 return out('question-specific-action-evidence',{concreteDetail:'present',recognizedRelations:[...tags].sort()});
}
