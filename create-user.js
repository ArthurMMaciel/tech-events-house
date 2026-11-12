import readline from 'node:readline/promises';
import { db, hashPassword } from './db.js';
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const email=(await rl.question('E-mail: ')).trim().toLowerCase();const password=await rl.question('Senha (a digitação fica visível neste terminal): ');rl.close();
if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8){console.error('Informe um e-mail válido e uma senha de pelo menos 8 caracteres.');process.exit(1)}
try{db.prepare('INSERT INTO users(email,password) VALUES (?,?)').run(email,hashPassword(password));console.log('Conta criada.')}catch{console.error('Não foi possível criar a conta. Verifique se o e-mail já existe.');process.exit(1)}
