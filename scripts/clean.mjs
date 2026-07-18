import fs from 'node:fs';
import path from 'node:path';

const distPath = path.resolve(process.cwd(), 'dist');
fs.rmSync(distPath, { recursive: true, force: true });
