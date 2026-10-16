// Best-effort per warm server instance. Provider account budgets remain the hard cost boundary.
const windows=new Map<string,{start:number;count:number}>();
export function allowAdvisorRequest(owner:string,now=Date.now()) {
 let window=windows.get(owner);
 if(!window || now-window.start>=60000) {
  if(windows.size>=1000) windows.delete(windows.keys().next().value!);
  window={start:now,count:0};windows.set(owner,window);
 }
 if(window.count>=12)return false;
 window.count++;return true;
}
export function boundAdvisorContext(value:string,limit=12000) {
 return value.length<=limit?value:value.slice(0,limit)+'\n[Context excerpt truncated. Omitted records must not be assumed absent.]';
}
