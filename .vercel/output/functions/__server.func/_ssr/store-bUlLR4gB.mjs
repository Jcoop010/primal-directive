import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-bUlLR4gB.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function uid() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
	return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function parseDay(iso) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function toIsoDay(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(from, days) {
	const next = new Date(from);
	next.setDate(next.getDate() + days);
	return next;
}
function money(n, digits = 0) {
	return n.toLocaleString(void 0, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: digits,
		minimumFractionDigits: digits
	});
}
function longDate(iso) {
	if (!iso) return "TBD";
	return parseDay(iso).toLocaleDateString(void 0, {
		weekday: "short",
		month: "short",
		day: "numeric"
	});
}
function todayLabel() {
	return (/* @__PURE__ */ new Date()).toLocaleDateString(void 0, {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric"
	});
}
function hostFromUrl(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}
function downloadCsv(filename, rows) {
	const csv = rows.map((row) => row.map((cell) => {
		const v = String(cell ?? "");
		if (/[",\n]/.test(v)) return `"${v.replace(/"/g, "\"\"")}"`;
		return v;
	}).join(",")).join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
function createSeed() {
	const today = /* @__PURE__ */ new Date();
	const gigs = [
		{
			id: uid(),
			name: "Saturday night support",
			venue: "Club Cafe",
			city: "Pittsburgh, PA",
			date: toIsoDay(addDays(today, 14)),
			fee: 900,
			conf: .9,
			status: "booked",
			notes: "Deposit received. Load-in 5:30. 45-minute set."
		},
		{
			id: uid(),
			name: "Mr. Smalls Theatre hold",
			venue: "Mr. Smalls Theatre",
			city: "Millvale, PA",
			date: toIsoDay(addDays(today, 29)),
			fee: 1500,
			conf: .55,
			status: "negotiating",
			notes: "Waiting on door split vs. $1,500 guarantee. Need a second support."
		},
		{
			id: uid(),
			name: "Weeknight showcase",
			venue: "Thunderbird Cafe",
			city: "Pittsburgh, PA",
			date: toIsoDay(addDays(today, 45)),
			fee: 700,
			conf: .3,
			status: "lead",
			notes: "Good local-draw room. Follow up with Eli."
		},
		{
			id: uid(),
			name: "Morgantown routing night",
			venue: "123 Pleasant Street",
			city: "Morgantown, WV",
			date: toIsoDay(addDays(today, 40)),
			fee: 800,
			conf: .4,
			status: "outreach",
			notes: "Pairs with a Copper Wires bill. Van overnight is cheap."
		},
		{
			id: uid(),
			name: "Philly jump",
			venue: "Johnny Brenda's",
			city: "Philadelphia, PA",
			date: toIsoDay(addDays(today, 63)),
			fee: 1100,
			conf: .25,
			status: "lead",
			notes: "Needs a Northeast cluster — don't run this as a one-off."
		},
		{
			id: uid(),
			name: "Mountain room",
			venue: "The Purple Fiddle",
			city: "Thomas, WV",
			date: toIsoDay(addDays(today, 8)),
			fee: 650,
			conf: .95,
			status: "booked",
			notes: "Merch-heavy room. Bring vinyl and stickers."
		}
	];
	return {
		gigs,
		people: [
			{
				id: uid(),
				name: "Maya Chen",
				role: "booker",
				city: "Pittsburgh, PA",
				contact: "maya@clubcafe.example",
				notes: "Books Club Cafe. Prefers a one-sheet + 3 recent videos."
			},
			{
				id: uid(),
				name: "Dana Ortiz",
				role: "booker",
				city: "Millvale, PA",
				contact: "dana@mrsmalls.example",
				notes: "Mr. Smalls. Responds faster if you propose the full bill."
			},
			{
				id: uid(),
				name: "Eli Brooks",
				role: "promoter",
				city: "Pittsburgh, PA",
				contact: "eli@stageleft.example",
				notes: "Runs weeknight showcases. Good for growing local draw."
			},
			{
				id: uid(),
				name: "The Copper Wires",
				role: "band",
				city: "Morgantown, WV",
				contact: "copperwires.band",
				notes: "Jam-adjacent. Easy overnight routing from Pittsburgh."
			},
			{
				id: uid(),
				name: "Hollow Oak",
				role: "band",
				city: "Columbus, OH",
				contact: "hollowoak.band",
				notes: "Americana four-piece. Strong 150–250 cap rooms."
			},
			{
				id: uid(),
				name: "Stage Left Booking",
				role: "promoter",
				city: "Philadelphia, PA",
				contact: "hello@stageleft.example",
				notes: "Can cluster Philly / NYC / Hudson Valley if you have 3 dates."
			}
		],
		money: [
			{
				id: uid(),
				type: "collected",
				amount: 1500,
				label: "River festival deposit",
				date: toIsoDay(addDays(today, -12))
			},
			{
				id: uid(),
				type: "collected",
				amount: 420,
				label: "Merch — last Saturday",
				date: toIsoDay(addDays(today, -6))
			},
			{
				id: uid(),
				type: "collected",
				amount: 300,
				label: "Club Cafe deposit",
				date: toIsoDay(addDays(today, -2)),
				gigId: gigs[0]?.id
			},
			{
				id: uid(),
				type: "collected",
				amount: 64,
				label: "Streaming payout",
				date: toIsoDay(addDays(today, -1))
			},
			{
				id: uid(),
				type: "outstanding",
				amount: 600,
				label: "Club Cafe remainder",
				date: gigs[0]?.date ?? toIsoDay(today),
				gigId: gigs[0]?.id
			},
			{
				id: uid(),
				type: "outstanding",
				amount: 650,
				label: "Purple Fiddle guarantee",
				date: gigs[5]?.date ?? toIsoDay(today),
				gigId: gigs[5]?.id
			},
			{
				id: uid(),
				type: "cost",
				amount: 200,
				label: "Rehearsal space — August",
				date: toIsoDay(addDays(today, -20))
			},
			{
				id: uid(),
				type: "cost",
				amount: 380,
				label: "Van repair",
				date: toIsoDay(addDays(today, -9))
			},
			{
				id: uid(),
				type: "cost",
				amount: 85,
				label: "Gas — Morgantown scout",
				date: toIsoDay(addDays(today, -4))
			}
		],
		profile: {
			artistName: "River Fold",
			city: "Pittsburgh, PA",
			genre: "Americana / jam",
			draw: "80–150",
			feeTarget: 1e3,
			notes: "Home base Pittsburgh. Grow local draw, then route WV / OH / PA / Northeast. Merch and email list matter more than vanity streams."
		}
	};
}
var WELCOME_TEXT = `I’m your growth advisor. I search the live web for rooms, bills, press, playlisting, and what’s actually working for bands at your level.

Tell me a market, a date window, a fee target, or a growth problem — local draw, content, routing, guarantees, or who to share a bill with. I’ll come back with a next move you can run this week.`;
var emptyComposer = {
	gigOpen: false,
	personOpen: false,
	moneyOpen: false,
	profileOpen: false,
	commandOpen: false
};
function welcomeChat() {
	return [{
		id: uid(),
		role: "ai",
		text: WELCOME_TEXT,
		source: "MUSICIAN OS"
	}];
}
function fresh() {
	return {
		...createSeed(),
		chat: welcomeChat(),
		composer: { ...emptyComposer }
	};
}
var useMusician = create()(persist((set) => ({
	...fresh(),
	addGig: (gig) => {
		const id = uid();
		set((s) => ({ gigs: [{
			...gig,
			id
		}, ...s.gigs] }));
		return id;
	},
	updateGig: (id, patch) => set((s) => ({ gigs: s.gigs.map((g) => g.id === id ? {
		...g,
		...patch
	} : g) })),
	removeGig: (id) => set((s) => ({
		gigs: s.gigs.filter((g) => g.id !== id),
		money: s.money.map((m) => m.gigId === id ? {
			...m,
			gigId: void 0
		} : m)
	})),
	addPerson: (person) => {
		const id = uid();
		set((s) => ({ people: [{
			...person,
			id
		}, ...s.people] }));
		return id;
	},
	updatePerson: (id, patch) => set((s) => ({ people: s.people.map((p) => p.id === id ? {
		...p,
		...patch
	} : p) })),
	removePerson: (id) => set((s) => ({ people: s.people.filter((p) => p.id !== id) })),
	addMoney: (entry) => {
		const id = uid();
		set((s) => ({ money: [{
			...entry,
			id
		}, ...s.money] }));
		return id;
	},
	updateMoney: (id, patch) => set((s) => ({ money: s.money.map((m) => m.id === id ? {
		...m,
		...patch
	} : m) })),
	removeMoney: (id) => set((s) => ({ money: s.money.filter((m) => m.id !== id) })),
	updateProfile: (patch) => set((s) => ({ profile: {
		...s.profile,
		...patch
	} })),
	addUserMessage: (text) => set((s) => ({ chat: [...s.chat, {
		id: uid(),
		role: "user",
		text
	}] })),
	addAiMessage: (msg) => set((s) => ({ chat: [...s.chat, {
		id: uid(),
		role: "ai",
		...msg
	}] })),
	clearChat: () => set({ chat: welcomeChat() }),
	ingestSuggestedGig: (g) => set((s) => ({ gigs: [{
		id: uid(),
		name: g.name,
		venue: g.venue,
		city: g.city,
		date: g.date,
		fee: g.fee,
		conf: g.conf,
		status: g.status ?? "lead",
		notes: g.reason
	}, ...s.gigs] })),
	ingestSuggestedPerson: (p) => set((s) => ({ people: [{
		id: uid(),
		name: p.name,
		role: p.role,
		city: p.city,
		contact: "",
		notes: [p.detail, p.reason].filter(Boolean).join(" — ")
	}, ...s.people] })),
	setComposer: (patch) => set((s) => ({ composer: {
		...s.composer,
		...patch
	} })),
	openGig: (id) => set((s) => ({ composer: {
		...s.composer,
		gigOpen: true,
		commandOpen: false,
		editingGigId: id
	} })),
	openPerson: (id) => set((s) => ({ composer: {
		...s.composer,
		personOpen: true,
		commandOpen: false,
		editingPersonId: id
	} })),
	openMoney: (id) => set((s) => ({ composer: {
		...s.composer,
		moneyOpen: true,
		commandOpen: false,
		editingMoneyId: id
	} })),
	resetSample: () => set(fresh()),
	clearAll: () => set({
		gigs: [],
		people: [],
		money: [],
		chat: welcomeChat(),
		composer: { ...emptyComposer }
	})
}), {
	name: "musician-os-v1",
	partialize: (s) => ({
		gigs: s.gigs,
		people: s.people,
		money: s.money,
		chat: s.chat,
		profile: s.profile
	})
}));
function sumMoney(entries, type) {
	return entries.filter((x) => x.type === type).reduce((a, x) => a + (Number(x.amount) || 0), 0);
}
function pipelineGigs(gigs) {
	return gigs.filter((g) => g.status !== "completed" && g.status !== "passed");
}
function pipelineValue(gigs) {
	return pipelineGigs(gigs).reduce((a, g) => a + (Number(g.fee) || 0), 0);
}
function weightedValue(gigs) {
	return pipelineGigs(gigs).reduce((a, g) => a + (Number(g.fee) || 0) * (Number(g.conf) || 0), 0);
}
function buildAdvisorContext() {
	const s = useMusician.getState();
	const collected = sumMoney(s.money, "collected");
	const outstanding = sumMoney(s.money, "outstanding");
	const costs = sumMoney(s.money, "cost");
	const gigLines = s.gigs.slice(0, 12).map((g) => `- ${g.name} @ ${g.venue}, ${g.city} | ${g.date || "TBD"} | $${g.fee} | ${g.status} | conf ${Math.round(g.conf * 100)}% | ${g.notes}`).join("\n");
	const peopleLines = s.people.slice(0, 12).map((p) => `- ${p.name} (${p.role}) ${p.city} | ${p.notes}`).join("\n");
	return `ARTIST: ${s.profile.artistName}
HOME: ${s.profile.city}
GENRE: ${s.profile.genre}
TYPICAL DRAW: ${s.profile.draw}
FEE TARGET: $${s.profile.feeTarget}
NOTES: ${s.profile.notes}

MONEY: collected $${collected}, outstanding $${outstanding}, costs $${costs}, profit $${Math.max(0, collected - costs)}

GIG PIPELINE:
${gigLines || "(empty)"}

PEOPLE:
${peopleLines || "(empty)"}`;
}
//#endregion
export { longDate as a, pipelineGigs as c, toIsoDay as d, todayLabel as f, hostFromUrl as i, pipelineValue as l, weightedValue as m, cn as n, money as o, useMusician as p, downloadCsv as r, parseDay as s, buildAdvisorContext as t, sumMoney as u };
