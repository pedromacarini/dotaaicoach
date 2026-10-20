import crypto from 'node:crypto';

const heroes = ['AXE', 'JUGGER', 'LINA', 'SNIPER', 'DROW', 'PUDGE', 'OMNI'];
const items = ['BLINK', 'BKB', 'LOTUS', 'SCEPTER', 'DESO', 'MANTA', 'RAPIER'];
const hero = process.argv[2]?.toUpperCase() || heroes[Math.floor(Math.random() * heroes.length)];
const item = process.argv[3]?.toUpperCase() || items[Math.floor(Math.random() * items.length)];
const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
const code = `${hero.slice(0, 3)}-${item.slice(0, 5)}-LOTUS-${suffix}`;
if (code.length !== 20) throw new Error(`Código gerado com ${code.length} caracteres: ${code}`);
console.log(JSON.stringify({ code, sha256: crypto.createHash('sha256').update(code).digest('hex'), note: 'Adicione o hash em electron/license-store.ts antes de distribuir.' }, null, 2));
