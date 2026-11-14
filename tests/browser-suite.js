'use strict';
const frame=document.querySelector('#app'),output=document.querySelector('#results'),status=document.querySelector('#status');
const results=[];let w,d;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await delay(35);}throw Error('timeout');}
function assert(v,message){if(!v)throw Error(message);}
function el(id){return d.getElementById(id);}
function input(id,value,type='input'){el(id).value=String(value);el(id).dispatchEvent(new w.Event(type,{bubbles:true}));}
function check(id,value){el(id).checked=value;el(id).dispatchEvent(new w.Event('change',{bubbles:true}));}
async function ready(n){await until(()=>el('pieces').getAttribute('aria-busy')==='false'&&d.querySelectorAll('.piece img').length===n);await Promise.all([...d.querySelectorAll('.piece img')].map(im=>im.decode()));}
function canvas(width,height){const c=d.createElement('canvas');c.width=width;c.height=height;return c;}
async function load(c,name='fixture.png'){
  const b=await new Promise(r=>c.toBlob(r,'image/png'));
  const transfer=new w.DataTransfer();transfer.items.add(new w.File([b],name,{type:'image/png'}));
  el('file').files=transfer.files;el('file').dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>el('stats').textContent.includes(c.width+' × '+c.height));
}
function pixels(im){const c=canvas(im.naturalWidth,im.naturalHeight);c.getContext('2d').drawImage(im,0,0);return c.getContext('2d').getImageData(0,0,c.width,c.height).data;}
function same(a,b,label){assert(a.length===b.length,label+' dimension mismatch');for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(label+' channel '+i+': '+a[i]+' != '+b[i]);}
async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}output.textContent=results.map(r=>(r.pass?'PASS ':'FAIL ')+r.name+(r.error?' — '+r.error:'')).join('\n');status.textContent=results.length+'項目を検証中';}
document.querySelector('#run').onclick=async()=>{
  document.querySelector('#run').disabled=true;results.length=0;output.textContent='';
  try{
    await until(()=>frame.contentWindow.document.getElementById('pieces'));
    w=frame.contentWindow;d=w.document;await ready(5);
    for(const width of [320,360,390,430,768,1280])await test('画面幅 '+width+' pxでページの横はみ出しなし',async()=>{
      frame.width=width;await delay(90);
      assert(d.documentElement.scrollWidth<=width,'page scrollWidth='+d.documentElement.scrollWidth);
      for(const id of ['nNum','gapNum','gapUnit','zipBtn']){
        const r=el(id).getBoundingClientRect();assert(r.left>=0&&r.right<=width,id+' outside viewport');
      }
    });frame.width=390;
    await test('50分割とスライダーの値が一致',async()=>{input('nNum',50);await ready(50);assert(el('nRange').value==='50','slider differs');});
    await test('100%とスライダーの値が一致',async()=>{input('gapNum',100);await ready(50);assert(el('gapRange').value==='100','gap slider differs');});
    await test('○テスト画像から20枚の600 × 800 PNGを作成',async()=>{
      el('testBtn').click();await ready(20);
      for(const im of d.querySelectorAll('.piece img'))assert(im.naturalWidth===600&&im.naturalHeight===800,'incorrect panel size');
    });
    await test('20枚すべての画素が元画像の正しい位置と一致（内側48 pxトリム）',async()=>{
      const source=w.CirclePattern.draw(canvas(1,1)),x=source.getContext('2d');
      [...d.querySelectorAll('.piece img')].forEach((im,i)=>same(pixels(im),x.getImageData(i*648,0,600,800).data,'panel '+(i+1)));
    });
    await test('スマホプレビューで真円の縦横比を保持、隙間8%',async()=>{
      const images=[...el('mobileStrip').querySelectorAll('img')];await Promise.all(images.map(im=>im.decode()));
      const a=images[0].getBoundingClientRect(),b=images[1].getBoundingClientRect();
      assert(Math.abs(a.width/a.height-.75)<.001,'circle stretched');
      assert(Math.abs((b.left-a.right)/a.width-.08)<.001,'gap differs');
      assert(el('mobileStrip').scrollWidth>el('mobileStrip').clientWidth,'not scrollable');
    });
    await test('設定変更直後は旧画像のZIP・個別保存を停止',async()=>{
      input('nNum',19);assert(el('zipBtn').disabled,'old zip enabled');assert([...d.querySelectorAll('.piece button')].every(b=>b.disabled),'old pieces enabled');
      input('nNum',20);await ready(20);
    });
    await test('生成中に設定を連続変更しても最後の設定だけを書き出す',async()=>{
      input('nNum',17);await delay(140);input('nNum',9);input('fmt','jpg','change');input('nNum',20);input('fmt','png','change');await ready(20);
      for(const im of d.querySelectorAll('.piece img'))assert(im.naturalWidth===600,'stale output');
      const b=await fetch(d.querySelector('.piece img').src).then(r=>r.blob());assert(b.type==='image/png','stale format');
    });
    const source=canvas(203,71),sx=source.getContext('2d');
    const data=sx.createImageData(203,71);for(let i=0;i<data.data.length;i+=4){data.data[i]=i/4%251;data.data[i+1]=Math.floor(i/812)*3;data.data[i+2]=101;data.data[i+3]=255;}sx.putImageData(data,0,0);
    for(const dir of ['h','v'])await test((dir==='h'?'横':'縦')+'方向・トリムOFF・奇数寸法の全画素と外端を保持',async()=>{
      await load(source);check(dir==='h'?'dirH':'dirV',true);input('nNum',20);check('trim',false);input('fmt','png','change');await ready(20);
      let pos=0;for(const im of d.querySelectorAll('.piece img')){
        const iw=im.naturalWidth,ih=im.naturalHeight;
        same(pixels(im),sx.getImageData(dir==='h'?pos:0,dir==='h'?0:pos,iw,ih).data,'untrimmed');pos+=dir==='h'?iw:ih;
      }assert(pos===(dir==='h'?203:71),'outer edge missing');
    });
    await test('6 px画像を50分割にしても空白片・範囲外なし',async()=>{
      const c=canvas(6,8),x=c.getContext('2d');x.fillStyle='#f00';x.fillRect(0,0,6,8);await load(c);
      check('dirH',true);input('nNum',50);check('trim',true);input('gapNum',100);await ready(6);
      for(const im of d.querySelectorAll('.piece img')){assert(im.naturalWidth===1,'not one pixel');const p=pixels(im);for(let i=0;i<p.length;i+=4)assert(p[i]===255&&p[i+3]===255,'blank piece');}
    });
    await test('1 × 1 pxも空白や例外なし',async()=>{const c=canvas(1,1);c.getContext('2d').fillRect(0,0,1,1);await load(c);await ready(1);assert(d.querySelector('.piece img').naturalWidth===1,'tiny image');});
    await test('巨大なpx入力を安全な有限値へ制限',async()=>{
      await load(source);input('nNum',5);input('gapUnit','px','change');input('gapNum','1e100');check('trim',false);await ready(5);
      assert(Number(el('gapNum').value)<=203,'unbounded gap');assert(el('preview').width>0&&el('preview').height>0,'invalid canvas');
    });
    await test('透明PNGは透明を維持、JPEGは白背景',async()=>{
      const c=canvas(20,20);await load(c);input('nNum',2);input('gapNum',0);input('fmt','png','change');await ready(2);
      assert(pixels(d.querySelector('.piece img'))[3]===0,'lost alpha');
      input('fmt','jpg','change');await ready(2);const p=pixels(d.querySelector('.piece img'));assert(p[0]>250&&p[1]>250&&p[2]>250&&p[3]===255,'JPEG background not white');
    });
    await test('読めないファイルはエラー表示し、前の画像で復帰',async()=>{
      const dt=new w.DataTransfer();dt.items.add(new w.File(['broken'],'bad.png',{type:'image/png'}));el('file').files=dt.files;el('file').dispatchEvent(new w.Event('change',{bubbles:true}));
      await ready(2);await until(()=>el('msg').textContent.includes('読み込めません'));assert(el('msg').classList.contains('err'),'no error');
    });
    await test('日本語ファイル名のZIPで20 PNGの順序・CRC・内容が一致',async()=>{
      el('testBtn').click();await ready(20);
      const c=w.CirclePattern.draw(canvas(1,1));await load(c,'丸テスト.png');await ready(20);
      let archive,filename;const click=w.HTMLAnchorElement.prototype.click;
      w.HTMLAnchorElement.prototype.click=function(){archive=this.href;filename=this.download;};
      try{el('zipBtn').click();await until(()=>archive);}finally{w.HTMLAnchorElement.prototype.click=click;}
      const bytes=new Uint8Array(await fetch(archive).then(r=>r.arrayBuffer())),view=new DataView(bytes.buffer),decoder=new TextDecoder();
      const crc=b=>{let v=0xffffffff;for(const p of b){v^=p;for(let j=0;j<8;j++)v=(v>>>1)^((v&1)?0xedb88320:0);}return (v^0xffffffff)>>>0;};
      let off=0,i=0;while(view.getUint32(off,true)===0x04034b50){
        const size=view.getUint32(off+18,true),nl=view.getUint16(off+26,true),extra=view.getUint16(off+28,true),start=off+30+nl+extra;
        const name=decoder.decode(bytes.slice(off+30,off+30+nl)),body=bytes.slice(start,start+size);i++;
        assert(name==='丸テスト_'+String(i).padStart(2,'0')+'.png','ZIP order/name '+name);
        assert(crc(body)===view.getUint32(off+14,true),'CRC mismatch');
        const expected=new Uint8Array(await fetch(d.querySelectorAll('.piece img')[i-1].src).then(r=>r.arrayBuffer()));same(body,expected,'ZIP bytes');off=start+size;
      }
      assert(i===20,'wrong ZIP count');assert(view.getUint32(off,true)===0x02014b50,'missing central directory');
      const end=bytes.length-22;assert(view.getUint32(end,true)===0x06054b50,'missing ZIP end');assert(view.getUint16(end+10,true)===20,'central count');
      assert(filename==='丸テスト_split20.zip','wrong archive name');
    });
    el('testBtn').click();await ready(20);
  }catch(e){results.push({name:'test harness',pass:false,error:e.stack});}
  const failed=results.filter(r=>!r.pass);status.textContent=(failed.length?'FAIL':'PASS')+' '+(results.length-failed.length)+' / '+results.length;status.className=failed.length?'fail':'pass';
  output.textContent=results.map(r=>(r.pass?'PASS ':'FAIL ')+r.name+(r.error?' — '+r.error:'')).join('\n');
  document.querySelector('#run').disabled=false;
};
