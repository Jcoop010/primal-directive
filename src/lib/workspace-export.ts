/** Portable workspace records only; credentials, session and transient UI state are excluded. */
const fields=['profile','gigs','people','money','merchProducts','merchSales','merchOrders','merchInventoryAdjustments','merchRefunds','tasks','planning','chat'] as const;
export function workspaceExport(state:object, exportedAt=new Date().toISOString()) {
 const values=state as Record<string,unknown>;
 return {format:'primal-directive-workspace',schemaVersion:1,exportedAt,state:Object.fromEntries(fields.filter(key=>values[key]!==undefined).map(key=>[key,values[key]]))};
}
export function safeCsvCell(value:string) {
 const v=String(value??'');
 const formula=/^[\s]*[=+@-]/.test(v) && !(v.trim()!=='' && Number.isFinite(Number(v)));
 const safe=formula||/^[\t\r\n]/.test(v)?"'"+v:v;
 return '"'+safe.replace(/"/g,'""')+'"';
}
