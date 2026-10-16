import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyBooking,evaluateOpportunity,rankOpportunities,bookingPitch,scheduleBookingFollowUp,bookingSchema} from '../src/lib/booking-intelligence.ts';
import {readableAdvisorAnswer} from '../src/lib/advisor-answer.ts';
const gig={id:'g1',name:'Opportunity',venue:'Example Room',city:'Example City',date:'',fee:999999,conf:1,status:'lead',notes:'Research source: https://example.org/'};
const person={id:'p1',name:'Saved Booker',role:'booker',city:'',contact:'User-entered channel',notes:''};
test('confidence, arbitrary note URLs and listed fee do not manufacture readiness or profit',()=>{
 const row=evaluateOpportunity(gig,[person],'2026-10-15');assert.equal(row.score,0);assert.equal(row.estimate,null);assert.equal(row.contact,undefined);assert.equal(row.capacityReviewed,false);
});
test('score explains every contribution and rejects future reviews or missing inputs',()=>{
 const booking={...emptyBooking(),sourceUrl:'https://example.org/booking',checkedOn:'2026-10-15',contactId:'p1',contactSourceUrl:'https://example.org/team',contactCheckedOn:'2026-10-15',fitNote:'Saved assessment',geographyNote:'Same region',marketNote:'User-recorded past show',revenueEstimate:1000,travelEstimate:150,otherCostsEstimate:250,followUpDate:'2026-10-16'};
 const r=evaluateOpportunity({...gig,booking},[person],'2026-10-15');assert.equal(r.score,100);assert.equal(r.estimate,600);assert.equal(r.evidence.reduce((s,e)=>s+(e.earned?e.points:0),0),r.score);
 assert.equal(evaluateOpportunity({...gig,booking:{...booking,travelEstimate:undefined}},[person],'2026-10-15').estimate,null);
 assert.equal(evaluateOpportunity({...gig,booking:{...booking,checkedOn:'2026-10-16'}},[person],'2026-10-15').score,80);
 assert.equal(evaluateOpportunity({...gig,booking:{...booking,travelEstimate:1100,otherCostsEstimate:0}},[person],'2026-10-15').estimate,-100);
});
test('follow-up task updates without duplicates, can clear open reminder and preserves completed history',()=>{
 const details={...emptyBooking(),followUpDate:'2026-10-17'};
 let tasks=scheduleBookingFollowUp([],gig,details,'t1','2026-10-15');assert.equal(tasks.length,1);assert.equal(tasks[0].gigId,'g1');
 tasks=scheduleBookingFollowUp(tasks,gig,{...details,followUpDate:'2026-10-18'},'t2','2026-10-16');assert.equal(tasks.length,1);assert.equal(tasks[0].id,'t1');assert.equal(tasks[0].dueDate,'2026-10-18');
 assert.equal(scheduleBookingFollowUp(tasks,gig,emptyBooking(),'t3','2026-10-16').length,0);
 tasks[0].status='done';assert.equal(scheduleBookingFollowUp(tasks,gig,emptyBooking(),'t3','2026-10-16').length,1);
});
test('outreach pitch uses saved artist and contact without invented deal terms',()=>{
 const p=bookingPitch({...gig,booking:{...emptyBooking(),contactId:'p1',epkUrl:'https://example.org/epk'}},{artistName:'Real Saved Artist',city:'Home City',genre:'Rock',draw:'50 self-reported',feeTarget:2000,notes:''},[person]);
 assert.match(p.body,/Saved Booker/);assert.match(p.body,/Real Saved Artist/);assert.match(p.body,/https:\/\/example.org\/epk/);assert.doesNotMatch(p.body,/999999|2000|confirmed booking/);
 assert.equal(rankOpportunities([{...gig,status:'booked'},gig],[],'2026-10-15').length,1);
});
test('untrusted evidence and malformed money/date inputs are rejected',()=>{
 for(const patch of [{website:'javascript:alert(1)'},{sourceUrl:'http://example.org'},{followUpDate:'2026-02-30'},{travelEstimate:NaN},{capacity:1.2}]) assert.equal(bookingSchema.safeParse({...emptyBooking(),...patch}).success,false);
});
test('incomplete source URLs during typing do not crash qualification or pitch rendering',()=>{
 const draft={...emptyBooking(),website:'htt',sourceUrl:'https:',checkedOn:'2026-10-15',epkUrl:'https:/'};
 assert.equal(evaluateOpportunity({...gig,booking:draft},[],'2026-10-15').score,0);
 assert.doesNotThrow(()=>bookingPitch({...gig,booking:draft},{artistName:'Saved',city:'',genre:'',draw:'',feeTarget:0,notes:''},[]));
 assert.equal(bookingSchema.safeParse(draft).success,false);
});
test('answer rendering unwraps nested JSON, deduplicates prose and rejects broken envelopes',()=>{
 assert.equal(readableAdvisorAnswer('{"answer":"Good advice","gigs":[]}').answer,'Good advice');
 assert.equal(readableAdvisorAnswer(JSON.stringify({answer:JSON.stringify({answer:'Once'})})).answer,'Once');
 assert.equal(readableAdvisorAnswer('One.\n\nOne.').answer,'One.');assert.equal(readableAdvisorAnswer('{"answer":"bad"').answer,'');
 assert.equal(readableAdvisorAnswer('```json\n{"answer":"Clean"}\n```').answer,'Clean');
});
