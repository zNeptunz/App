/**
 * Erzeugt calendar.ics aus der Firebase Realtime Database.
 * Läuft in GitHub Actions, das Ergebnis wird von GitHub Pages ausgeliefert.
 */
import { writeFileSync } from 'node:fs';

const FB   = process.env.FB_BASE || 'https://gerichtefamilienplan-default-rtdb.europe-west1.firebasedatabase.app';
const PATH = process.env.FB_PATH || 'mastaler/data';
const OUT  = process.env.OUT_FILE || 'calendar.ics';

const CATS = { termin:'Termin', geburtstag:'Geburtstag', schule:'Schule',
               arbeit:'Arbeit', urlaub:'Urlaub', sonstiges:'Sonstiges' };

const pad = n => String(n).padStart(2,'0');
const esc = s => String(s ?? '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');

function fold(line){
  const b = Buffer.from(line,'utf8');
  if(b.length <= 73) return line;
  const out = [];
  let cur = '';
  for(const ch of line){
    const test = cur + ch;
    if(Buffer.from(test,'utf8').length > (out.length ? 72 : 73)){ out.push(cur); cur = ch; }
    else cur = test;
  }
  if(cur) out.push(cur);
  return out.join('\r\n ');
}

const parseKey = k => { const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d,12); };
const dateKey  = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const nextDay  = k => { const d=parseKey(k); d.setDate(d.getDate()+1); return dateKey(d); };

function mondayOfWeekKey(key){
  const [y,w] = key.split('-W').map(Number);
  const jan4 = new Date(y,0,4,12);
  const m = new Date(jan4);
  m.setDate(jan4.getDate() - ((jan4.getDay()+6)%7));
  m.setDate(m.getDate() + (w-1)*7);
  return m;
}

const res = await fetch(`${FB}/${PATH}.json`);
if(!res.ok) throw new Error(`Firebase antwortete mit ${res.status}`);
const data = (await res.json()) || {};

const stamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
const L = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mastaler App//DE','CALSCALE:GREGORIAN',
           'METHOD:PUBLISH','X-WR-CALNAME:Mastaler','X-WR-TIMEZONE:Europe/Berlin',
           'REFRESH-INTERVAL;VALUE=DURATION:PT6H','X-PUBLISHED-TTL:PT6H'];

let nEvents = 0, nMeals = 0;

for(const e of (data.events || [])){
  if(!e?.id || !e.title || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) continue;
  const dt = e.date.replace(/-/g,'');
  L.push('BEGIN:VEVENT', `UID:${e.id}@mastaler`, `DTSTAMP:${stamp}`);
  if(e.allDay || !e.start){
    L.push(`DTSTART;VALUE=DATE:${dt}`, `DTEND;VALUE=DATE:${nextDay(e.date).replace(/-/g,'')}`);
  } else {
    L.push(`DTSTART;TZID=Europe/Berlin:${dt}T${e.start.replace(':','')}00`);
    L.push(`DTEND;TZID=Europe/Berlin:${dt}T${(e.end || e.start).replace(':','')}00`);
  }
  if(e.yearly) L.push('RRULE:FREQ=YEARLY');
  L.push(fold(`SUMMARY:${esc(e.title)}`));
  const desc = [e.person ? `Für: ${e.person}` : '', e.notes || ''].filter(Boolean).join('\n');
  if(desc) L.push(fold(`DESCRIPTION:${esc(desc)}`));
  L.push(fold(`CATEGORIES:${esc(CATS[e.cat] || 'Sonstiges')}`));
  L.push('END:VEVENT');
  nEvents++;
}

const dishes = data.dishes || [];
for(const [wk, week] of Object.entries(data.weeks || {})){
  if(!Array.isArray(week?.days)) continue;
  week.days.forEach((day,i)=>{
    if(day?.final == null) return;
    const dish = dishes.find(d => d.id === day.final);
    if(!dish) return;
    const m = mondayOfWeekKey(wk); m.setDate(m.getDate()+i);
    const k = dateKey(m);
    L.push('BEGIN:VEVENT', `UID:meal-${wk}-${i}@mastaler`, `DTSTAMP:${stamp}`,
           `DTSTART;VALUE=DATE:${k.replace(/-/g,'')}`,
           `DTEND;VALUE=DATE:${nextDay(k).replace(/-/g,'')}`,
           fold(`SUMMARY:Essen: ${esc(dish.name)}`), 'CATEGORIES:Essen', 'END:VEVENT');
    nMeals++;
  });
}

L.push('END:VCALENDAR');
writeFileSync(OUT, L.join('\r\n') + '\r\n', 'utf8');
console.log(`${OUT} geschrieben: ${nEvents} Termine, ${nMeals} Gerichte`);
