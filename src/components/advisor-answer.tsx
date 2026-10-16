import { useState } from 'react';
import { readableAdvisorAnswer } from '@/lib/advisor-answer';

/** Render text as React nodes only; never execute provider HTML or links. */
export function AdvisorAnswer({text}:{text:string}) {
 const [expanded,setExpanded]=useState(false);
 const answer=readableAdvisorAnswer(text).answer || 'This response could not be displayed safely. Please ask again.';
 const long=answer.length>900;
 const preview=answer.slice(0,900).replace(/\s+\S*$/,'');
 const visible=long&&!expanded?preview+'…':answer;
 return <div><div className="space-y-3 break-words">{visible.split(/\n\s*\n/).map((paragraph,i)=><p key={i} className="whitespace-pre-wrap">{paragraph.replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1')}</p>)}</div>{long&&<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)} className="mt-3 min-h-11 rounded-md border border-line px-3 text-sm font-semibold text-accent">{expanded?'Show less':'Read full answer'}</button>}</div>;
}
