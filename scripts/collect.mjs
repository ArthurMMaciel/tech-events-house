// Coleta todas as fontes (incluindo Eventbrite e Sympla) e grava no Supabase.
// Usa a chave publicável e o login de um membro: as mesmas regras de RLS do app.
//   node --env-file=.env scripts/collect.mjs
// Variáveis: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, COLLECT_EMAIL, COLLECT_PASSWORD
import { createClient } from '@supabase/supabase-js';
import { collect } from '../collector.js';
import { toRow } from '../src/sources.js';

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key, COLLECT_EMAIL: email, COLLECT_PASSWORD: password } = process.env;
if (!url || !key || !email || !password) { console.error('Defina VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, COLLECT_EMAIL e COLLECT_PASSWORD.'); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
if (loginError) { console.error('Falha no login:', loginError.message); process.exit(1); }

const { events, status } = await collect();
for (const s of status) console.log(`${s.source}: ${s.count} eventos (${s.message})`);

const rows = [...new Map(events.map(toRow).filter(Boolean).map(r => [r.external_id, r])).values()];
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await supabase.from('events').upsert(rows.slice(i, i + 500), { onConflict: 'external_id' });
  if (error) { console.error('Falha ao gravar:', error.message); process.exit(1); }
}
console.log(`${rows.length} eventos gravados.`);
await supabase.auth.signOut();
