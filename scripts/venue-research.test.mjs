import test from "node:test";
import assert from "node:assert/strict";
import { extractVenueProfile, sameVenue, officialVenueEvidence, researchStatus, venueSourceLinks } from "../src/lib/venue-research.ts";

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
  assert.equal(e.venueCapacity,520);assert.equal(e.capacitySourceUrl,pages[0].url);assert.equal(e.bookingRoute,pages[1].url);assert.equal(e.bookingContactName,"Booking contact form");
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
 const html=`<h1>Johnny Brenda’s</h1><p>Head Talent Buyer | <a data-cfemail="${hex}">[email protected]</a></p>`;
 const e=officialVenueEvidence("Johnny Brenda's",[{url:"https://johnnybrendas.com/menu-2-2/",html}]);
 assert.equal(e.bookingContactName,"Head Talent Buyer: "+email);
});

test("fetched evidence works for previously unknown venues and refuses conflicting room sizes", () => {
 const about={url:"https://fictional-venue.example/about",html:"<h1>Fictional Lantern Room — Test City</h1><p>A 180-person live music venue.</p>"};
 const booking={url:"https://fictional-venue.example/contact",html:"<h1>Booking contact</h1><p>Head Talent Buyer | fictional-booker@example.invalid</p>"};
 const result=officialVenueEvidence("Fictional Lantern Room",[about,booking],"Test City, NY");
 assert.equal(result.venueCapacity,180);
 assert.equal(result.bookingContactName,"Head Talent Buyer: fictional-booker@example.invalid");
 assert.equal(result.bookingRoute,booking.url);
 assert.equal(officialVenueEvidence("Fictional Lantern Room",[about,booking],"Another City").venueCapacity,undefined);
 assert.equal(officialVenueEvidence("Fictional Lantern Room",[{...about,html:about.html+" <p>Also a 90-person side room.</p>"},booking]).venueCapacity,undefined);
 const links=venueSourceLinks({...about,html:'<a href="/booking">Booking</a><a href="https://elsewhere.example/contact">External contact</a><a href="javascript:alert(1)">Booking</a><a href="/newsletter">Subscribe</a>'});
 assert.deepEqual(links,["https://fictional-venue.example/booking"]);
});
test("multiword cities are compared completely rather than by their first word", () => {
 const url="https://fictional.example/booking";
 assert.deepEqual(extractVenueProfile({venueResearch:{venue:"Fictional Hall",city:"New Orleans",bookingRoute:url}},"Fictional Hall","New York",[url]),{});
});
