const D=require('./data.json');
const R="23456789TJQKA";
const idx=c=>R.indexOf(c);

/* Zápis běžných otevíracích tabulek pro 6 hráčů u stolu.
   Notace: "77+" páry od 77 nahoru, "ATs+" suited od ATs po AKs,
           "K8s-K5s" rozsah, jinak konkrétní ruka. */
function expand(spec){
  const out=new Set();
  spec.split(/\s+/).filter(Boolean).forEach(tok=>{
    let m;
    if((m=tok.match(/^([2-9TJQKA])\1\+$/))){                 // páry od X nahoru
      for(let r=idx(m[1]);r<=12;r++) out.add(R[r]+R[r]);
    } else if((m=tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])\+$/))){  // XY s/o "a výš"
      const hi=idx(m[1]);
      for(let lo=idx(m[2]);lo<hi;lo++) out.add(R[hi]+R[lo]+m[3]);
    } else if((m=tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])-([2-9TJQKA])([2-9TJQKA])\3$/))){ // rozsah
      const hi=idx(m[1]);
      for(let lo=idx(m[5]);lo<=idx(m[2]);lo++) out.add(R[hi]+R[lo]+m[3]);
    } else if((m=tok.match(/^([2-9TJQKA])\1-([2-9TJQKA])\2$/))){     // rozsah párů
      for(let r=idx(m[2]);r<=idx(m[1]);r++) out.add(R[r]+R[r]);
    } else out.add(tok);
  });
  return [...out];
}

const SPEC={
  UTG:"55+ ATs+ A5s-A2s KTs+ QTs+ JTs T9s 98s 87s AJo+ KJo+ QJo",
  HJ: "22+ ATs+ A5s-A2s K9s+ Q9s+ J9s+ T8s+ 98s 87s 76s ATo+ KTo+ QJo",
  CO: "22+ A2s+ K5s+ Q8s+ J8s+ T7s+ 97s+ 86s+ 76s 65s 54s A8o+ K9o+ QTo+ JTo",
  BTN:"22+ A2s+ K2s+ Q2s+ J6s+ T6s+ 96s+ 85s+ 74s+ 63s+ 53s+ 43s A2o+ K5o+ Q8o+ J8o+ T8o+",
  SB: "22+ A2s+ K2s+ Q5s+ J7s+ T6s+ 96s+ 85s+ 75s+ 64s+ 53s+ A2o+ K7o+ Q9o+ J9o+ T9o"
};
const META=[
  {key:'UTG',name:'UTG', full:'první na řadě, 5 hráčů po tobě'},
  {key:'HJ', name:'HJ',  full:'druhý na řadě, 4 hráči po tobě'},
  {key:'CO', name:'CO',  full:'předposlední, 2 hráči po tobě'},
  {key:'BTN',name:'BTN', full:'button — mluvíš poslední'},
  {key:'SB', name:'SB',  full:'malý blind, po tobě už jen velký blind'}
];

const out={};
for(const k in SPEC) out[k]=expand(SPEC[k]);

let bad=0;
const must=(c,m)=>{ if(!c){bad++;console.log('  ✗ '+m);} };

console.log('POZICE   rukou  kombinací  % všech rozdání');
META.forEach(p=>{
  const hs=out[p.key];
  const combos=hs.reduce((a,h)=>a+(D[h]?D[h].c:NaN),0);
  console.log('  '+p.name.padEnd(5)+String(hs.length).padStart(4)+String(combos).padStart(10)+
              '      '+(combos/1326*100).toFixed(1)+' %');
  hs.forEach(h=>must(D[h]!==undefined,'neznámá ruka v '+p.key+': '+h));
  const pct=combos/1326*100;
  must(pct>3&&pct<60,p.key+' má nesmyslnou šířku '+pct.toFixed(1)+'%');
});

console.log('\nTESTY:');
/* range musí být vnořené: co se otevírá z UTG, musí jít i z HJ atd. */
['HJ','CO','BTN'].forEach((k,i)=>{
  const prev=['UTG','HJ','CO'][i];
  const miss=out[prev].filter(h=>!out[k].includes(h));
  must(miss.length===0,k+' neobsahuje z '+prev+': '+miss.join(' '));
});
/* co musí a nesmí být uvnitř */
const MUST={UTG:['AA','KK','QQ','JJ','TT','99','88','77','AKs','AKo','AQo','AJo','KQs','JTs'],
            HJ:['66','55','44','33','22','76s','ATo','KTo'],
            CO:['65s','54s','A9o','QTo','JTo','K9o','A2s'],
            BTN:['K2s','Q2s','43s','A2o','K5o','Q8o','J8o','T8o']};
for(const k in MUST) MUST[k].forEach(h=>must(out[k].includes(h),k+' musí otevírat '+h));
const NEVER={UTG:['72o','J2s','K2s','Q7o','54s','22'],CO:['72o','32o','J2o'],BTN:['72o','32o','52o','42o','62o','83o']};
for(const k in NEVER) NEVER[k].forEach(h=>must(!out[k].includes(h),k+' nesmí otevírat '+h));
/* každá suited ruka na BTN musí být i nižší varianta stejné řady u SB, pokud je K2s v obou */
must(out.BTN.length>out.CO.length&&out.CO.length>out.HJ.length&&out.HJ.length>out.UTG.length,
     'range se musí rozšiřovat UTG < HJ < CO < BTN');
/* button je lepší pozice než malý blind, takže musí otevírat všechno, co otevírá SB */
const sbOnly=out.SB.filter(h=>!out.BTN.includes(h));
must(sbOnly.length===0,'BTN musí obsahovat celé SB, chybí: '+sbOnly.join(' '));
must(out.SB.every(h=>out.CO.includes(h)||out.BTN.includes(h)),'SB obsahuje ruku mimo BTN i CO');
console.log(bad===0?'  ✅ vše prošlo':'  ❌ '+bad+' chyb');

console.log('\nV KTERÉ NEJRANĚJŠÍ POZICI SE RUKA OTEVÍRÁ:');
['AA','TT','77','22','AKs','AQo','AJo','KQs','KJo','JTs','T9s','98s','76s','65s','54s','A5s','A2s','K9s','K2s','Q9s','J9s','A9o','K9o','QTo','JTo','T8o','K2o','Q7o','72o','32o'].forEach(h=>{
  const w=META.filter(p=>out[p.key].includes(h)).map(p=>p.name);
  console.log('  '+h.padEnd(5)+(w.length?w.join(', '):'— nikde —'));
});

require('fs').writeFileSync('ranges.json',JSON.stringify(out));
require('fs').writeFileSync('posmeta.json',JSON.stringify(META));
console.log('\nzapsáno ('+require('fs').statSync('ranges.json').size+' B)');
process.exit(bad?1:0);
