import { access, copyFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('github-pages-spa');
const generatedEntry = path.join(output, 'static-index.html');
const pagesEntry = path.join(output, 'index.html');

await rename(generatedEntry, pagesEntry);
await copyFile('CNAME', path.join(output, 'CNAME'));
await copyFile(pagesEntry, path.join(output, '404.html'));
await writeFile(path.join(output, '.nojekyll'), '');
await Promise.all([
  access(pagesEntry),
  access(path.join(output, 'CNAME')),
  access(path.join(output, '.nojekyll')),
]);
