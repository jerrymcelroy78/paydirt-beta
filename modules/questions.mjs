// Stable content identifiers; no randomness, storage or network side effects.
export function questionId(question) {
  if (question && typeof question === 'object' && question.id) return question.id;
  return 'q:' + encodeURIComponent(String(question.q ?? question).normalize('NFC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en-US'));
}
export function chooseUnseen(pool, seen=[], limit=pool.length, allowReview=false) {
  const unique=[...new Map(pool.map(q=>[questionId(q),{...q,id:questionId(q)}])).values()];
  const used=new Set(seen), unseen=unique.filter(q=>!used.has(q.id));
  const exhausted=unseen.length===0;
  return {questions:(exhausted&&allowReview?unique:unseen).slice(0,limit),exhausted,review:exhausted&&allowReview,total:unique.length,unseen:unseen.length};
}
export function historicalQuestionIds(records=[],firstName='') {
  const seen=new Set();
  for(const r of records)if(r.kind==='lesson')for(const q of r.body?.items||[]){
    if(q.id){seen.add(q.id);continue;}
    let text=String(q.q||'');if(firstName)text=text.split(firstName).join('{name}');if(text)seen.add(questionId(text));
  }
  return [...seen];
}
export function shouldOfferBreathing({feel,nerves,difficulty}) {
  return difficulty!=='Too easy'&&(feel==='negative'||(Number.isFinite(nerves)&&nerves>=7));
}
