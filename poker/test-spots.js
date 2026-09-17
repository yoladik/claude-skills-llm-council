const L=require('./gens.js');
let fail=0; const chk=(c,m)=>{ if(!c){fail++; if(fail<12) console.log('FAIL: '+m);} };

function brute(cards){
  let best=-1,cat=0; const n=cards.length,ch=[];
  (function rec(st){
    if(ch.length===5){const e=L.ev(ch); if(e.score>best){best=e.score;cat=e.cat;} return;}
    for(let i=st;i<n;i++){ch.push(cards[i]);rec(i+1);ch.pop();}
  })(0);
  return {score:best,cat:cat};
}
/* společné pro všechny situace */
function shape(sp,name){
  chk(sp.heroCards.length===2,name+': hero nemá 2 karty');
  chk(L.POSITIONS.indexOf(sp.heroPos)>=0,name+': neplatná pozice');
  L.POSITIONS.forEach(p=>chk(sp.seats[p]!==undefined,name+': chybí sedačka '+p));
  chk(sp.answers.some(a=>a.k===sp.correct),name+': správná odpověď není mezi možnostmi');
  chk(new Set(sp.answers.map(a=>a.k)).size===sp.answers.length,name+': duplicitní možnosti');
  chk(sp.pot>0,name+': nulový bank');
  const nb={preflop:0,flop:3,turn:4,river:5}[sp.street];
  chk(sp.board.length===nb,name+': '+sp.street+' má '+sp.board.length+' karet na stole, čekáno '+nb);
  const all=sp.heroCards.concat(sp.board,(sp.villainCards?sp.villainCards.cards:[]));
  chk(new Set(all).size===all.length,name+': stejná karta dvakrát!');
  chk(all.every(c=>c>=0&&c<52),name+': karta mimo balíček');
  chk(typeof sp.why()==='string'&&sp.why().length>30,name+': chybí vysvětlení');
  chk(!/undefined|NaN|\[object/.test(sp.why()),name+': vysvětlení obsahuje "'+(sp.why().match(/undefined|NaN|\[object \w+/)||[''])[0]+'"');
  chk(!/undefined|NaN/.test(sp.story),name+': příběh obsahuje undefined/NaN');
  if(sp.street==='preflop'){
    const b=L.POSITIONS.reduce((a,p)=>a+sp.seats[p].bet,0);
    chk(Math.abs(b-sp.pot)<0.01,name+': bank '+sp.pot+' nesedí se součtem sázek '+b);
  }
}

console.log('--- kontrola situací ---');
for(let t=0;t<700;t++){
  const sp=L.genRFI(); shape(sp,'RFI');
  const code=L.codeOf(sp.heroCards[0],sp.heroCards[1]);
  chk((L.RFI[sp.heroPos].indexOf(code)>=0?'raise':'fold')===sp.correct,'RFI: '+code+' z '+sp.heroPos);
  chk(sp.freqs[0].v+sp.freqs[1].v===100,'RFI: frekvence nedávají 100 %');
}
console.log('1) genRFI: 700');

for(let t=0;t<700;t++){
  const sp=L.genVsRaise(); shape(sp,'vsRaise');
  const code=L.codeOf(sp.heroCards[0],sp.heroCards[1]);
  const ch=L.SPOTS[sp.range.key];
  const want=ch.raise.indexOf(code)>=0?'raise':(ch.call.indexOf(code)>=0?'call':'fold');
  chk(want===sp.correct,'vsRaise: '+code+' → '+sp.correct+', čekáno '+want);
  chk(sp.heroPos!=='BB'||sp.range.key==='BB_DEFEND','vsRaise: BB musí používat tabulku obrany blindu');
  chk(Math.abs(sp.freqs.reduce((a,f)=>a+f.v,0)-100)<0.6,'vsRaise: frekvence nedávají 100 %');
  chk(sp.freqs.filter(f=>f.hit).length===1,'vsRaise: musí svítit právě jedna frekvence');
}
console.log('2) genVsRaise: 700');

for(let t=0;t<700;t++){
  const sp=L.genVs3bet(); shape(sp,'vs3bet');
  const code=L.codeOf(sp.heroCards[0],sp.heroCards[1]);
  const ch=L.SPOTS[sp.range.key];
  const want=ch.raise.indexOf(code)>=0?'raise':(ch.call.indexOf(code)>=0?'call':'fold');
  chk(want===sp.correct,'vs3bet: '+code+' → '+sp.correct);
  chk(sp.potType==='p3','vs3bet: musí být 3-bet bank');
  /* v banku musí sedět součet: blindy + otevření + 3-bet */
  const bets=L.POSITIONS.reduce((a,p)=>a+sp.seats[p].bet,0);
  chk(Math.abs(bets-sp.pot)<0.01,'vs3bet: bank '+sp.pot+' nesedí se sázkami '+bets);
}
console.log('3) genVs3bet: 700');

let byStreet={flop:0,turn:0,river:0}, bets=0, checks=0;
for(let t=0;t<45;t++){
  const sp=L.genPostflop(); shape(sp,'postflop');
  byStreet[sp.street]++;
  const r=L.eqVsRandom(sp.heroCards,sp.board,60000);
  const dr=sp.street==='river'?{big:false}:L.drawsOn(sp.heroCards.concat(sp.board));
  const want=(r.eq>=L.BET_TH||dr.big)?'bet':'check';
  chk(want===sp.correct,'postflop '+sp.street+': eq '+r.eq.toFixed(1)+' draw '+dr.big+' → '+sp.correct);
  if(sp.street==='river') chk(r.exact,'river musí být počítaný přesně');
  sp.correct==='bet'?bets++:checks++;
}
console.log('4) genPostflop: 45 (ulice '+JSON.stringify(byStreet)+', sázet '+bets+' / check '+checks+')');

for(let t=0;t<400;t++){
  const sp=L.genRead(); shape(sp,'read');
  chk(String(brute(sp.heroCards.concat(sp.board)).cat)===sp.correct,'read: špatná kombinace');
  chk(sp.answers.length===6,'read: nemá 6 možností');
}
console.log('5) genRead: 400');

for(let t=0;t<400;t++){
  const sp=L.genShowdown(); shape(sp,'showdown');
  const a=brute(sp.heroCards.concat(sp.board)).score, b=brute(sp.villainCards.cards.concat(sp.board)).score;
  chk((a>b?'me':a<b?'opp':'split')===sp.correct,'showdown: špatný vítěz');
}
console.log('6) genShowdown: 400');

for(let t=0;t<300;t++){
  const sp=L.genOuts(); shape(sp,'outs');
  const known=new Set(sp.heroCards.concat(sp.board));
  const cur=brute(sp.heroCards.concat(sp.board)).cat;
  let n=0;
  for(let c=0;c<52;c++){ if(known.has(c)) continue; if(brute(sp.heroCards.concat(sp.board,[c])).cat>cur) n++; }
  chk(String(n)===sp.correct,'outs: '+sp.correct+' vs skutečnost '+n);
}
console.log('7) genOuts: 300');

for(let t=0;t<40;t++){
  const sp=L.genOdds(); shape(sp,'odds');
  const known=new Set(sp.heroCards.concat(sp.board,sp.villainCards.cards));
  const rest=[]; for(let c=0;c<52;c++) if(!known.has(c)) rest.push(c);
  let w=0,ti=0,tot=0;
  for(let x=0;x<rest.length;x++) for(let y=x+1;y<rest.length;y++){
    const bo=sp.board.concat([rest[x],rest[y]]);
    const A=brute(sp.heroCards.concat(bo)).score, B=brute(sp.villainCards.cards.concat(bo)).score;
    if(A>B)w++; else if(A===B)ti++; tot++;
  }
  chk(tot===990,'odds: '+tot+' runoutů místo 990');
  const eq=(w+ti/2)/tot*100;
  const bet=sp.seats[sp.villainCards.pos].bet, pot=sp.pot;
  const need=bet/(pot+2*bet)*100;
  chk((eq>need?'call':'fold')===sp.correct,'odds: eq '+eq.toFixed(1)+' need '+need.toFixed(1)+' → '+sp.correct);
}
console.log('8) genOdds: 40 (každý = 990 přesných runoutů)');

console.log(fail===0?'\n✅ VŠECHNO PROŠLO':'\n❌ CHYB: '+fail);
process.exit(fail?1:0);
