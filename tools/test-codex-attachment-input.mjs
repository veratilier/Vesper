import assert from 'node:assert/strict';
import { attachmentInputText } from '../app/codex-attachment-input.ts';
const file = {name:'原图.zip',type:'application/zip',size:2090008,url:'https://vesper.r-vera.com/api/media/test.zip'};
assert.match(attachmentInputText(file), /Download URL: https:\/\/vesper.r-vera.com\/api\/media\/test.zip/);
for (const url of ['blob:https://vesper.r-vera.com/temp','data:text/plain,test','file:///tmp/file.zip']) {
 assert.throws(()=>attachmentInputText({...file,url}),/可下载/);
}
console.log('attachment download URL and local-only URL rejection: ok');
