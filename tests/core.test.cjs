const {test}=require('node:test');
const assert=require('node:assert/strict');
const {geometry}=require('../split-core.js');
test('20 mobile panels are exactly 600 × 800 with 48 px internal gaps',()=>{
  const g=geometry({W:12912,H:800,n:20,gap:8,trim:true});
  assert.equal(g.w,600);assert.equal(g.cut,48);assert.equal(g.lost,912);
  assert.deepEqual(g.parts,Array.from({length:20},(_,i)=>({a:i*648,len:600})));
});
test('no trim partitions every source pixel once, including odd dimensions',()=>{
  for(const dir of ['h','v'])for(const L of [1,2,3,6,17,199,801,12912])for(let n=2;n<=50;n++){
    const g=geometry({W:L,H:L,dir,n,gap:100,trim:false});
    let cursor=0;for(const p of g.parts){assert.equal(p.a,cursor);cursor+=p.len;}
    assert.equal(cursor,L);assert.equal(g.lost,0);
  }
});
test('all parts are in bounds, nonempty, nonoverlapping and keep the outer edges',()=>{
  let count=0;
  for(const L of [1,2,3,6,7,19,50,99,600,800,2400,12912])
  for(const n of [2,3,5,20,50,500])for(const gap of [0,.1,1,8,30,99,100,800,1e20,NaN,Infinity,-1])
  for(const unit of ['px','pct'])for(const trim of [true,false]){
    const g=geometry({W:L,H:L,n,gap,unit,trim});
    assert.equal(g.parts.length,g.n);assert.equal(g.parts[0].a,0);
    let last=0;for(const p of g.parts){assert.ok(p.len>=1);assert.ok(p.a>=last);last=p.a+p.len;assert.ok(last<=L);}
    assert.equal(last,L);assert.ok(Number.isFinite(g.show));assert.ok(g.lost>=0);count++;
  }
  assert.equal(count,3456);
});
test('rounding loss is measured from exported pixels, not fractional estimates',()=>{
  const g=geometry({W:17,H:7,n:5,gap:8});
  assert.equal(g.lost,17-g.parts.reduce((sum,p)=>sum+p.len,0));
});
test('invalid source dimensions are rejected',()=>{
  for(const W of [0,-1,NaN,Infinity,1.5])assert.throws(()=>geometry({W,H:10}));
});
