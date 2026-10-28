// Build-time verified manifests only. Never turn absent recordings into TTS or weaker-answer evidence.
const lessonByPrefix={BI:'baseline',FS:'first30',SS:'star',SYT:'training',CI:'check1',TPP:'panel2',CB:'curve',EAT:'everyday',FRP:'panel3',FI:'final'};
const tierByCode={S:'steady',I:'intensive',BC:'boot'};
export function bankIdentity(id){const m=/^([A-Z]+)-(S|I|BC)-(\d{2})$/.exec(id);if(!m||!lessonByPrefix[m[1]])return null;return{lessonId:lessonByPrefix[m[1]],tier:tierByCode[m[2]]};}
function verifiedLine(line,id){return line&&line.id===id&&line.verifiedBytes===true&&line.decoded===true&&line.releaseApproved===true&&typeof line.text==='string'&&line.text.trim()&&['dan','marisol','keisha','tony','ellen','jordan'].includes(line.character)&&/^audio\/[a-zA-Z0-9_-]+\.mp3$/.test(line.file)&&/^[a-f0-9]{64}$/.test(line.sha256)&&Number.isSafeInteger(line.bytes)&&line.bytes>0;}
export function readyBankItem(original,manifest,context={}){
 const identity=bankIdentity(original.id), main=manifest?.[original.id],fu=manifest?.[original.id+'-FU'];
 if(!identity||!verifiedLine(main,original.id)||!verifiedLine(fu,original.id+'-FU'))return null;
 if((main.requires||[]).some(k=>context[k]!==true)||(fu.requires||[]).some(k=>context[k]!==true))return null;
 // Release wording can differ only through explicit reviewed text in the recording manifest.
 return {...identity,id:original.id,q:main.text,by:main.character,audio:main.file,sha256:main.sha256,originalText:original.q,
 followUp:{id:fu.id,q:fu.text,by:fu.character,audio:fu.file,sha256:fu.sha256,originalText:original.followUp}};
}
export function selectBankRound(originals, manifest, {lessonId,tier,seen=[],context={}}) {
 const tiers=['steady','intensive','boot'],start=Math.max(0,tiers.indexOf(tier));
 const order=[...tiers].sort((a,b)=>Math.abs(tiers.indexOf(a)-start)-Math.abs(tiers.indexOf(b)-start)||tiers.indexOf(a)-tiers.indexOf(b));
 const used=new Set(seen), selected=[],changes=[];
 for(const candidateTier of order){
  for(const original of originals){
   const item=readyBankItem(original,manifest,context);
   if(!item||item.lessonId!==lessonId||item.tier!==candidateTier||used.has(item.id)||used.has(item.followUp.id))continue;
   selected.push(item);used.add(item.id);used.add(item.followUp.id);
   if(candidateTier!==tier)changes.push({pairId:item.id,requestedTier:tier,selectedTier:candidateTier,reason:'unseen adjacent-tier pair'});
   if(selected.length===3)break;
  }
  if(selected.length===3)break;
 }
 return {pairs:selected,questions:selected.flatMap(x=>[{id:x.id,q:x.q,by:x.by,bank:true,t:'short',challengeEligible:true,audio:x.audio},{...x.followUp,bank:true,isFU:true,t:'short',challengeEligible:false}]),tierChanges:changes,exhausted:selected.length===0,partial:selected.length>0&&selected.length<3};
}
