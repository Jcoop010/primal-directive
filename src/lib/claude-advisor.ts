/** Claude primary provider. Provider keys never reach the browser. */
import { normalizeCitationUrls } from "./ai-citations.ts";

type Msg = {role:string;content:string};
export async function claudeComplete(args:{apiKey:string;messages:Msg[];search:boolean}):Promise<Response>{
  const system=args.messages.filter(m=>m.role==="system").map(m=>m.content).join("\n\n");
  const history=args.messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"assistant" as const:"user" as const,content:m.content}));
  // Research is opt-in because server-side searches have an additional charge.
  // Max one search per question; no automatic retry or second paid provider.
  const tools=args.search && process.env.ANTHROPIC_WEB_SEARCH_ENABLED==="true"
    ? [{type:"web_search_20250305",name:"web_search",max_uses:1}] : undefined;
  if(args.search && !tools) return new Response(JSON.stringify({error:{message:"Verified research is not enabled."}}),{status:424});
  return fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"content-type":"application/json","x-api-key":args.apiKey,"anthropic-version":"2023-06-01"},
    body:JSON.stringify({model:process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",max_tokens:1024,temperature:0.2,system,messages:history, ...(tools?{tools}: {})}),
    signal:AbortSignal.timeout(45000)
  });
}

export function claudeCitations(body:Record<string,unknown>):string[]{
  const urls:unknown[]=[];
  const blocks=Array.isArray(body.content)?body.content as Array<Record<string,unknown>>:[];
  for(const block of blocks){
    const citations=Array.isArray(block.citations)?block.citations as Array<Record<string,unknown>>:[];
    for(const cite of citations) if(cite.type==="web_search_result_location" && typeof cite.url==="string") urls.push(cite.url);
  }
  return normalizeCitationUrls(urls);
}
