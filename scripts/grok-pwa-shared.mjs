/**
 * Single source of truth for platform head chrome (PWA, extensions.js, OG),
 * shared by the Vite plugin and Nitro middleware. Plain ESM so `node --test`
 * and the Nitro bundler can both consume it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_APP_NAME = "Grok App";
export const OG_SERVICE_URL_DEFAULT = "https://og.grok.me";
export const OG_SITE_REL_PATH = "src/lib/og/site.json";

const SHARE_META_KEYS = new Set([
  "og:title", "og:description", "og:image", "og:image:width", "og:image:height",
  "og:type", "og:url", "og:site_name", "twitter:card", "twitter:title",
  "twitter:image", "twitter:description", "x:game:image", "x:game:image:width",
  "x:game:image:height",
]);

export function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function unescapeHtml(value) {
  return String(value).replaceAll("&lt;", "<").replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");
}

function placeholderCardColor(site = {}) {
  const raw = String(site.color ?? "").trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : "";
}

export function appNameFromHost(hostHeader) {
  const host = String(hostHeader ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
  if (!host.endsWith(".grok.me")) return DEFAULT_APP_NAME;
  const slug = host.split(".")[0] ?? "";
  if (!slug || slug === "www" || !/^[a-z0-9-]{1,63}$/.test(slug)) return DEFAULT_APP_NAME;
  return slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || DEFAULT_APP_NAME;
}

function isVercelSystemHost(host) {
  return host === "vercel.app" || host.endsWith(".vercel.app") || host === "vercel.com" || host.endsWith(".vercel.com");
}

export function publicAppHost(hostHeader) {
  const host = String(hostHeader ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
  if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
  if (isVercelSystemHost(host)) return "";
  return host;
}

export function resolvePublicHost(hostHeader) {
  return publicAppHost(process.env?.VITE_PUBLIC_HOSTNAME) || publicAppHost(hostHeader);
}

export function isInstallQuery(url) {
  const query = String(url ?? "").split("?", 2)[1] ?? "";
  const params = new URLSearchParams(query);
  const install = params.get("install");
  const platform = (params.get("platform") ?? "").toLowerCase();
  return (install === "1" || install === "true") && platform === "ios";
}

export function isDocumentPath(pathname) {
  const path = String(pathname ?? "");
  return !path.startsWith("/__grok/") && !path.startsWith("/api/") && !path.startsWith("/@") && !path.startsWith("/node_modules") && !/\.[a-z0-9]+$/i.test(path);
}

export function acceptsHtml(accept) {
  const value = String(accept ?? "");
  return value === "" || value.includes("text/html") || value.includes("*/*");
}

export function stripInstallParams(url) {
  const [path = "/", query = ""] = String(url ?? "/").split("?", 2);
  const params = new URLSearchParams(query);
  params.delete("install"); params.delete("platform");
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

export function renderInstallPageHtml(template, { host, url } = {}) {
  return String(template).replaceAll("{{APP_NAME}}", escapeHtml(appNameFromHost(host))).replaceAll("{{APP_URL}}", escapeHtml(stripInstallParams(url)));
}

export function renderWebManifest(hostHeader) {
  const name = appNameFromHost(hostHeader);
  return JSON.stringify({ name, short_name: name, id: "/", start_url: "/", scope: "/", display: "standalone", background_color: "#000000", theme_color: "#000000", icons: [{ src: "/__grok/icon-180.png", sizes: "180x180", type: "image/png" }] }, null, 2);
}

export function grokPwaHeadTags(appName = DEFAULT_APP_NAME) {
  return [
    ["manifest", '<link rel="manifest" href="/__grok/manifest.webmanifest">'],
    ["apple-touch-icon", '<link rel="apple-touch-icon" href="/__grok/icon-180.png">'],
    ["apple-mobile-web-app-title", `<meta name="apple-mobile-web-app-title" content="${escapeHtml(appName)}">`],
    ["apple-mobile-web-app-status-bar-style", '<meta name="apple-mobile-web-app-status-bar-style" content="black">'],
    ["theme-color", '<meta name="theme-color" content="#000000">'],
  ];
}

export const GROK_EXTENSIONS_SCRIPT_SRC = "https://grok.com/grok-app-builder/extensions.js";
export function readGrokProjectId() { return String(typeof process !== "undefined" ? process.env?.VITE_PROJECT_ID ?? "" : "").trim(); }
export function readXCreator() { return String(typeof process !== "undefined" ? process.env?.X_CREATOR ?? "" : "").trim(); }
export function readXCreatorId() { return String(typeof process !== "undefined" ? process.env?.X_CREATOR_ID ?? "" : "").trim(); }
export function grokXCreatorHeadTags(creator = readXCreator(), creatorId = readXCreatorId()) {
  const name = String(creator ?? "").trim(), id = String(creatorId ?? "").trim();
  if (!name || !id) return [];
  return [`<meta property="x:creator" content="${escapeHtml(name)}">`, `<meta property="x:creator:id" content="${escapeHtml(id)}">`];
}
export function grokExtensionsHeadTags(projectId = readGrokProjectId()) {
  const id = escapeHtml(projectId), tags = [];
  if (projectId) tags.push(`<meta name="grok-project-id" content="${id}">`);
  tags.push(`<script src="${GROK_EXTENSIONS_SCRIPT_SRC}"${projectId ? ` data-project-id="${id}"` : ""} defer></script>`);
  return tags;
}

export function readOgSite(cwd = process.cwd()) {
  try { const parsed = JSON.parse(readFileSync(join(cwd, OG_SITE_REL_PATH), "utf8")); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}
export function ogCardPublicPath(cwd = process.cwd()) {
  if (existsSync(join(cwd, "public/og.jpg"))) return "/og.jpg";
  if (existsSync(join(cwd, "public/og.png"))) return "/og.png";
  return "";
}
function detectCustomOgCard(cwd = process.cwd(), site = {}) { return Boolean(ogCardPublicPath(cwd) || siteHasCustomCard(site) || String(site.image ?? "").trim()); }
export function snapshotOgIdentity(cwd = process.cwd()) {
  const site = { ...readOgSite(cwd) }, disk = ogCardPublicPath(cwd);
  if (disk) { site.card = "custom"; site.image = disk; }
  else { if (siteHasCustomCard(site)) delete site.card; if (site.image) delete site.image; }
  if (existsSync(join(cwd, "public/x-banner.jpg"))) site.banner = site.banner || "/x-banner.jpg";
  return { site };
}
export function customOgAssetPath(cwd = process.cwd()) { return ogCardPublicPath(cwd) || "/og.jpg"; }
export function ogServiceUrl() { return (String(process.env?.VITE_OG_SERVICE_URL ?? "").trim() || OG_SERVICE_URL_DEFAULT).replace(/\/+$/, ""); }
export function titleFromDocument(html) { const match = String(html ?? "").match(/<title\b[^>]*>([^<]*)<\/title>/i); return match ? unescapeHtml(match[1]).trim() : ""; }
export function resolveOgTitle(site = {}, appName = DEFAULT_APP_NAME, host = "", documentTitle = "") {
  const fromSite = String(site.title ?? "").trim(); if (fromSite) return fromSite;
  const fromDoc = String(documentTitle ?? "").trim(); if (fromDoc) return fromDoc;
  const fromHost = appNameFromHost(host); if (fromHost && fromHost !== DEFAULT_APP_NAME) return fromHost;
  return String(appName ?? "").trim() || DEFAULT_APP_NAME;
}
export function siteHasCustomCard(site = {}) { return String(site.card ?? "").toLowerCase() === "custom"; }
export function resolveOgCardAsset(site = {}, cwd = process.cwd()) { return ogCardPublicPath(cwd) || (detectCustomOgCard(cwd, site) ? String(site.image ?? "").trim() || "/og.jpg" : ""); }
function applyCustomCardFromFs(site, cwd) { const disk = ogCardPublicPath(cwd); return disk ? { ...site, card: "custom", image: disk } : site; }

export function grokOgHeadTags({ host = "", appName = DEFAULT_APP_NAME, site = {}, documentTitle = "", cwd = process.cwd() } = {}) {
  const title = resolveOgTitle(site, appName, host, documentTitle), publicHost = resolvePublicHost(host);
  const tags = [`<meta name="twitter:card" content="summary_large_image">`, `<meta property="og:title" content="${escapeHtml(title)}">`];
  const description = String(site.description ?? "").trim(); if (description) tags.push(`<meta property="og:description" content="${escapeHtml(description)}">`);
  if (String(site.type ?? "").toLowerCase() === "x:game") tags.push(`<meta property="og:type" content="x:game">`);
  if (publicHost) {
    const asset = resolveOgCardAsset(site, cwd), custom = Boolean(asset);
    let image = custom ? `https://${publicHost}${asset.startsWith("/") ? asset : `/${asset}`}` : `${ogServiceUrl()}/v1/card.png?host=${encodeURIComponent(publicHost)}&title=${encodeURIComponent(title)}`;
    const color = !custom ? placeholderCardColor(site) : ""; if (color) image += `&color=${encodeURIComponent(color)}`;
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`);
    const banner = String(site.banner ?? "").trim();
    if (banner) { const bannerUrl = `https://${publicHost}${banner.startsWith("/") ? banner : `/${banner}`}`; tags.push(`<meta property="x:game:image" content="${escapeHtml(bannerUrl)}">`, `<meta property="x:game:image:width" content="1200">`, `<meta property="x:game:image:height" content="264">`); }
  }
  return tags;
}
export function stripShareMetaTags(html) {
  return String(html).replace(/<meta\b[^>]*>/gi, (tag) => {
    const attrs = [...tag.matchAll(/\b(?:property|name)\s*=\s*["']([^"']+)["']/gi)];
    for (const match of attrs) if (SHARE_META_KEYS.has(String(match[1]).toLowerCase())) return "";
    return tag;
  });
}
function insertAfterHeadOpen(html, snippet) {
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (open) => `${open}${snippet}`);
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (open) => `${open}<head>${snippet}</head>`);
  return `<!doctype html><html><head>${snippet}</head>${html}`;
}
function insertBeforeHeadClose(html, snippet) { if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${snippet}</head>`); return insertAfterHeadOpen(html, snippet); }

export function normalizeHeadContext(ctx = {}) {
  const cwd = ctx.cwd ?? (process.execArgv.includes("--test") ? join(process.cwd(), "__grok-test-isolated__") : process.cwd());
  const site = applyCustomCardFromFs(ctx.site !== undefined ? ctx.site : snapshotOgIdentity(cwd).site, cwd);
  const appName = resolveOgTitle(site, ctx.appName ?? DEFAULT_APP_NAME, ctx.host ?? "");
  return { appName, projectId: ctx.projectId ?? readGrokProjectId(), creator: ctx.creator ?? readXCreator(), creatorId: ctx.creatorId ?? readXCreatorId(), host: ctx.host ?? "", cwd, site };
}
export function injectGrokPwaHead(html, ctx = {}) {
  if (typeof html !== "string") return html;
  const { site, projectId, creator, creatorId, host, cwd } = normalizeHeadContext(ctx), documentTitle = titleFromDocument(html);
  const appName = resolveOgTitle(site, ctx.appName ?? DEFAULT_APP_NAME, host, documentTitle);
  let next = stripShareMetaTags(html);
  const missing = grokPwaHeadTags(appName).filter(([key]) => key === "manifest" ? !next.includes('href="/__grok/manifest.webmanifest"') : key === "apple-touch-icon" ? !next.includes('href="/__grok/icon-180.png"') : !next.includes(`name="${key}"`)).map(([, tag]) => tag);
  next = insertAfterHeadOpen(next, grokOgHeadTags({ host, appName, site, documentTitle, cwd }).join(""));
  if (!next.includes("/grok-app-builder/extensions.js")) missing.push(...grokExtensionsHeadTags(projectId));
  else if (projectId && !next.includes('name="grok-project-id"')) missing.push(`<meta name="grok-project-id" content="${escapeHtml(projectId)}">`);
  if (projectId && !next.includes('property="grok:app_id"') && !next.includes("property='grok:app_id'")) missing.push(`<meta property="grok:app_id" content="${escapeHtml(projectId)}">`);
  const creatorTags = grokXCreatorHeadTags(creator, creatorId);
  if (creatorTags.length) { const hasCreator = next.includes('property="x:creator" content=') || next.includes("property='x:creator' content="); if (!hasCreator) missing.push(creatorTags[0]); if (!next.includes('property="x:creator:id"')) missing.push(creatorTags[1]); }
  return missing.length ? insertBeforeHeadClose(next, missing.join("")) : next;
}
function findHeadClose(buf) { return buf.toString("latin1").search(/<\/head>/i); }
export function createHeadInjector(ctx = {}) {
  const normalized = normalizeHeadContext(ctx); let pending = [], done = false;
  const apply = (html) => injectGrokPwaHead(html, { appName: normalized.appName, projectId: normalized.projectId, creator: normalized.creator, creatorId: normalized.creatorId, host: normalized.host, cwd: normalized.cwd, site: normalized.site });
  return {
    push(chunk) { const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); if (done) return [buf]; pending.push(buf); const joined = Buffer.concat(pending), at = findHeadClose(joined); if (at === -1) return []; done = true; pending = []; const closeLen = joined.toString("latin1", at).match(/^<\/head>/i)[0].length; const head = apply(joined.subarray(0, at + closeLen).toString("utf8")); return [Buffer.concat([Buffer.from(head, "utf8"), joined.subarray(at + closeLen)])]; },
    flush() { if (done || pending.length === 0) return []; const rest = Buffer.concat(pending); pending = []; done = true; return [Buffer.from(apply(rest.toString("utf8")), "utf8")]; },
  };
}
