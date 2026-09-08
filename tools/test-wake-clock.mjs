import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const hook=source.slice(source.indexOf('function useAutonomousWake('),source.indexOf('\nfunction Today('));
let now=new Date(2026,8,9,10).getTime(),tick,visibility,cleanup,wakes=0;
let saved={checkedAt:now-86400000,cumulative:0,threshold:100,lastWakeAt:0,generation:0};
const document={visibilityState:'visible',addEventListener:(_,fn)=>visibility=fn,removeEventListener:()=>{}};
class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const context={Date:Clock,document,window:{setInterval:fn=>{tick=fn;return 1;}},clearInterval:()=>{},useRef:current=>({current}),useEffect:fn=>{cleanup=fn();},usePersistentDocument:()=>[{careFrequency:'daily'}],defaultPreferences:{},readLocalValue:()=>saved,wakeThreshold:()=>100,localStorage:{setItem:(_,value)=>saved=JSON.parse(value)},onWake:()=>wakes++};
vm.runInNewContext(ts.transpileModule(hook+'\nuseAutonomousWake(onWake);',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
assert.equal(saved.cumulative,0,'closed-page time must not accumulate');
now+=60000;tick();const visible=saved.cumulative;assert.ok(visible>0);
document.visibilityState='hidden';visibility();now+=3600000;tick();assert.equal(saved.cumulative,visible);
document.visibilityState='visible';visibility();tick();assert.equal(saved.cumulative,visible,'returning to page must not count hidden time');
now+=60000;tick();assert.ok(Math.abs(saved.cumulative-2*visible)<1e-12);assert.equal(wakes,0);cleanup();
console.log('Wake clock: visible time only, reload and hidden gaps excluded');
