import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
export const db = new DatabaseSync(process.env.DB_PATH || 'agenda.sqlite');
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,title TEXT NOT NULL,start TEXT NOT NULL,end TEXT,url TEXT NOT NULL,source TEXT NOT NULL,mode TEXT,description TEXT,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS saved(user_id INTEGER NOT NULL,event_id TEXT NOT NULL,PRIMARY KEY(user_id,event_id));`);
db.exec(`CREATE TABLE IF NOT EXISTS attendees(user_id INTEGER NOT NULL,event_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,position INTEGER NOT NULL,PRIMARY KEY(user_id,event_id,position));`);
export function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')}
export function verifyPassword(password,stored){try{const [salt,hash]=stored.split(':');const a=Buffer.from(hash,'hex'),b=scryptSync(password,salt,64);return a.length===b.length && timingSafeEqual(a,b)}catch{return false}}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');

db.exec(`CREATE TABLE IF NOT EXISTS invitations(user_id INTEGER NOT NULL,event_id TEXT NOT NULL,email TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',delivery TEXT NOT NULL DEFAULT 'unconfigured',token_hash TEXT,PRIMARY KEY(user_id,event_id,email));`);
db.exec("INSERT OR IGNORE INTO invitations(user_id,event_id,email,delivery) SELECT user_id,event_id,lower(email),'unconfigured' FROM attendees");
