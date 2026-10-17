import test from "node:test";
import assert from "node:assert/strict";
import { extractVenueProfile, sameVenue, officialVenueEvidence, researchStatus } from "../src/lib/venue-research.ts";

test("venue identity normalizes punctuation/accents but rejects unrelated rooms",()=>{
  assert.ok(sameVenue("Johnny Brenda’s", "Johnny Brenda's"));
  assert.ok(sameVenue("Thunderbird Café", "Thunderbird Cafe & Music Hall"));
  assert.equal(sameVenue("Club Cafe", "Thunderbird Cafe"),false);
});
test("dedicated profile works without a gigs array; each fact requires an exact cited page",()=>{
  const url="https://venue.example/booking/";
  const profile={venueResearch:{venue:"Johnny Brenda’s",city:"Philadelphia, PA",venueCapacity:"250",capacitySourceUrl:url,bookingContactName:"Fictional QA booker",bookingContactSourceUrl:"https://venue.example/other",bookingRoute:url}};
  const evidence=extractVenueProfile(profile,"Johnny Brenda's","Philadelphia",[url]);
  assert.equal(evidence.venueCapacity,250);assert.equal(evidence.bookingContactName,undefined);assert.equal(evidence.bookingRoute,url);
  assert.deepEqual(extractVenueProfile(profile,"Johnny Brenda's","Pittsburgh",[url]),{});
  assert.deepEqual(extractVenueProfile(profile,"Johnny Brenda's","Philadelphia",[]),{});
});
test("official extraction associates Music Hall capacity and booking form with their actual pages",()=>{
  const pages=[{url:"https://thunderbirdmusichall.com/aboutus/",html:"<p>Thunderbird Music Hall, at 520 capacity, represents the room.</p>"},{url:"https://thunderbirdmusichall.com/contact/",html:'<h2>Booking Contact Form</h2><iframe src="https://docs.google.com/forms/d/e/official/viewform"></iframe><p>contact@thunderbirdmusichall.com</p>'}];
  const e=officialVenueEvidence("Thunderbird Cafe",pages);
  assert.equal(e.venueCapacity,520);assert.equal(e.capacitySourceUrl,pages[0].url);assert.equal(e.bookingRoute,pages[1].url);assert.equal(e.bookingContactName,"Official booking contact form");
  assert.equal(researchStatus(e),"Verified");
  assert.deepEqual(officialVenueEvidence("Club Cafe",pages),{});
});
test("general emails are never promoted to booking contacts; removed claims stay unverified",()=>{
  const e=officialVenueEvidence("Johnny Brenda's",[{url:"https://johnnybrendas.com/menu-2-2/",html:"General inquiries info@johnnybrendas.com"}]);
  assert.deepEqual(e,{});assert.equal(researchStatus(e,true),"Research unavailable");
  assert.equal(researchStatus({bookingRoute:"https://venue.example/book"}),"Partially verified");
  assert.equal(researchStatus({}),"Not researched");
});
test("official talent buyer email survives Cloudflare obfuscation without inventing identity",()=>{
 const email="test-booker@example.invalid",key=19;
 const hex=key.toString(16).padStart(2,"0")+[...email].map(c=>(c.charCodeAt(0)^key).toString(16).padStart(2,"0")).join("");
 const html=`<p>Head Talent Buyer | <a data-cfemail="${hex}">[email protected]</a></p>`;
 const e=officialVenueEvidence("Johnny Brenda's",[{url:"https://johnnybrendas.com/menu-2-2/",html}]);
 assert.equal(e.bookingContactName,"Head Talent Buyer: "+email);
});
