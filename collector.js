import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';
const exec=promisify(execFile);
const sources={Eventbrite:'https://www.eventbrite.com.br/d/online/free--science-and-tech--events/',Sympla:'https://www.sympla.com.br/eventos/tecnologia?category=collection',Even3:'https://www.even3.com.br/eventos-online/computacao-e-tecnologias-da-informacao/'};
export async function collect(){let all=[],status=[];for(const [source,url] of Object.entries(sources)){try{const {stdout}=await exec(process.platform==='win32'?'curl.exe':'curl',['-fsSL','--max-time','25',url],{maxBuffer:8*1024*1024});const $=cheerio.load(stdout);let events=[];
if(source==='Eventbrite'){$('script[type="application/ld+json"]').each((_,el)=>{try{const data=JSON.parse($(el).html());for(const x of data.itemListElement||[]){const e=x.item;if(e?.startDate&&e.url)events.push({title:e.name,start:e.startDate,end:e.endDate,url:e.url,mode:'Online',description:e.description||''})}}catch{}})}
if(source==='Sympla'){$('script').each((_,el)=>{let s=$(el).html()||'';const match=s.match(/^self\.__next_f\.push\((\[.*\])\)$/s);if(!match)return;try{const part=JSON.parse(match[1])[1];const ix=part.indexOf(':');const data=JSON.parse(part.slice(ix+1));const walk=o=>{if(!o||typeof o!=='object')return;if(typeof o.name==='string'&&typeof o.start_date==='string'&&typeof o.url==='string'&&o.url.includes('sympla.com.br/evento/'))events.push({title:o.name,start:o.start_date,end:o.end_date,url:o.url,mode:o.location?.city||'Não informado',description:''});for(const v of Object.values(o))walk(v)};walk(data)}catch{}})}
events=events.filter(e=>{try{return ['www.eventbrite.com','www.eventbrite.com.br','www.sympla.com.br','www.even3.com.br'].includes(new URL(e.url).hostname)}catch{return false}});all.push(...events.map(e=>({...e,source,id:source+':'+e.url.split('?')[0]})));status.push({source,count:events.length,ok:events.length>0,message:events.length?'Dados encontrados':'Nenhum evento identificado na página'});
}catch{status.push({source,count:0,ok:false,message:'Não foi possível consultar esta fonte'})}}for(const result of await Promise.all([collectBrazil(),collectConferences()])){all.push(...result.events);status.push(result.status)}return {events:all,status}}

async function download(url) { const { stdout } = await exec(process.platform === 'win32' ? 'curl.exe' : 'curl', ['-fsSL', '--max-time', '20', '-H', 'User-Agent: DFL-Events', url], { maxBuffer: 8 * 1024 * 1024 }); return stdout; }
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
export function parseBrazil(text) {
  const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  let year = 0, month = -1; const events = [];
  for (const line of text.split(/\r?\n/)) {
    const yearMatch = line.match(/^## Eventos em (\d{4})/); if (yearMatch) { year = Number(yearMatch[1]); continue; }
    if (line.startsWith('## ') && !yearMatch) { year = 0; continue; }
    const heading = line.match(/^### (.+)$/); if (heading) { month = months.indexOf(heading[1].trim().toLocaleLowerCase('pt-BR')); continue; }
    if (!year || month < 0) continue;
    const entry = line.match(/^- (\d{1,2})(?:[^:]*): \[(.+?)\]\((https?:\/\/[^ )]+)\)(.*)$/); if (!entry) continue;
    const day = Number(entry[1]); const start = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (day < 1 || day > new Date(year,month+1,0).getDate()) continue;
    const url = safeUrl(entry[3]); if (!url) continue;
    events.push({id:`Agenda Tech Brasil:${start}:${url.split('?')[0]}`,source:'Agenda Tech Brasil',title:entry[2],start,end:null,url,mode:/!\[online\]/i.test(entry[4])?'Online':/!\[híbrido\]/i.test(entry[4])?'Híbrido':'Presencial',description:''});
  }
  return events;
}
async function collectBrazil() {
  const source='Agenda Tech Brasil'; try { const events=parseBrazil(await download('https://raw.githubusercontent.com/agenda-tech-brasil/agenda-tech-brasil/main/README.md')); return {events,status:{source,count:events.length,ok:events.length>0,message:events.length?'Dados encontrados':'Nenhum evento identificado'}}; } catch { return {events:[],status:{source,count:0,ok:false,message:'Não foi possível consultar esta fonte'}}; }
}
export function parseConferences(data) {
  if (!Array.isArray(data)) return [];
  return data.flatMap(e=>{const url=safeUrl(e.url);if(!url||typeof e.name!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.startDate||''))return [];return [{id:`Confs.tech:${e.startDate}:${url.split('?')[0]}`,source:'Confs.tech',title:e.name,start:e.startDate,end:e.endDate||null,url,mode:/online|virtual/i.test(`${e.city||''} ${e.country||''}`)?'Online':[e.city,e.country].filter(Boolean).join(', ')||'Não informado',description:''}];});
}
async function collectConferences() {
  const source='Confs.tech'; try {
    const years=[new Date().getFullYear(),new Date().getFullYear()+1]; let partial=false; const all=[];
    for(const year of years){let files;try{files=JSON.parse(await download(`https://api.github.com/repos/tech-conferences/conference-data/contents/conferences/${year}`));if(!Array.isArray(files))throw Error();}catch{partial=true;continue;}
      const urls=files.filter(f=>f.type==='file'&&/^[a-z0-9-]+\.json$/.test(f.name)).map(f=>`https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences/${year}/${f.name}`);
      for(let i=0;i<urls.length;i+=8){const batch=await Promise.allSettled(urls.slice(i,i+8).map(async url=>parseConferences(JSON.parse(await download(url)))));for(const result of batch)if(result.status==='fulfilled')all.push(...result.value);else partial=true;}
    }
    const events=[...new Map(all.map(e=>[e.id,e])).values()];return {events,status:{source,count:events.length,ok:events.length>0,message:partial?'Coleta parcial; algumas fontes não responderam':'Dados encontrados'}};
  } catch {return {events:[],status:{source,count:0,ok:false,message:'Não foi possível consultar esta fonte'}};}
}
