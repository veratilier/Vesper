import assert from 'node:assert/strict';
import { userInputAnswer } from '../lib/codex-user-input.ts';
const request = { id: 12, method: 'item/tool/requestUserInput', params: { questions: [{ id: 'approval', question: 'Allow tool?', options: [{label:'Accept'}, {label:'Decline'}, {label:'Cancel'}] }] } };
assert.throws(() => userInputAnswer(request, {}));
assert.throws(() => userInputAnswer(request, { approval: 'approve everything' }));
for (const choice of ['Accept','Decline','Cancel']) assert.deepEqual(userInputAnswer(request, { approval: choice }), { answers: { approval: { answers: [choice] } } });
assert.deepEqual(userInputAnswer({ ...request, params: { questions: [{id:'note'}] } }, {note:'my answer'}), {answers:{note:{answers:['my answer']}}});
console.log('Explicit MCP question choices, no default consent, and protocol answer shape passed');

import { elicitationContent } from '../lib/codex-elicitation-form.ts';
assert.deepEqual(userInputAnswer({...request, params:{questions:[{...request.params.questions[0],isOther:true}]}},{approval:'custom answer'}),{answers:{approval:{answers:['custom answer']}}});
const schema = {type:'object',required:['consent','count'],properties:{consent:{type:'boolean'},count:{type:'integer',minimum:1,maximum:3},category:{type:'string',enum:['daily','study']}}};
assert.throws(()=>elicitationContent(schema,{}));
assert.deepEqual(elicitationContent(schema,{consent:'false',count:'2'}),{consent:false,count:2});
for(const count of ['0','4','1.5','bad']) assert.throws(()=>elicitationContent(schema,{consent:'true',count}));
assert.throws(()=>elicitationContent(schema,{consent:'true',count:'2',category:'other'}));
assert.throws(()=>elicitationContent({type:'object',properties:{nested:{type:'object'}}},{}));
assert.throws(()=>elicitationContent({type:'object',required:['toString'],properties:{}},{}));
console.log('Typed forms, explicit false, required fields, ranges and allowed custom answers passed');
