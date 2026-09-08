import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { a as PERSON_ROLES, t as GIG_STATUSES } from "./types-C-o5cF1n.mjs";
import { a as object, i as number, n as array, o as string, t as _enum } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-CkPNf4ip.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function shift(days) {
	const d = /* @__PURE__ */ new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}
function localGrowthAdvice(message, context) {
	const q = message.toLowerCase();
	const home = pick(context, /HOME:\s*(.+)/) || "your home city";
	const artist = pick(context, /ARTIST:\s*(.+)/) || "the band";
	const genre = pick(context, /GENRE:\s*(.+)/) || "your sound";
	const draw = pick(context, /TYPICAL DRAW:\s*(.+)/) || "your current draw";
	const fee = pick(context, /FEE TARGET:\s*(.+)/) || "your fee target";
	if (/(bill|support|3-band|three band|lineup|share a bill)/.test(q)) return billAdvice(artist, home, genre, draw);
	if (/(rout|northeast|tour|cluster|drive)/.test(q)) return routingAdvice(artist, home);
	if (/(post|content|tiktok|instagram|social|video)/.test(q)) return contentAdvice(artist, home);
	if (/(venue|room|book|gig|guarantee|club)/.test(q)) return venueAdvice(artist, home, draw, fee);
	return drawAdvice(artist, home, genre, draw, fee);
}
function drawAdvice(artist, home, genre, draw, fee) {
	return {
		source: "MUSICIAN OS PLAYBOOK",
		answer: `${artist} will not grow a ${draw} ${genre} draw by chasing bigger rooms. Own ${home} first.

Play the 100–250 cap rooms on a cadence — monthly, not quarterly — so the same faces see you twice. Club Cafe, Thunderbird, and a walk-up like Brillobox are the right size. Mr. Smalls is a stretch hold: it converts when you walk in with a finished bill, not a hope.

The next 90 days: (1) convert the Club Cafe remainder into cash this week, (2) lock a Copper Wires co-bill in Morgantown and reverse-host them in Pittsburgh, (3) treat Purple Fiddle as a merch + email-capture night, not a one-off mountain story.

Fee target ${fee} is realistic for a packed 150-cap, not an empty 400-cap. Grow the list, then the room.`,
		gigs: [{
			name: "Weeknight hometown cadence",
			venue: "Brillobox",
			city: "Pittsburgh, PA",
			date: shift(21),
			fee: 500,
			conf: .45,
			reason: "Walk-up 100-cap. Use it to rehearse a monthly hometown slot.",
			status: "lead"
		}, {
			name: "Reverse-host Copper Wires",
			venue: "Thunderbird Cafe",
			city: "Pittsburgh, PA",
			date: shift(35),
			fee: 750,
			conf: .4,
			reason: "Pay back the Morgantown routing night with a Pittsburgh bill.",
			status: "lead"
		}],
		people: [{
			name: "The Copper Wires",
			role: "band",
			city: "Morgantown, WV",
			detail: "Jam-adjacent co-bill",
			reason: "Easy overnight and overlapping audience."
		}],
		moves: [
			"Send Maya Chen a one-sheet + 3 live videos before Club Cafe.",
			"Text Copper Wires to lock a two-city swap.",
			"Put a list-capture on the Purple Fiddle merch table."
		]
	};
}
function billAdvice(artist, home, genre, draw) {
	return {
		source: "MUSICIAN OS PLAYBOOK",
		answer: `A 250-cap bill for ${artist} (${genre}, draw ${draw}, home ${home}) should stack audiences, not friends.

1. ${artist} — hometown headliner or high support.
2. The Copper Wires (Morgantown) — jam-adjacent, overlapping fans, makes the WV routing real.
3. Hollow Oak (Columbus) — americana four-piece that pulls 150–250. They make the Ohio jump worth the van.

Do not put three local same-scene bands on one bill. You cannibalize one crowd. Offer this package to Dana Ortiz at Mr. Smalls so the negotiating hold has a reason to become a guarantee.`,
		gigs: [{
			name: "Packaged 3-band bill",
			venue: "Mr. Smalls Theatre",
			city: "Millvale, PA",
			date: shift(29),
			fee: 1500,
			conf: .6,
			reason: "Walk in with Copper Wires + Hollow Oak already penciled.",
			status: "negotiating"
		}],
		people: [{
			name: "Dana Ortiz",
			role: "booker",
			city: "Millvale, PA",
			detail: "Mr. Smalls",
			reason: "Responds to a finished bill, not a lone ask."
		}, {
			name: "Hollow Oak",
			role: "band",
			city: "Columbus, OH",
			detail: "Americana four-piece",
			reason: "Fills the 150–250 gap and opens Ohio routing."
		}],
		moves: ["Email Dana the three-band package with dates and draws.", "Ask Hollow Oak for two Ohio dates around the Pittsburgh night."]
	};
}
function routingAdvice(artist, home) {
	return {
		source: "MUSICIAN OS PLAYBOOK",
		answer: `Do not drive six hours from ${home} for Johnny Brenda's as a one-off. ${artist} needs a cluster.

Northeast cluster (3–4 nights):
• Philadelphia — Johnny Brenda's (already in the pipeline)
• Baltimore — The Ottobar or a 150–200 cap room
• One Hudson Valley / NYC support if a bill appears — otherwise skip it

West/south cluster:
• Morgantown — 123 Pleasant Street (already in outreach)
• Thomas, WV — Purple Fiddle (booked, merch-heavy)
• Columbus — attach Hollow Oak

Rule: two rooms within 3 hours or it does not leave the driveway. Ask Stage Left Booking for a Philly week only if you can add a second night.`,
		gigs: [{
			name: "Baltimore cluster night",
			venue: "The Ottobar",
			city: "Baltimore, MD",
			date: shift(64),
			fee: 900,
			conf: .3,
			reason: "Pairs with Johnny Brenda's so Philly is not a one-off.",
			status: "lead"
		}],
		people: [{
			name: "Stage Left Booking",
			role: "promoter",
			city: "Philadelphia, PA",
			detail: "Philly / NYC / Hudson",
			reason: "Only useful if you offer 2–3 dates, not one."
		}],
		moves: ["Hold Johnny Brenda's only if a second Mid-Atlantic night is real.", "Finish the Morgantown outreach so the WV weekend is a loop."]
	};
}
function contentAdvice(artist, home) {
	return {
		source: "MUSICIAN OS PLAYBOOK",
		answer: `Content that sells tickets for ${artist} is footage of rooms people can actually walk into in ${home} — not studio aesthetic.

This month:
• Purple Fiddle (booked) — 3 vertical clips the night of, geotag Thomas + Pittsburgh. Ask people to tap for the Club Cafe date.
• Club Cafe (booked) — one 45-second live song, one merch-table talk-to-camera: “we’re back here on [date], bring one friend.”
• One-sheet video for Dana Ortiz / Maya Chen: 3 clips, 60 seconds, no preamble.

Kill anything that does not point at a date, a list, or a merch SKU. Streams are a souvenir; the list is the business.`,
		gigs: [],
		people: [{
			name: "Maya Chen",
			role: "booker",
			city: "Pittsburgh, PA",
			detail: "Club Cafe",
			reason: "She books off a one-sheet + recent live video, not DMs."
		}],
		moves: ["Make a 60-second one-sheet video before the next booker email.", "Put a QR to the email list on the merch table this week."]
	};
}
function venueAdvice(artist, home, draw, fee) {
	return {
		source: "MUSICIAN OS PLAYBOOK",
		answer: `Rooms that fit ${artist} at draw ${draw} out of ${home}:

Right now: Club Cafe, Thunderbird, Brillobox, 123 Pleasant Street, Purple Fiddle.
Next: Mr. Smalls only with a packaged bill. Johnny Brenda's only inside a cluster.

Guarantees: ${fee} is the hometown target. Door deals are fine on weeknights if merch is strong. Do not take a $200 “exposure” night in a 400-cap.

Follow up the Thunderbird lead with Eli this week. A weeknight showcase is how ${home} draw actually compounds.`,
		gigs: [{
			name: "Weeknight showcase follow-up",
			venue: "Thunderbird Cafe",
			city: "Pittsburgh, PA",
			date: shift(45),
			fee: 700,
			conf: .4,
			reason: "Eli’s showcase slot — send a one-sheet, not a generic EPK.",
			status: "outreach"
		}],
		people: [{
			name: "Eli Brooks",
			role: "promoter",
			city: "Pittsburgh, PA",
			detail: "Weeknight showcases",
			reason: "The shortest path to a monthly hometown slot."
		}],
		moves: [`Email Eli a one-sheet this week asking for a month-out showcase.`, "Keep Mr. Smalls in negotiating until the 3-band package is attached."]
	};
}
function pick(context, re) {
	return context.match(re)?.[1]?.trim();
}
var HistoryItem = object({
	role: _enum(["user", "ai"]),
	text: string()
});
var Input = object({
	message: string().min(1).max(2e3),
	history: array(HistoryItem).max(10),
	context: string().max(4500)
});
var GigOut = object({
	name: string(),
	venue: string().default(""),
	city: string().default(""),
	date: string().default(""),
	fee: number().default(0),
	conf: number().min(0).max(1).default(.4),
	reason: string().default(""),
	status: _enum(GIG_STATUSES).optional()
});
var PersonOut = object({
	name: string(),
	role: _enum(PERSON_ROLES).default("other"),
	city: string().default(""),
	detail: string().default(""),
	reason: string().default("")
});
var AiJson = object({
	answer: string(),
	gigs: array(GigOut).optional(),
	people: array(PersonOut).optional(),
	moves: array(string()).optional()
});
var SYSTEM = `You are Musician OS — a blunt, practical band-growth advisor for independent artists.

You search the live web (venues, recent bills, press, playlists, city scenes, touring patterns, typical guarantees) and combine it with the artist's pipeline.

Your job is growth, not vibes:
- Local draw and how to raise it
- Booking rooms that actually fit the draw
- Building bills and finding compatible acts
- Routing clusters so one-off 6-hour drives die
- Content, email list, merch, press — only when they move tickets or fees
- Realistic guarantees vs. door deals
- What to do THIS WEEK

Rules:
- Be specific: name real rooms, cities, acts, publications, or tactics when the web supports it. If you are not sure, say so.
- Do not invent sold-out shows, fake contacts, or fake phone numbers.
- Prefer 3 sharp moves over 12 generic tips.
- Match advice to the artist's draw, genre, and home city.
- Fees should be plausible for the room size and draw.
- Dates use YYYY-MM-DD. If unknown, "".
- Confidence is 0–1.

Always reply as a single JSON object (no markdown fences):
{
  "answer": "plain text, short paragraphs, line breaks ok. No markdown headings.",
  "gigs": [ { "name", "venue", "city", "date", "fee", "conf", "reason", "status" } ],
  "people": [ { "name", "role", "city", "detail", "reason" } ],
  "moves": ["one-line next action"]
}

gigs/people only when you have concrete rooms or contacts worth putting in a pipeline. 0–4 each. role must be one of: band, booker, promoter, venue, manager, press, other. status one of: lead, outreach, negotiating, hold, booked, completed, passed.
moves: 0–3 very short actions.`;
function extractJson(raw) {
	const trimmed = raw.trim();
	const candidate = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() || trimmed;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");
	if (start === -1 || end === -1) return null;
	try {
		return JSON.parse(candidate.slice(start, end + 1));
	} catch {
		return null;
	}
}
function citationsFrom(body) {
	const bags = [];
	if (Array.isArray(body.citations)) bags.push(...body.citations);
	const msgCites = body.choices?.[0]?.message?.citations;
	if (Array.isArray(msgCites)) bags.push(...msgCites);
	const urls = [];
	for (const item of bags) if (typeof item === "string" && item.startsWith("http")) urls.push(item);
	else if (item && typeof item === "object" && "url" in item) {
		const u = item.url;
		if (typeof u === "string") urls.push(u);
	}
	return [...new Set(urls)].slice(0, 6);
}
async function complete(args) {
	const body = {
		model: "grok-4.5",
		messages: args.messages,
		temperature: .6,
		max_tokens: 1100
	};
	if (args.search) body.search_parameters = {
		mode: "on",
		return_citations: true,
		max_search_results: 8,
		sources: [{ type: "web" }, { type: "news" }]
	};
	return await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${args.apiKey}`
		},
		body: JSON.stringify(body)
	});
}
var askGrowthAdvisor_createServerFn_handler = createServerRpc({
	id: "fe5cf2d238b1d227b07f5f0cc7dfb8433122c64422ea5ba88be0d92bed669444",
	name: "askGrowthAdvisor",
	filename: "src/lib/ai.ts"
}, (opts) => askGrowthAdvisor.__executeServer(opts));
var askGrowthAdvisor = createServerFn({ method: "POST" }).validator((input) => Input.parse(input)).handler(askGrowthAdvisor_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	const fallback = () => {
		const local = localGrowthAdvice(data.message, data.context);
		return {
			ok: true,
			answer: local.answer,
			source: local.source,
			citations: [],
			gigs: local.gigs,
			people: local.people,
			moves: local.moves
		};
	};
	if (!apiKey) return fallback();
	const messages = [
		{
			role: "system",
			content: SYSTEM
		},
		{
			role: "system",
			content: `Today is ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.\n\nARTIST CONTEXT:\n${data.context}`
		},
		...data.history.slice(-8).map((h) => ({
			role: h.role === "ai" ? "assistant" : "user",
			content: h.text
		})),
		{
			role: "user",
			content: data.message
		}
	];
	let res = await complete({
		apiKey,
		messages,
		search: true
	});
	if (!res.ok) res = await complete({
		apiKey,
		messages,
		search: false
	});
	if (!res.ok) return fallback();
	const body = await res.json();
	const raw = body.choices?.[0]?.message?.content ?? "";
	const parsed = extractJson(raw);
	const safe = parsed ? AiJson.safeParse(parsed) : null;
	const citations = citationsFrom(body);
	const source = citations.length ? "LIVE WEB SEARCH" : "MUSICIAN OS";
	if (safe?.success) {
		const gigs = (safe.data.gigs ?? []).slice(0, 4).map((g) => ({
			name: g.name,
			venue: g.venue,
			city: g.city,
			date: g.date,
			fee: g.fee,
			conf: g.conf,
			reason: g.reason,
			status: g.status
		}));
		const people = (safe.data.people ?? []).slice(0, 4).map((p) => ({
			name: p.name,
			role: p.role,
			city: p.city,
			detail: p.detail,
			reason: p.reason
		}));
		return {
			ok: true,
			answer: safe.data.answer,
			source,
			citations,
			gigs,
			people,
			moves: (safe.data.moves ?? []).slice(0, 3)
		};
	}
	return {
		ok: true,
		answer: raw || "No answer returned.",
		source,
		citations,
		gigs: [],
		people: [],
		moves: []
	};
});
//#endregion
export { askGrowthAdvisor_createServerFn_handler };
