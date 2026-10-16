import { z } from 'zod';
import type { ArtistProfile, Gig, Person, OperationalTask } from './types.ts';
import { validDay } from './workspace-intelligence.ts';

const url = z.union([z.literal(''), z.string().url().max(2000).refine(v => new URL(v).protocol === 'https:', 'Use an HTTPS source URL.')]);
const day = z.string().refine(v => !v || validDay(v), 'Enter a real calendar date.');
const amount = z.number().finite().min(0).max(100000000).optional();
export const bookingSchema = z.object({
  website: url.default(''), sourceUrl: url.default(''), checkedOn: day.default(''),
  capacity: z.number().int().positive().max(1000000).optional(), capacitySourceUrl: url.default(''), capacityCheckedOn: day.default(''),
  contactId: z.string().max(200).default(''), contactSourceUrl: url.default(''), contactCheckedOn: day.default(''),
  fitNote: z.string().max(1000).default(''), geographyNote: z.string().max(1000).default(''), marketNote: z.string().max(1000).default(''),
  distanceKm: amount, travelEstimate: amount, otherCostsEstimate: amount, revenueEstimate: amount,
  epkUrl: url.default(''), offerAmount: amount, offerNote: z.string().max(2000).default(''), followUpDate: day.default(''),
  log: z.array(z.object({id:z.string().max(200), date:day, kind:z.enum(['note','sent','reply','negotiation','advancement','post-show']), text:z.string().trim().min(1).max(3000)})).max(200).default([]),
});
export type BookingDetails = z.infer<typeof bookingSchema>;
export const emptyBooking = (): BookingDetails => bookingSchema.parse({});
const reviewed = (url:string, day:string, today:string) => Boolean(url && validDay(day) && day <= today);
export function evaluateOpportunity(gig:Gig, people:readonly Person[], today:string) {
  if(!validDay(today)) throw Error('A valid evaluation date is required.');
  const b = bookingSchema.parse(gig.booking ?? {});
  const contact = people.find(p=>p.id===b.contactId);
  const evidence = [
    {label:'Venue source reviewed',points:20,earned:reviewed(b.sourceUrl,b.checkedOn,today)},
    {label:'Linked contact and reviewed source',points:20,earned:Boolean(contact?.contact && reviewed(b.contactSourceUrl,b.contactCheckedOn,today))},
    {label:'Artist fit documented',points:15,earned:Boolean(b.fitNote.trim())},
    {label:'Geography documented',points:10,earned:Boolean(b.geographyNote.trim())},
    {label:'Market history documented',points:10,earned:Boolean(b.marketNote.trim())},
    {label:'Revenue and cost estimates entered',points:15,earned:[b.revenueEstimate,b.travelEstimate,b.otherCostsEstimate].every(v=>v!==undefined)},
    {label:'Next follow-up scheduled',points:10,earned:validDay(b.followUpDate)},
  ];
  const estimate = [b.revenueEstimate,b.travelEstimate,b.otherCostsEstimate].every(v=>v!==undefined)
    ? (Math.round(b.revenueEstimate!*100)-Math.round(b.travelEstimate!*100)-Math.round(b.otherCostsEstimate!*100))/100 : null;
  const next = !b.sourceUrl ? 'Record an official venue source' : !contact?.contact ? 'Identify and link a booking contact' : !b.fitNote.trim() ? 'Document artist-to-venue fit' : !b.followUpDate ? 'Schedule a next action' : b.followUpDate <= today ? 'Review the scheduled follow-up' : 'Prepare for the scheduled follow-up';
  return {details:b,contact,evidence,score:evidence.reduce((s,e)=>s+(e.earned?e.points:0),0),estimate,next,overdue:Boolean(b.followUpDate && b.followUpDate<today),capacityReviewed:reviewed(b.capacitySourceUrl,b.capacityCheckedOn,today)};
}
export function rankOpportunities(gigs:readonly Gig[], people:readonly Person[], today:string) {
  return gigs.filter(g=>['lead','outreach','negotiating','hold'].includes(g.status)).map(gig=>({gig,...evaluateOpportunity(gig,people,today)}))
    .sort((a,b)=>Number(b.overdue)-Number(a.overdue)||b.score-a.score||a.gig.id.localeCompare(b.gig.id));
}
export function bookingPitch(gig:Gig, profile:ArtistProfile, people:readonly Person[]) {
  const b=bookingSchema.parse(gig.booking??{}), contact=people.find(p=>p.id===b.contactId);
  return {subject: [profile.artistName||'Artist', 'booking inquiry', gig.venue||gig.name].join(' — '),
    body:[contact ? 'Hello '+contact.name+',' : 'Hello booking team,',
      'I’m reaching out on behalf of '+(profile.artistName||'[artist name]')+(profile.genre?' ('+profile.genre+')':'')+(profile.city?', based in '+profile.city:'')+'.',
      'We’d like to discuss a potential show at '+(gig.venue||gig.name)+'.'+(b.fitNote?' Our assessment of the fit: '+b.fitNote:''),
      profile.draw?'Our self-reported draw: '+profile.draw+'.':'',
      b.marketNote?'Our recorded market history: '+b.marketNote:'',b.epkUrl?'EPK: '+b.epkUrl:'',
      'Could you share the appropriate booking process, available windows, and terms? We have not assumed any date, availability, or guarantee.',
      'Thank you,\n'+(profile.artistName||'[artist name]')].filter(Boolean).join('\n\n')};
}
export function scheduleBookingFollowUp(tasks:OperationalTask[], gig:Gig, details:BookingDetails, id:string, now:string) {
  const key='outreach:'+gig.id+':followup';
  if(!details.followUpDate) return tasks.filter(t=>t.sourceKey!==key || t.status==='done');
  const existing=tasks.find(t=>t.sourceKey===key && t.status==='open');
  const task:OperationalTask={id:existing?.id??id,title:'Follow up: '+(gig.venue||gig.name),description:'Review booking conversation and prepare the next step. No message is sent automatically.',category:'booking',gigId:gig.id,dueDate:details.followUpDate,dueDateOverridden:true,status:'open',sourceKey:key,createdAt:existing?.createdAt??now};
  return existing?tasks.map(t=>t.id===existing.id?task:t):[task,...tasks];
}
