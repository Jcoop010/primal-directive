import { geminiFailure } from "../src/lib/gemini-failure.ts";
import {createHash} from "node:crypto";

// Explicit diagnostic build only. Never print a key, raw provider message or user data.
// Always fail this build after reporting so it can never replace production.
const key = process.env.GEMINI_API_KEY?.trim();
if (!key) { console.log("[gemini-probe]",JSON.stringify({kind:"missing_production_key"})); process.exit(1); }
console.log("[gemini-probe]",JSON.stringify({keySuffix:key.slice(-4),keyFingerprint:createHash("sha256").update(key).digest("hex").slice(0,12),model:"gemini-3.1-flash-lite",search:false}));
try {
 const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",{
  method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},
  signal:AbortSignal.timeout(20000),
  body:JSON.stringify({contents:[{parts:[{text:"Respond with the word READY."}]}],generationConfig:{temperature:0,maxOutputTokens:32}})
 });
 const body=await response.json().catch(()=>({}));
 if (!response.ok) {
  const failure=geminiFailure(response.status,body);
  console.log("[gemini-probe]",JSON.stringify({status:response.status,...failure}));
 } else {
  const ready=(body.candidates??[]).flatMap(c=>c.content?.parts??[]).map(p=>p.text??"").join("").trim();
  console.log("[gemini-probe]",JSON.stringify({status:response.status,ready:ready==="READY",finishReason:body.candidates?.[0]?.finishReason}));
  if (ready==="READY") {
   const jsonResponse=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",{
    method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},
    signal:AbortSignal.timeout(20000),
    body:JSON.stringify({contents:[{parts:[{text:'Return JSON with answer equal to READY.'}]}],generationConfig:{temperature:0,maxOutputTokens:64,responseMimeType:"application/json"}})
   });
   const jsonBody=await jsonResponse.json().catch(()=>({}));
   const text=(jsonBody.candidates??[]).flatMap(c=>c.content?.parts??[]).map(p=>p.text??"").join("");
   let structured=false; try { structured=JSON.parse(text).answer==="READY"; } catch {}
   console.log("[gemini-probe]",JSON.stringify({test:"structured_output",status:jsonResponse.status,structured,...(!jsonResponse.ok ? geminiFailure(jsonResponse.status,jsonBody) : {})}));
  }
 }
} catch { console.log("[gemini-probe]",JSON.stringify({kind:"network_or_timeout"})); }
console.log("[gemini-probe] Diagnostic complete. Intentional build stop; production must remain unchanged.");
process.exit(1);
