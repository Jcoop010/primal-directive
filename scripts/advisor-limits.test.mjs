import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowAdvisorRequest,boundAdvisorContext} from '../src/lib/advisor-limits.ts';
test('Advisor limit is isolated per account and resets after the minute window',()=>{
 for(let i=0;i<12;i++)assert.equal(allowAdvisorRequest('limit-owner',1000),true);
 assert.equal(allowAdvisorRequest('limit-owner',1001),false);assert.equal(allowAdvisorRequest('another-owner',1001),true);assert.equal(allowAdvisorRequest('limit-owner',61000),true);
});
test('bounded context discloses omitted records',()=>{
 assert.match(boundAdvisorContext('x'.repeat(20000)),/Omitted records must not be assumed absent/);assert.equal(boundAdvisorContext('small'),'small');
});
