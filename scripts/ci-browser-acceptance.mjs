import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";

const origin = "http://127.0.0.1:8080";
const suffix = randomUUID();
const commands = [
  ["open", origin],
  ["wait", "--fn", "!document.body.innerText.includes('Preparing your artist workspace')"],
  ["eval", `(async () => {
    sessionStorage.setItem("__qa_password", crypto.randomUUID() + crypto.randomUUID());
    const response = await fetch("/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "River Fold A (fictional QA)", email: "river-fold-a-${suffix}@example.invalid", password: sessionStorage.getItem("__qa_password") }) });
    if (!response.ok) throw new Error("Disposable account registration failed: " + response.status);
    return true;
  })()`],
  ["open", origin],
  ["wait", "--fn", "document.body.innerText.includes('Command Center') && !document.body.innerText.includes('Loading your workspace')"],
  ["click", "aside button"],
  ["find", "label", "Artist / band", "fill", "River Fold (fictional QA)"],
  ["find", "label", "Home city", "fill", "Test City (fictional)"],
  ["find", "label", "Genre", "fill", "Indie folk"],
  ["find", "text", "Save profile", "click"],
  ["wait", "2000"],
  ["eval", "localStorage.removeItem('musician-os-v1'); true"],
  ["open", origin],
  ["wait", "--fn", "document.body.innerText.includes('River Fold (fictional QA)') && !document.body.innerText.includes('Loading your workspace')"],
  ["click", "aside button"],
  ["eval", "if (document.querySelector('[role=dialog] input')?.value !== 'River Fold (fictional QA)') throw new Error('Profile editor did not recover saved account data'); true"],
  ["find", "text", "Save profile", "click"],
  ["open", origin + "/people"],
  ["wait", "--fn", "!document.body.innerText.includes('Loading your workspace') && document.body.innerText.includes('Relationship command center')"],
  ["find", "role", "button", "click", "--name", "Add contact", "--exact"],
  ["find", "label", "Name", "fill", "Fictional QA Booker"],
  ["find", "label", "Contact", "fill", "fictional-booker@example.invalid"],
  ["find", "text", "Save contact", "click"],
  ["wait", "2000"],
  ["open", origin + "/money"],
  ["wait", "--fn", "document.body.innerText.includes('Financial activity') && !document.body.innerText.includes('Loading your workspace')"],
  ["find", "text", "Add entry", "click"],
  ["find", "label", "Amount", "fill", "125"],
  ["find", "label", "Label", "fill", "Fictional QA show income"],
  ["click", "[role=dialog] button[type=submit]"],
  ["wait", "2000"],
  ["eval", "localStorage.removeItem('musician-os-v1'); true"],
  ["open", origin + "/money"],
  ["wait", "--fn", "document.body.innerText.includes('Fictional QA show income') && !document.body.innerText.includes('Loading your workspace')"],
  ["screenshot", "/workspace/screenshots/authenticated-money.png"],
  ...["board", "gigs", "calendar", "tour", "merch", "tasks"].flatMap((route) => [
    ["open", origin + "/" + route],
    ["wait", "--fn", "document.querySelector('main')?.innerText.trim().length > 20 && !document.body.innerText.includes('Loading your workspace')"],
    ["eval", "if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) throw new Error('Horizontal overflow'); true"],
  ]),
  ["eval", `(async () => {
    const response = await fetch("/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "River Fold B (fictional QA)", email: "river-fold-b-${suffix}@example.invalid", password: sessionStorage.getItem("__qa_password") }) });
    if (!response.ok) throw new Error("Second disposable account registration failed: " + response.status);
    return true;
  })()`],
  ["open", origin + "/people"],
  ["wait", "--fn", "document.body.innerText.includes('No people yet') && !document.body.innerText.includes('Loading your workspace')"],
  ["eval", "if (document.body.innerText.includes('Fictional QA Booker') || document.body.innerText.includes('River Fold (fictional QA)')) throw new Error('Account data leaked'); true"],
  ["eval", `(async () => {
    const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error("Logout failed");
    return true;
  })()`],
  ["open", origin + "/money"],
  ["wait", "--fn", "document.body.innerText.includes('Sign in to access your private workspace')"],
  ["close"],
];
const result = spawnSync("npx", [
  "--yes", "agent-browser", "--executable-path", chromium.executablePath(),
  "batch", "--bail",
], { input: JSON.stringify(commands), encoding: "utf8", timeout: 240_000 });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) throw new Error("Interactive browser runner failed: " + result.error.message);
if (result.status !== 0) {
  const diagnostic = spawnSync("npx", ["--yes", "agent-browser", "batch", "--bail"], {
    input: JSON.stringify([["eval", "document.body.innerText"], ["errors"], ["screenshot", "/workspace/screenshots/acceptance-failure.png"]]),
    encoding: "utf8", timeout: 30_000,
  });
  process.stdout.write(diagnostic.stdout ?? "");
  process.stderr.write(diagnostic.stderr ?? "");
}
process.exitCode = result.status ?? 1;
