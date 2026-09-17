const L = require('./logic.js');

function comb5(cards){ // nezávislá kontrola: projdi všech C(n,5) a vyhodnoť jen 5-karetní ruce
  let best=-1, bestCat=0;
  const n=cards.length, ch=[];
  (function rec(st){
    if(ch.length===5){ const e=L.ev(ch); if(e.score>best){best=e.score;bestCat=e.cat;} return; }
    for(let i=st;i<n;i++){ch.push(cards[i]);rec(i+1);ch.pop();}
  })(0);
  return {score:best,cat:bestCat};
}

let fail=0;
const chk=(c,m)=>{ if(!c){ fail++; console.log('FAIL:',m); } };

// 1) ev(7 karet) musí souhlasit s nejlepší pěticí spočítanou hrubou silou
for(let t=0;t<4000;t++){
  const d=L.shuffled().slice(0,7);
  const a=L.ev(d), b=comb5(d);
  chk(a.cat===b.cat && a.score===b.score, 'ev(7) != brute force  '+d.map(L.cname).join(' ')+'  '+JSON.stringify(a)+' vs '+JSON.stringify(b));
}
console.log('1) evaluátor 7 karet vs hrubá síla: 4000 testů');

// 2) genHand – správná odpověď = skutečná kategorie
for(let t=0;t<600;t++){
  const q=L.genHand();
  const all=q.groups[0].cards.concat(q.groups[1].cards);
  chk(String(comb5(all).cat)===q.correct,'genHand špatná odpověď');
  chk(q.answers.some(a=>a.key===q.correct),'genHand: správná odpověď chybí mezi možnostmi');
}
console.log('2) genHand: 600 testů');

// 3) genDuel
for(let t=0;t<600;t++){
  const q=L.genDuel();
  const [me,opp,board]=q.groups.map(g=>g.cards);
  const a=comb5(me.concat(board)).score, b=comb5(opp.concat(board)).score;
  const want = a>b?'me':(a<b?'opp':'split');
  chk(want===q.correct,'genDuel špatná odpověď');
}
console.log('3) genDuel: 600 testů');

// 4) genOuts – přepočítej outy nezávisle
for(let t=0;t<400;t++){
  const q=L.genOuts();
  const hole=q.groups[0].cards, flop=q.groups[1].cards;
  const known=new Set(hole.concat(flop));
  const cur=comb5(hole.concat(flop)).cat;
  let n=0;
  for(let c=0;c<52;c++){ if(known.has(c)) continue; if(comb5(hole.concat(flop,[c])).cat>cur) n++; }
  chk(String(n)===q.correct,'genOuts: '+q.correct+' vs skutečnost '+n);
  chk(q.answers.length===4,'genOuts: nemá 4 možnosti');
  chk(new Set(q.answers.map(a=>a.key)).size===4,'genOuts: duplicitní možnosti');
}
console.log('4) genOuts: 400 testů');

// 5) genOdds – přepočítej equity i požadované procento
for(let t=0;t<120;t++){
  const q=L.genOdds();
  const [me,opp,flop]=q.groups.map(g=>g.cards);
  const known=new Set(me.concat(opp,flop));
  const rest=[]; for(let c=0;c<52;c++) if(!known.has(c)) rest.push(c);
  let win=0,tie=0,tot=0;
  for(let x=0;x<rest.length;x++) for(let y=x+1;y<rest.length;y++){
    const bo=flop.concat([rest[x],rest[y]]);
    const a=comb5(me.concat(bo)).score, b=comb5(opp.concat(bo)).score;
    if(a>b)win++; else if(a===b)tie++; tot++;
  }
  chk(tot===990,'genOdds: nečekaný počet runoutů '+tot);
  const eq=(win+tie/2)/tot*100;
  const pot=parseInt(q.money[0].n), bet=parseInt(q.money[1].n);
  const need=bet/(pot+2*bet)*100;
  const want = eq>need?'call':'fold';
  chk(want===q.correct,'genOdds: doporučení nesedí (eq '+eq.toFixed(1)+' vs need '+need.toFixed(1)+')');
  chk(Math.abs(eq-need)>=5,'genOdds: příliš těsné ('+Math.abs(eq-need).toFixed(1)+' b.)');
}
console.log('5) genOdds: 120 testů (každý = 990 přesných runoutů)');

// 6) genStart
for(let t=0;t<300;t++){
  const q=L.genStart();
  const cards=q.groups[0].cards;
  const code=L.codeOf(cards[0],cards[1]);
  chk((L.tierOf(code)<=4?'play':'fold')===q.correct,'genStart nesedí s tierem');
  chk(L.EQ[code]!==undefined,'genStart: kód '+code+' není v tabulce equity');
}
console.log('6) genStart: 300 testů');

// 7) genFav – znamení musí být jednoznačné
for(let t=0;t<12;t++){
  const q=L.genFav();
  chk(q.correct==='a'||q.correct==='b','genFav: špatný klíč');
  chk(q.answers.length===2,'genFav: špatný počet možností');
}
console.log('7) genFav: 12 testů');

// 8) popisy kombinací – žádné "undefined"
const seen={};
for(let t=0;t<8000;t++){
  const d=L.shuffled().slice(0,7);
  const b=L.best5(d);
  const s=L.describe(b);
  chk(s && !/undefined|NaN/.test(s),'describe: "'+s+'"');
  seen[b.cat]=seen[b.cat]||s;
}
console.log('8) popisy: pokryté kategorie ->');
Object.keys(seen).sort((a,b)=>a-b).forEach(k=>console.log('   '+L.CAT[k].padEnd(15)+' "'+seen[k]+'"'));

console.log(fail===0 ? '\n✅ ZÁKLADNÍ DRILY PROŠLY' : '\n❌ CHYB: '+fail);

/* ---------- nové drily ---------- */
console.log('\n--- pozice a postflop ---');
let f2=0; const chk2=(c,m)=>{ if(!c){f2++;console.log('FAIL: '+m);} };

// 9) genPos – odpověď musí sedět s tabulkou pro danou pozici
const posSeen={};
for(let t=0;t<1500;t++){
  const q=L.genPos();
  const pos=L.SEATS[q.seats.you];
  const code=L.codeOf(q.groups[0].cards[0],q.groups[0].cards[1]);
  const want = L.RANGES[pos].indexOf(code)>=0 ? 'open':'fold';
  chk2(want===q.correct,'genPos: '+code+' na '+pos+' → '+q.correct+', čekáno '+want);
  chk2(L.POS_KEYS.indexOf(pos)>=0,'genPos: neplatná pozice '+pos);
  posSeen[pos]=(posSeen[pos]||0)+1;
}
console.log('9) genPos: 1500 testů, rozložení pozic', JSON.stringify(posSeen));

// tabulky: vnořenost a šířka
L.POS_KEYS.forEach((k,i)=>{
  const w=L.RANGES[k].reduce((a,c)=>a+L.combosOf(c),0)/1326*100;
  chk2(w>10&&w<55,k+': nesmyslná šířka '+w.toFixed(1)+'%');
  L.RANGES[k].forEach(c=>chk2(L.EQ[c]!==undefined,k+': neznámá ruka '+c));
});
['HJ','CO','BTN'].forEach((k,i)=>{
  const prev=['UTG','HJ','CO'][i];
  chk2(L.RANGES[prev].every(h=>L.RANGES[k].indexOf(h)>=0),k+' neobsahuje celé '+prev);
});
console.log('   tabulky: šířky '+L.POS_KEYS.map(k=>k+' '+(L.RANGES[k].reduce((a,c)=>a+L.combosOf(c),0)/1326*100).toFixed(0)+'%').join(', '));

// 10) genBet – přepočítej equity nezávisle a ověř rozhodnutí
let betCount=0, checkCount=0, drawBets=0;
for(let t=0;t<60;t++){
  const q=L.genBet();
  const hole=q.groups[0].cards, flop=q.groups[1].cards;
  const eq=L.eqVsRandom(hole,flop,60000);          // 5x víc vzorků než appka
  const dr=L.drawsOn(hole.concat(flop));
  const want=(eq>=L.BET_TH||dr.big)?'bet':'check';
  chk2(want===q.correct,'genBet: eq '+eq.toFixed(1)+' draw='+dr.big+' → '+q.correct+', čekáno '+want);
  chk2(!dr.big || q.correct==='bet','genBet: velké draw musí vést na sázku');
  chk2(dr.big || Math.abs(eq-L.BET_TH)>=4,'genBet: příliš těsné bez draw ('+eq.toFixed(1)+')');
  if(q.correct==='bet'){betCount++; if(dr.big&&eq<L.BET_TH) drawBets++;} else checkCount++;
}
console.log('10) genBet: 60 testů (každý přepočítán na 60 000 rozdání)');
console.log('    sázet '+betCount+' / checkovat '+checkCount+', z toho polo-blafů s draw: '+drawBets);


// 11) button musí otevírat všechno, co malý blind
const sbOnly=L.RANGES.SB.filter(h=>L.RANGES.BTN.indexOf(h)<0);
chk2(sbOnly.length===0,'BTN neobsahuje z SB: '+sbOnly.join(' '));
console.log('11) BTN ⊇ SB: ok');

console.log(f2===0 ? '\n✅ NOVÉ DRILY PROŠLY' : '\n❌ CHYB: '+f2);
process.exit(f2?1:0);
