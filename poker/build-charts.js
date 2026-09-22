const D=require('./data.json');
const RFI=require('./ranges.json');
const R="23456789TJQKA";
const idx=c=>R.indexOf(c);
const combos=c=>c.length===2?6:(c[2]==='s'?4:12);

function expand(spec){
  const out=new Set();
  spec.split(/\s+/).filter(Boolean).forEach(tok=>{
    let m;
    if((m=tok.match(/^([2-9TJQKA])\1\+$/))){
      for(let r=idx(m[1]);r<=12;r++) out.add(R[r]+R[r]);
    } else if((m=tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])\+$/))){
      const hi=idx(m[1]);
      for(let lo=idx(m[2]);lo<hi;lo++) out.add(R[hi]+R[lo]+m[3]);
    } else if((m=tok.match(/^([2-9TJQKA])([2-9TJQKA])([so])-([2-9TJQKA])([2-9TJQKA])\3$/))){
      const hi=idx(m[1]);
      for(let lo=idx(m[5]);lo<=idx(m[2]);lo++) out.add(R[hi]+R[lo]+m[3]);
    } else if((m=tok.match(/^([2-9TJQKA])\1-([2-9TJQKA])\2$/))){
      for(let r=idx(m[2]);r<=idx(m[1]);r++) out.add(R[r]+R[r]);
    } else out.add(tok);
  });
  return [...out];
}

/* ---------------------------------------------------------------
   Situace PROTI ZVÝŠENÍ a PROTI 3-BETU.
   Konvenční začátečnické tabulky, ne výstup ze solveru.
   Každá má tři akce: zvýšit / dorovnat / složit (zbytek).
   --------------------------------------------------------------- */
const SPEC={
  /* někdo přede mnou zvýšil, jsem v pozici, zvyšoval hráč z rané pozice (má úzkou range) */
  IP_EARLY:{
    raise:"QQ+ AKs AKo AQs A5s A4s",
    call: "77-JJ AJs ATs KQs KJs QJs JTs T9s 98s 87s 76s AQo"
  },
  /* někdo přede mnou zvýšil, jsem v pozici, zvyšoval hráč z pozdní pozice (má širokou range) */
  IP_LATE:{
    raise:"TT+ AQs+ AJs AKo AQo A5s A4s A3s KJs",
    call: "22-99 ATs A9s A8s KQs KTs QJs QTs JTs J9s T9s 98s 87s 76s 65s AJo KQo"
  },
  /* bráním velký blind — už mám v banku peníze, takže dorovnávám hodně široce */
  BB_DEFEND:{
    raise:"JJ+ AQs+ AKo A5s A4s A3s A2s",
    call: "22-TT ATs-A6s K2s+ Q6s+ J7s+ T7s+ 96s+ 85s+ 75s+ 64s+ 54s AJo-A7o K9o+ QTo+ JTo T9o AQo"
  },
  /* zvýšil jsem a někdo mě 3-betnul, jsem v pozici */
  VS3_IP:{
    raise:"QQ+ AKs AKo A5s",
    call: "99-JJ AQs AJs ATs KQs QJs JTs AQo"
  },
  /* zvýšil jsem a někdo mě 3-betnul, jsem mimo pozici — hraju těsněji */
  VS3_OOP:{
    raise:"QQ+ AKs AKo",
    call: "JJ TT AQs AJs KQs"
  }
};
const LABEL={
  IP_EARLY:"v pozici proti ranému otevření",
  IP_LATE:"v pozici proti pozdnímu otevření",
  BB_DEFEND:"obrana velkého blindu",
  VS3_IP:"proti 3-betu, v pozici",
  VS3_OOP:"proti 3-betu, mimo pozici"
};

const out={};
let bad=0;
const must=(c,m)=>{ if(!c){bad++;console.log('  ✗ '+m);} };

console.log('SITUACE                             zvýšit  dorovnat  složit');
for(const k in SPEC){
  const raise=expand(SPEC[k].raise), call=expand(SPEC[k].call);
  const over=raise.filter(h=>call.includes(h));
  must(over.length===0,k+': ruka je zároveň ve zvýšení i v dorovnání: '+over.join(' '));
  raise.concat(call).forEach(h=>must(D[h]!==undefined,k+': neznámá ruka '+h));
  const cr=raise.reduce((a,h)=>a+combos(h),0), cc=call.reduce((a,h)=>a+combos(h),0);
  const pr=cr/1326*100, pc=cc/1326*100, pf=100-pr-pc;
  console.log('  '+LABEL[k].padEnd(34)+(pr.toFixed(0)+'%').padStart(6)+(pc.toFixed(0)+'%').padStart(10)+(pf.toFixed(0)+'%').padStart(8));
  must(pr>1&&pr<25,k+': nesmyslná frekvence zvýšení '+pr.toFixed(1)+'%');
  must(pf>25,k+': skládá se jen '+pf.toFixed(1)+'% — moc široké');
  out[k]={raise:raise,call:call,pr:+pr.toFixed(1),pc:+pc.toFixed(1),pf:+pf.toFixed(1),label:LABEL[k]};
}

console.log('\nTESTY:');
/* nejsilnější ruce musí být vždycky ve zvýšení */
['AA','KK','QQ','AKs'].forEach(h=>{
  for(const k in out) must(out[k].raise.includes(h),k+' musí zvyšovat s '+h);
});
/* odpad se musí vždycky skládat */
['72o','32o','92o','83o'].forEach(h=>{
  for(const k in out) must(!out[k].raise.includes(h)&&!out[k].call.includes(h),k+' nesmí hrát '+h);
});
/* obrana blindu musí být širší než hra v pozici proti ranému otevření */
must(out.BB_DEFEND.call.length>out.IP_EARLY.call.length,'BB musí dorovnávat víc rukou než IP proti ranému otevření');
/* proti 3-betu se musí hrát těsněji než proti obyčejnému zvýšení */
must(out.VS3_IP.raise.length+out.VS3_IP.call.length < out.IP_EARLY.raise.length+out.IP_EARLY.call.length,
     'proti 3-betu se musí hrát těsněji než proti otevření');
must(out.VS3_OOP.call.length<out.VS3_IP.call.length,'mimo pozici se musí proti 3-betu dorovnávat míň');
/* pozdní otevření se musí atakovat víc než rané */
must(out.IP_LATE.raise.length>out.IP_EARLY.raise.length,'proti pozdnímu otevření se musí 3-betovat víc');
console.log(bad===0?'  ✅ vše prošlo':'  ❌ '+bad+' chyb');

require('fs').writeFileSync('charts.json',JSON.stringify({rfi:RFI,spots:out}));
console.log('\nzapsáno charts.json ('+require('fs').statSync('charts.json').size+' B)');
process.exit(bad?1:0);
