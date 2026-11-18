// Vercel entry: every dynamic route (/env.js, /places.js, /api/*) is rewritten here (see vercel.json).
// Static pages come from public/ and are served by Vercel directly.
export { handler as default } from '../server.mjs';
