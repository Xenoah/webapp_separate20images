(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SplitCore=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const finite=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
  function geometry({W,H,n=5,dir='h',unit='pct',gap=8,trim=true}){
    const L=dir==='h'?W:H;
    if(!Number.isSafeInteger(L)||L<1)throw new RangeError('画像の寸法が不正です。');
    n=Math.max(1,Math.min(50,L,Math.round(finite(n,5))));
    gap=Math.max(0,finite(gap,0));
    // Leave at least one source pixel in each piece, even for extreme input.
    const maxCut=n>1?(L-n)/(n-1):0;
    let cut=0,show=0,w=L/n;
    if(unit==='pct'){
      gap=Math.min(100,gap);
      const r=gap/100;
      if(trim&&n>1){cut=Math.min(maxCut,r*L/(n+(n-1)*r));w=(L-(n-1)*cut)/n;show=cut;}
      else show=n>1?r*w:0;
    }else{
      gap=Math.min(L,gap);
      if(trim&&n>1){cut=Math.min(gap,maxCut);w=(L-(n-1)*cut)/n;show=cut;}
      else show=n>1?gap:0;
    }
    const parts=Array.from({length:n},(_,i)=>{
      const a=Math.round(i*(w+cut));
      // Use the same expression as the next start: repeated addition can cross
      // a half-pixel boundary differently and lose a pixel even with zero trim.
      const b=i===n-1?L:Math.round((i+1)*(w+cut)-cut);
      return {a,len:b-a};
    });
    const lost=L-parts.reduce((sum,p)=>sum+p.len,0);
    return {L,n,w,cut,show,parts,lost};
  }
  return {geometry};
});
