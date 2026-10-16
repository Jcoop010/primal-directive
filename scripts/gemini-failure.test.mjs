import {test} from "node:test";
import assert from "node:assert/strict";
import {geminiFailure} from "../src/lib/gemini-failure.ts";
const quota = (id, limit, retryDelay) => ({error:{status:"RESOURCE_EXHAUSTED",message:"secret-key private-customer-data",details:[{violations:[{quotaId:id,quotaValue:limit,quotaDimensions:{model:"gemini-3.1-flash-lite"}}]},...(retryDelay ? [{retryDelay}] : [])]}});
test("RESOURCE_EXHAUSTED alone does not prove exhausted quota", () => {
 assert.equal(geminiFailure(429,{error:{status:"RESOURCE_EXHAUSTED"}}).kind,"quota_unknown");
});
test("Zero and daily quotas are hard exhaustion; minute windows are temporary", () => {
 assert.equal(geminiFailure(429,quota("GenerateRequestsPerDay",500)).kind,"quota_exhausted");
 assert.equal(geminiFailure(429,quota("GenerateRequestsPerMinute",0)).kind,"quota_exhausted");
 assert.equal(geminiFailure(429,quota("GenerateRequestsPerMinute",15)).kind,"rate_limited");
 assert.equal(geminiFailure(429,quota("Unknown",15,"12.5s")).retrySeconds,13);
});
test("Authentication, model, request and upstream failures stay distinct", () => {
 for (const [status,kind] of [[401,"authentication"],[403,"authentication"],[404,"unsupported_model"],[400,"invalid_request"],[503,"provider_unavailable"]]) assert.equal(geminiFailure(status,{}).kind,kind);
});
test("Diagnostics never include raw messages or arbitrary dimensions", () => {
 const result = JSON.stringify(geminiFailure(429,quota("GenerateRequestsPerMinute",15)));
 assert.doesNotMatch(result,/secret-key|private-customer-data|RESOURCE_EXHAUSTED/);
});
