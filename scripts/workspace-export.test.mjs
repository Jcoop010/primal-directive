import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceExport,safeCsvCell} from '../src/lib/workspace-export.ts';
test('workspace export includes operational data and excludes session, credentials and UI state',()=>{
 const result=workspaceExport({profile:{artistName:'Saved artist'},gigs:[{booking:{log:[{text:'Saved conversation'}]}}],planning:{goals:[{title:'Saved goal'}]},chat:[{text:'Saved reply'}],session:{token:'secret'},apiKey:'secret',composer:{open:true}},'2026-10-15T12:00:00Z');
 assert.equal(result.schemaVersion,1);assert.equal(result.state.gigs[0].booking.log[0].text,'Saved conversation');assert.match(JSON.stringify(result),/Saved goal/);assert.doesNotMatch(JSON.stringify(result),/secret|composer|session|apiKey/);
});
test('CSV exports neutralize formulas without changing negative numeric records',()=>{
 for(const value of ['=HYPERLINK("https://example.org")','+SUM(1,2)','-SUM(1,2)','@SUM(1,2)','  =1+1','\tformula'])assert.ok(safeCsvCell(value).startsWith('"\''));
 assert.equal(safeCsvCell('-12.50'),'"-12.50"');assert.equal(safeCsvCell('A, "quoted" room'),'"A, ""quoted"" room"');
});
