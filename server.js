import nodemailer from 'nodemailer';
import express from 'express';import {randomBytes} from 'node:crypto';import {db,verifyPassword,tokenHash} from './db.js';import {collect} from './collector.js';
const app=express(),port=Number(process.env.PORT||3000);app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));app.use(express.static('dist'));
const sessions=db.prepare('SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?');
function auth(req,res,next){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8);const user=token&&sessions.get(tokenHash(token),Date.now());if(!user)return res.status(401).json({error:'Faça login para continuar.'});req.user=user;req.token=token;next()}
const inviteConfig = () => { try { const url = new URL(process.env.PUBLIC_URL); return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && ['http:', 'https:'].includes(url.protocol)); } catch { return false; } };
async function sendInvitation(userId, event, person) {
  if (!inviteConfig()) return 'unconfigured';
  const token = randomBytes(32).toString('hex');
  const link = new URL(`/invite/${token}`, process.env.PUBLIC_URL).toString();
  db.prepare('UPDATE invitations SET token_hash=?, delivery=? WHERE user_id=? AND event_id=? AND email=?').run(tokenHash(token), 'pending', userId, event.id, person.email.toLowerCase());
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
    await transporter.sendMail({ from: process.env.GMAIL_USER, to: person.email, subject: `Convite: ${event.title}`, text: `Olá, ${person.name}!\n\nVocê foi convidado(a) para ${event.title}, em ${event.start}.\nResponda ao convite: ${link}\n\nDetalhes e inscrição no evento: ${event.url}\n\nDFL Events` });
    db.prepare('UPDATE invitations SET delivery=? WHERE user_id=? AND event_id=? AND email=?').run('sent', userId, event.id, person.email.toLowerCase());
    return 'sent';
  } catch {
    db.prepare('UPDATE invitations SET delivery=? WHERE user_id=? AND event_id=? AND email=?').run('failed', userId, event.id, person.email.toLowerCase());
    return 'failed';
  }
}
const invitationPage = message => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DFL Events</title><body style="background:#0d1117;color:#e6edf3;font:16px system-ui;max-width:560px;margin:12vh auto;padding:24px;line-height:1.6"><h1>DFL Events</h1>${message}</body></html>`;
app.get('/invite/:token',(req,res)=>{
  const invitation=db.prepare('SELECT status FROM invitations WHERE token_hash=?').get(tokenHash(req.params.token));
  if(!invitation) return res.status(404).send(invitationPage('<p>Este convite não está disponível.</p>'));
  res.send(invitationPage(`<p>Responda ao convite recebido:</p><form method="post"><button name="response" value="confirmed">Confirmar presença</button> <button name="response" value="declined">Não poderei ir</button></form>`));
});
app.post('/invite/:token',express.urlencoded({extended:false}),(req,res)=>{
  if(!['confirmed','declined'].includes(req.body.response)) return res.status(400).send(invitationPage('<p>Resposta inválida.</p>'));
  const result=db.prepare('UPDATE invitations SET status=? WHERE token_hash=?').run(req.body.response,tokenHash(req.params.token));
  if(!result.changes) return res.status(404).send(invitationPage('<p>Este convite não está disponível.</p>'));
  res.send(invitationPage('<p>Sua resposta foi registrada. Obrigado!</p>'));
});
app.post('/api/invitations/status',auth,(req,res)=>{
  const {id,email,status}=req.body;
  if(typeof id!=='string'||typeof email!=='string'||!['pending','confirmed','declined'].includes(status)) return res.status(400).json({error:'Dados inválidos.'});
  const result=db.prepare('UPDATE invitations SET status=? WHERE user_id=? AND event_id=? AND email=?').run(status,req.user.id,id,email.toLowerCase());
  if(!result.changes) return res.status(404).json({error:'Pessoa não encontrada.'});
  res.json({ok:true});
});
app.post('/api/invitations/send',auth,async(req,res)=>{
  const {id,email}=req.body;
  if(typeof id!=='string'||typeof email!=='string') return res.status(400).json({error:'Dados inválidos.'});
  const person=db.prepare('SELECT name,email FROM attendees WHERE user_id=? AND event_id=? AND lower(email)=?').get(req.user.id,id,email.toLowerCase());
  const event=db.prepare('SELECT * FROM events WHERE id=?').get(id);
  if(!person||!event) return res.status(404).json({error:'Pessoa não encontrada.'});
  if(!inviteConfig()) return res.status(503).json({error:'Configure o Gmail e o endereço público para enviar convites.'});
  const delivery=await sendInvitation(req.user.id,event,person);
  if(delivery!=='sent') return res.status(502).json({error:'Não foi possível enviar o convite. Verifique a configuração e tente novamente.'});
  res.json({ok:true});
});
const attempts=new Map();app.post('/api/login',(req,res)=>{const key=req.ip,attempt=attempts.get(key)||{count:0,until:Date.now()+600000};if(Date.now()>attempt.until){attempt.count=0;attempt.until=Date.now()+600000}if(attempt.count>=10)return res.status(429).json({error:'Muitas tentativas. Tente novamente mais tarde.'});const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!user||!verifyPassword(password,user.password)){attempt.count++;attempts.set(key,attempt);return res.status(401).json({error:'E-mail ou senha incorretos.'})}attempts.delete(key);const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash(token),user.id,Date.now()+7*86400000);res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);res.json({email:user.email})});
app.get('/api/me',auth,(req,res)=>res.json(req.user));app.post('/api/logout',auth,(req,res)=>{db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(req.token));res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true})});
app.get('/api/events',auth,(req,res)=>{const events=db.prepare('SELECT events.*, CASE WHEN saved.event_id IS NULL THEN 0 ELSE 1 END AS saved FROM events LEFT JOIN saved ON saved.event_id=events.id AND saved.user_id=? ORDER BY start').all(req.user.id);const attendees=db.prepare("SELECT a.event_id,a.name,a.email,COALESCE(i.status,'pending') AS status,COALESCE(i.delivery,'unconfigured') AS delivery FROM attendees a LEFT JOIN invitations i ON i.user_id=a.user_id AND i.event_id=a.event_id AND i.email=lower(a.email) WHERE a.user_id=? ORDER BY a.position").all(req.user.id);const grouped=new Map();for(const person of attendees){if(!grouped.has(person.event_id))grouped.set(person.event_id,[]);grouped.get(person.event_id).push({name:person.name,email:person.email,status:person.status,delivery:person.delivery})}res.json(events.map(event=>({...event,attendees:grouped.get(event.id)||[]})))});
app.post('/api/refresh',auth,async(req,res)=>{try{const result=await collect();const put=db.prepare('INSERT INTO events(id,title,start,end,url,source,mode,description,updated) VALUES (@id,@title,@start,@end,@url,@source,@mode,@description,@updated) ON CONFLICT(id) DO UPDATE SET title=excluded.title,start=excluded.start,end=excluded.end,mode=excluded.mode,description=excluded.description,updated=excluded.updated');db.exec('BEGIN');try{for(const e of result.events)put.run({...e,end:e.end||null,mode:e.mode||null,description:e.description||'',updated:Date.now()});db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}res.json(result.status)}catch{res.status(500).json({error:'Não foi possível atualizar os eventos.'})}});
app.post('/api/saved',auth,async(req,res)=>{const event=db.prepare('SELECT * FROM events WHERE id=?').get(String(req.body.id||''));if(!event)return res.status(404).json({error:'Evento não encontrado.'});if(typeof req.body.saved!=='boolean')return res.status(400).json({error:'Estado inválido.'});let people=[];if(req.body.saved){if(!Array.isArray(req.body.attendees)||req.body.attendees.length<1||req.body.attendees.length>50)return res.status(400).json({error:'Informe entre 1 e 50 pessoas.'});for(const person of req.body.attendees){if(!person||typeof person.name!=='string'||typeof person.email!=='string')return res.status(400).json({error:'Informe nome e e-mail válidos para cada pessoa.'});const name=person.name.trim(),email=person.email.trim();if(!name||name.length>150||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Informe nome e e-mail válidos para cada pessoa.'});if(people.some(p=>p.email.toLowerCase()===email.toLowerCase()))return res.status(400).json({error:'Cada pessoa deve ter um e-mail diferente.'});people.push({name,email})}}let committed=false;try{db.exec('BEGIN');db.prepare('DELETE FROM attendees WHERE user_id=? AND event_id=?').run(req.user.id,event.id);if(req.body.saved){db.prepare('INSERT OR IGNORE INTO saved VALUES (?,?)').run(req.user.id,event.id);const insert=db.prepare('INSERT INTO attendees VALUES (?,?,?,?,?)');people.forEach((p,i)=>insert.run(req.user.id,event.id,p.name,p.email,i))}else db.prepare('DELETE FROM saved WHERE user_id=? AND event_id=?').run(req.user.id,event.id);if(req.body.saved){const emails=people.map(p=>p.email.toLowerCase());for(const row of db.prepare('SELECT email FROM invitations WHERE user_id=? AND event_id=?').all(req.user.id,event.id))if(!emails.includes(row.email))db.prepare('DELETE FROM invitations WHERE user_id=? AND event_id=? AND email=?').run(req.user.id,event.id,row.email);for(const p of people)db.prepare("INSERT OR IGNORE INTO invitations(user_id,event_id,email,status,delivery) VALUES (?,?,?,'pending','unconfigured')").run(req.user.id,event.id,p.email.toLowerCase())}else db.prepare('DELETE FROM invitations WHERE user_id=? AND event_id=?').run(req.user.id,event.id);db.exec('COMMIT');committed=true;for(const p of people){const invitation=db.prepare('SELECT status,delivery FROM invitations WHERE user_id=? AND event_id=? AND email=?').get(req.user.id,event.id,p.email.toLowerCase());if(invitation.delivery==='unconfigured'&&inviteConfig())invitation.delivery=await sendInvitation(req.user.id,event,p);Object.assign(p,invitation)}res.json({ok:true,attendees:people})}catch{if(!committed)db.exec('ROLLBACK');res.status(500).json({error:committed?'Pessoas salvas, mas houve uma falha ao enviar convites.':'Não foi possível salvar as pessoas. Tente novamente.'})}});
app.listen(port,'127.0.0.1',()=>console.log(`Agenda Tech: http://localhost:${port}`));
