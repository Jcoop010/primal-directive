import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { localGrowthAdvice } from "@/lib/local-advisor";
import type { SuggestedGig, SuggestedPerson } from "@/lib/types";
import { GIG_STATUSES, PERSON_ROLES } from "@/lib/types";

const HistoryItem = z.object({
  role: z.enum(["user", "ai"]),
  text: z.string(),
});

const Input = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(HistoryItem).max(10),
  context: z.string().max(4500),
});

const GigOut = z.object({
  name: z.string(),
  venue: z.string().default(""),
  city: z.string().default(""),
  date: z.string().default(""),
  fee: z.number().default(0),
  conf: z.number().min(0).max(1).default(0.4),
  reason: z.string().default(""),
  status: z.enum(GIG_STATUSES).optional(),
});

const PersonOut = z.object({
  name: z.string(),
  role: z.enum(PERSON_ROLES).default("other"),
  city: z.string().default(""),
  detail: z.string().default(""),
  reason: z.string().default(""),
});

const AiJson = z.object({
  answer: z.string(),
  gigs: z.array(GigOut).optional(),
  people: z.array(PersonOut).optional(),
  moves: z.array(z.string()).optional(),
});

const SYSTEM = `You are Musician OS — a blunt, practical band-growth advisor for independent artists.

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

type ChatOk = {
  ok: true;
  answer: string;
  source: string;
  citations: string[];
  gigs: SuggestedGig[];
  people: SuggestedPerson[];
  moves: string[];
};

type ChatErr = { ok: false; error: string };

function extractJson(raw: string) {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence?.[1]?.trim() || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function citationsFrom(body: Record<string, unknown>): string[] {
  const bags: unknown[] = [];
  if (Array.isArray(body.citations)) bags.push(...body.citations);
  const choices = body.choices as Array<{ message?: { citations?: unknown } }> | undefined;
  const msgCites = choices?.[0]?.message?.citations;
  if (Array.isArray(msgCites)) bags.push(...msgCites);
  const urls: string[] = [];
  for (const item of bags) {
    if (typeof item === "string" && item.startsWith("http")) urls.push(item);
    else if (item && typeof item === "object" && "url" in item) {
      const u = (item as { url: unknown }).url;
      if (typeof u === "string") urls.push(u);
    }
  }
  return [...new Set(urls)].slice(0, 6);
}

async function complete(args: {
  apiKey: string;
  messages: { role: string; content: string }[];
  search: boolean;
}) {
  const body: Record<string, unknown> = {
    model: "grok-4.5",
    messages: args.messages,
    temperature: 0.6,
    max_tokens: 1100,
  };
  if (args.search) {
    body.search_parameters = {
      mode: "on",
      return_citations: true,
      max_search_results: 8,
      sources: [{ type: "web" }, { type: "news" }],
    };
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  return res;
}

export const askGrowthAdvisor = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ChatOk | ChatErr> => {
    const apiKey = process.env.XAI_API_KEY;
    const fallback = () => {
      const local = localGrowthAdvice(data.message, data.context);
      return {
        ok: true as const,
        answer: local.answer,
        source: local.source,
        citations: [] as string[],
        gigs: local.gigs,
        people: local.people,
        moves: local.moves,
      };
    };

    if (!apiKey) return fallback();

    const messages = [
      { role: "system", content: SYSTEM },
      {
        role: "system",
        content: `Today is ${new Date().toISOString().slice(0, 10)}.\n\nARTIST CONTEXT:\n${data.context}`,
      },
      ...data.history.slice(-8).map((h) => ({
        role: h.role === "ai" ? "assistant" : "user",
        content: h.text,
      })),
      { role: "user", content: data.message },
    ];

    let res = await complete({ apiKey, messages, search: true });
    if (!res.ok) {
      res = await complete({ apiKey, messages, search: false });
    }
    if (!res.ok) return fallback();

    const body = (await res.json()) as Record<string, unknown>;
    const choices = body.choices as
      | Array<{ message?: { content?: string } }>
      | undefined;
    const raw = choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(raw);
    const safe = parsed ? AiJson.safeParse(parsed) : null;

    const citations = citationsFrom(body);
    const source = citations.length ? "LIVE WEB SEARCH" : "MUSICIAN OS";

    if (safe?.success) {
      const gigs: SuggestedGig[] = (safe.data.gigs ?? []).slice(0, 4).map((g) => ({
        name: g.name,
        venue: g.venue,
        city: g.city,
        date: g.date,
        fee: g.fee,
        conf: g.conf,
        reason: g.reason,
        status: g.status,
      }));
      const people: SuggestedPerson[] = (safe.data.people ?? [])
        .slice(0, 4)
        .map((p) => ({
          name: p.name,
          role: p.role,
          city: p.city,
          detail: p.detail,
          reason: p.reason,
        }));
      return {
        ok: true,
        answer: safe.data.answer,
        source,
        citations,
        gigs,
        people,
        moves: (safe.data.moves ?? []).slice(0, 3),
      };
    }

    return {
      ok: true,
      answer: raw || "No answer returned.",
      source,
      citations,
      gigs: [],
      people: [],
      moves: [],
    };
  });
