import crypto from 'node:crypto';
import fs from 'node:fs';

const privateKey = process.env.DOTAIACOACH_LICENSE_PRIVATE_KEY;
if (!privateKey) throw new Error('Defina DOTAIACOACH_LICENSE_PRIVATE_KEY fora do repositório.');
const [subject = 'local-user', expiresAt = ''] = process.argv.slice(2);
const payload = { schemaVersion: 1, licenseId: crypto.randomUUID(), subject, plan: 'premium', issuedAt: new Date().toISOString(), expiresAt: expiresAt || null, features: ['voice', 'advanced-guides', 'premium-advisor'] };
const signature = crypto.sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64');
fs.writeFileSync(process.stdout.fd, JSON.stringify({ payload, signature }, null, 2));
