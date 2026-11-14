
(function(){
"use strict";
const $=id=>document.getElementById(id);
const st={src:null,W:0,H:0,name:"sample",n:5,dir:"h",unit:"pct",gap:8,trim:true,fmt:"jpg",isSample:true};
let downloads=null, pieces=[], genToken=0, genTimer=0, loadToken=0, busy=true, loading=false, sharing=false,sourceError="";

/* ---------- sample image so the tool opens in a working state ---------- */
function makeSample(){
  const c=document.createElement("canvas");c.width=2400;c.height=1000;
  const x=c.getContext("2d");
  const sky=x.createLinearGradient(0,0,0,700);
  sky.addColorStop(0,"#9fc3e6");sky.addColorStop(1,"#e4eef5");
  x.fillStyle=sky;x.fillRect(0,0,2400,1000);
  x.fillStyle="rgba(255,255,255,.75)";
  [[380,210,120],[520,240,90],[1500,160,110],[1650,190,80],[2100,260,70]].forEach(([cx,cy,r])=>{x.beginPath();x.ellipse(cx,cy,r*1.8,r*.6,0,0,7);x.fill();});
  const ridges=[["#9db3c2",520,60],["#6f8fa0",600,80],["#4f7b74",690,70],["#3c6a4a",780,60],["#2d5237",880,40]];
  ridges.forEach(([col,base,amp],k)=>{
    x.fillStyle=col;x.beginPath();x.moveTo(0,1000);
    for(let i=0;i<=2400;i+=8){
      const y=base-amp*Math.sin(i/(260-k*30)+k*1.7)-amp*.5*Math.sin(i/(97+k*11)+k)-amp*.2*Math.sin(i/31+k*3);
      x.lineTo(i,y);
    }
    x.lineTo(2400,1000);x.closePath();x.fill();
  });
  x.fillStyle="rgba(255,255,255,.85)";x.font="700 44px sans-serif";x.fillText("SAMPLE",40,70);
  return c;
}

/* ---------- geometry: edges are never trimmed, only the strips between pieces ---------- */
function geom(){
  return SplitCore.geometry(st);
}

function drawPreview(){
  if(!st.src)return;
  const g=geom(), cv=$("preview"), h=st.dir==="h";
  const cross=h?st.H:st.W;
  const total=st.n*g.w+(st.n-1)*g.show;
  const maxPx=1400;
  const s=Math.min(maxPx/(h?total:cross), 1800/(h?cross:total), 1);
  cv.width=Math.max(1,Math.round((h?total:cross)*s));
  cv.height=Math.max(1,Math.round((h?cross:total)*s));
  const x=cv.getContext("2d");
  x.clearRect(0,0,cv.width,cv.height);
  g.parts.forEach((p,i)=>{
    const d=i*(g.w+g.show)*s;
    if(h)x.drawImage(st.src,p.a,0,p.len,st.H,d,0,g.w*s,cv.height);
    else x.drawImage(st.src,0,p.a,st.W,p.len,0,d,cv.width,g.w*s);
  });
  const lengths=g.parts.map(p=>p.len), min=Math.min(...lengths), max=Math.max(...lengths);
  const pw=min===max?String(min):min+"〜"+max, lost=g.lost;
  const size=h?pw+" × "+st.H:st.W+" × "+pw;
  $("stats").innerHTML=
    "<span>元画像 <b>"+st.W+" × "+st.H+"</b> px"+(st.isSample?"（サンプル）":"")+"</span>"+
    "<span>1枚 <b>"+size+"</b> px</span>"+
    "<span>隙間 <b>"+(Math.round(g.show*10)/10)+"</b> px</span>"+
    "<span>切り取る合計 <b>"+lost+"</b> px</span>";
  $("trimHint").textContent=st.trim
    ?"隙間に隠れる部分を捨てるので、並べると1枚の写真としてつながって見えます。左右（上下）の端は切りません。"
    :"何も捨てずに等分します。並べると隙間の分だけ絵がずれて見えます。";
  updatePreviewMode();
}

function updatePreviewMode(){
  const mobile=$("mobilePreview").checked&&st.dir==="h";
  $("mobilePreview").disabled=st.dir!=="h";
  $("mobileStrip").hidden=!mobile;
  $("overview").hidden=mobile;
  $("previewHint").hidden=!mobile;
  if(mobile&&st.H)$("mobileStrip").style.gap=(geom().show*$("mobileStrip").clientHeight/st.H)+"px";
}
function shareFiles(){return pieces.map(p=>new File([p.blob],p.name,{type:p.blob.type}));}
function canShare(){
  try{return !!(pieces.length&&navigator.share&&navigator.canShare&&navigator.canShare({files:shareFiles()}));}
  catch{return false;}
}
function updateSaveState(){
  const blocked=busy||loading||sharing||!pieces.length;
  $("pieces").setAttribute("aria-busy",String(busy||loading));
  $("zipBtn").disabled=blocked||seqRun;
  $("shareBtn").disabled=blocked||seqRun;
  $("shareBtn").hidden=!canShare();
  $("seqBtn").disabled=blocked&&!seqRun;
  $("pieces").querySelectorAll("button").forEach(b=>b.disabled=blocked||seqRun);
}

/* ---------- full-resolution pieces ---------- */
function toBlob(canvas,type,q){return new Promise(res=>canvas.toBlob(res,type,q));}
async function generate(){
  const token=genToken;
  if(!st.src)return;
  const snapshot={...st},g=SplitCore.geometry(snapshot),h=snapshot.dir==="h",out=[];
  const type=snapshot.fmt==="png"?"image/png":"image/jpeg";
  const digits=Math.max(2,String(g.n).length);
  try{
    for(let i=0;i<g.parts.length;i++){
      if(token!==genToken)return;
      const p=g.parts[i],c=document.createElement("canvas");
      c.width=h?p.len:snapshot.W;c.height=h?snapshot.H:p.len;
      const x=c.getContext("2d");
      if(!x)throw new Error("canvas unavailable");
      if(snapshot.fmt==="jpg"){x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);}
      if(h)x.drawImage(snapshot.src,p.a,0,p.len,snapshot.H,0,0,p.len,snapshot.H);
      else x.drawImage(snapshot.src,0,p.a,snapshot.W,p.len,0,0,snapshot.W,p.len);
      const blob=await toBlob(c,type,0.95);
      c.width=1;c.height=1;
      if(token!==genToken)return;
      if(!blob)throw new Error("image encoding failed");
      out.push({blob,name:snapshot.name+"_"+String(i+1).padStart(digits,"0")+"."+snapshot.fmt});
    }
    pieces.forEach(p=>URL.revokeObjectURL(p.url));
    pieces=out.map(p=>Object.assign(p,{url:URL.createObjectURL(p.blob)}));
    busy=false;renderPieces();
    say(sourceError||pieces.length+"枚の画像を作成しました。01から順番に添付してください。",!!sourceError);
  }catch(e){
    if(token!==genToken)return;
    pieces.forEach(p=>URL.revokeObjectURL(p.url));pieces=[];busy=false;renderPieces();
    say("画像の書き出しに失敗しました。画像を小さくして再度選んでください。",true);
  }
}
function renderPieces(){
  const box=$("pieces");box.textContent="";
  pieces.forEach((p,i)=>{
    const d=document.createElement("div");d.className="piece";
    const im=document.createElement("img");im.src=p.url;im.alt=(i+1)+"枚目";
    d.appendChild(im);
    if(downloads){
      const b=document.createElement("button");b.type="button";b.textContent=(i+1)+"枚目を保存";
      b.addEventListener("click",()=>save(p.name,p.blob));
      d.appendChild(b);
    }
    box.appendChild(d);
  });
  $("zipBtn").hidden=!downloads;
  $("seqRow").hidden=!downloads;
  $("mobileStrip").replaceChildren(...pieces.map((p,i)=>{const im=new Image();im.src=p.url;im.alt=(i+1)+"枚目のプレビュー";return im;}));
  $("saveHint").textContent="01から順番に添付してください。スマホはZIP保存・画像の長押し、対応端末では共有を利用できます。連続ダウンロードは端末によって制限されます。";
  updatePreviewMode();updateSaveState();
}
function say(t,err){const m=$("msg");m.textContent=t||"";m.className=err?"err":"";}
async function save(filename,data){
  if(!downloads)return;
  say("");
  try{await downloads.save({filename:filename,data:data});say(filename+" の保存を要求しました。端末のダウンロードを確認してください。");}
  catch(e){
    const c=e&&e.code;
    if(c==="declined")return;
    if(c==="rate_limited")say("保存の確認が続いています。少し待ってからもう一度押してください。",true);
    else if(c==="too_large")say("ファイルが大きすぎて保存できませんでした。JPEGにするか分割数を増やしてください。",true);
    else say("ここでは保存できませんでした。画像を長押しして保存してください。",true);
  }
}

/* ---------- save all pieces in order, at a fixed interval ---------- */
let seqRun=false,seqToken=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
$("seqBtn").addEventListener("click",async()=>{
  if(seqRun){seqRun=false;seqToken++;return;}
  if(!downloads||!pieces.length||busy||loading||sharing)return;
  seqRun=true;const run=++seqToken;updateSaveState();
  const list=pieces.slice(), wait=Number($("seqInt").value)*1000, btn=$("seqBtn");
  btn.textContent="止める";
  let done=0, note="", err=false;
  for(let i=0;i<list.length&&seqRun&&run===seqToken;i++){
    say((i+1)+" / "+list.length+" 枚目を保存しています。");
    let tries=0, ok=false;
    while(seqRun&&run===seqToken){
      try{await downloads.save({filename:list[i].name,data:list[i].blob});ok=true;break;}
      catch(e){
        const c=e&&e.code;
        if(c==="rate_limited"&&tries++<6){await sleep(3000);continue;}
        if(c==="declined")note="保存がキャンセルされたので止めました。";
        else if(c==="rate_limited"){note="保存の確認が混み合っています。間隔を長くしてもう一度試してください。";err=true;}
        else{note="ここでは保存できませんでした。画像を長押しして保存してください。";err=true;}
        seqRun=false;
      }
    }
    if(!ok)break;
    done++;
    if(i<list.length-1&&seqRun)await sleep(wait);
  }
  if(run!==seqToken){if(!seqRun){btn.textContent="1枚目から順番に保存";updateSaveState();}return;}
  seqRun=false;btn.textContent="1枚目から順番に保存";updateSaveState();
  if(done===list.length)say(list.length+"枚の保存を要求しました。ブラウザによる制限があるため、端末で枚数を確認してください。");
  else say(done+" / "+list.length+" 枚の保存を要求しました。"+(note||"途中で止めました。"),err);
});

/* ---------- store-only ZIP ---------- */
const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=crcT[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
async function buildZip(files){
  const enc=new TextEncoder(), parts=[], central=[];let off=0;
  for(const f of files){
    const data=new Uint8Array(await f.blob.arrayBuffer()), name=enc.encode(f.name), crc=crc32(data);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);
    lh.setUint16(10,0,true);lh.setUint16(12,0x21,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);
    lh.setUint16(26,name.length,true);lh.setUint16(28,0,true);
    parts.push(lh.buffer,name,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);
    ch.setUint16(10,0,true);ch.setUint16(12,0,true);ch.setUint16(14,0x21,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);
    ch.setUint16(28,name.length,true);ch.setUint32(42,off,true);
    central.push(ch.buffer,name);
    off+=30+name.length+data.length;
  }
  let csize=0;central.forEach(b=>csize+=b.byteLength);
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);
  end.setUint32(12,csize,true);end.setUint32(16,off,true);
  return new Blob(parts.concat(central,[end.buffer]),{type:"application/zip"});
}

/* ---------- controls ---------- */
function schedule(){
  // Invalidate at the input event, before the debounce delay starts.
  genToken++;busy=true;seqRun=false;seqToken++;
  $("seqBtn").textContent="1枚目から順番に保存";
  normalizeControls();updateSaveState();
  $("mobileStrip").replaceChildren();
  say(loading?"画像を読み込んでいます。":"画像を作成中です。");
  drawPreview();
  clearTimeout(genTimer);
  if(!loading)genTimer=setTimeout(generate,120);
}
function normalizeControls(){
  const L=st.dir==="h"?st.W:st.H,max=Math.min(50,L),min=Math.min(2,max);
  st.n=Math.max(min,Math.min(max,Math.round(st.n)));
  for(const id of ["nRange","nNum"]){$(id).min=min;$(id).max=max;if($(id)!==document.activeElement)$(id).value=st.n;}
  st.gap=Math.min(st.unit==="pct"?100:L,Math.max(0,st.gap));
  syncGapControls();
}
function syncGapControls(){
  const r=$("gapRange"), n=$("gapNum");
  if(st.unit==="pct"){r.max=100;r.step=0.1;n.step=0.1;$("presets").hidden=false;}
  else{
    const L=st.dir==="h"?st.W:st.H;
    r.max=L;r.step=0.1;n.step=0.1;$("presets").hidden=true;
  }
  n.max=r.max;r.value=st.gap;if(n!==document.activeElement)n.value=st.gap;
}
function setN(v){
  v=Math.round(Number(v));if(!isFinite(v))return;
  st.n=Math.max(2,Math.min(50,v));
  schedule();
}
function setGap(v){
  v=Number(v);if(!isFinite(v)||v<0)v=0;
  if(st.unit==="pct")v=Math.min(100,v);
  st.gap=v;schedule();
}
$("nRange").addEventListener("input",e=>setN(e.target.value));
$("nNum").addEventListener("input",e=>{if(e.target.value!=="")setN(e.target.value);});
$("nNum").addEventListener("change",()=>{$("nNum").value=st.n;schedule();});
$("gapRange").addEventListener("input",e=>setGap(e.target.value));
$("gapNum").addEventListener("input",e=>{if(e.target.value!=="")setGap(e.target.value);});
$("gapNum").addEventListener("change",()=>{$("gapNum").value=st.gap;schedule();});
$("gapUnit").addEventListener("change",e=>{
  const g=geom();
  st.unit=e.target.value;
  st.gap=st.unit==="px"?Math.round(g.show*10)/10:Math.round(g.show/g.w*1000)/10;
  syncGapControls();schedule();
});
$("presets").addEventListener("click",e=>{const b=e.target.closest("button");if(b)setGap(b.dataset.g);});
document.querySelectorAll("input[name=dir]").forEach(r=>r.addEventListener("change",e=>{st.dir=e.target.value;syncGapControls();schedule();}));
$("trim").addEventListener("change",e=>{st.trim=e.target.checked;schedule();});
$("fmt").addEventListener("change",e=>{st.fmt=e.target.value;schedule();});
$("mobilePreview").addEventListener("change",updatePreviewMode);
new ResizeObserver(updatePreviewMode).observe($("mobileStrip"));
$("shareBtn").addEventListener("click",async()=>{
  if(busy||loading||sharing||seqRun||!canShare())return;
  const files=shareFiles();sharing=true;updateSaveState();
  try{await navigator.share({files});say("共有先に画像を渡しました。投稿前に枚数と順番を確認してください。");}
  catch(e){if(e.name!=="AbortError")say("まとめて共有できませんでした。ZIP保存か1枚ずつの保存を利用してください。",true);}
  finally{sharing=false;updateSaveState();}
});
$("zipBtn").addEventListener("click",async()=>{
  if(!pieces.length||busy||loading||sharing||seqRun)return;
  const list=pieces.slice(),filename=st.name+"_split"+list.length+".zip",token=genToken;
  sharing=true;updateSaveState();say("ZIPを作成中です。");
  try{const z=await buildZip(list);if(token===genToken)await save(filename,z);}
  catch(e){say("ZIPを作成できませんでした。1枚ずつ保存してください。",true);}
  finally{sharing=false;updateSaveState();}
});
$("file").addEventListener("change",e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  const token=++loadToken,url=URL.createObjectURL(f),im=new Image();
  loading=true;sourceError="";schedule();
  e.target.value="";
  im.onload=()=>{
    URL.revokeObjectURL(url);if(token!==loadToken)return;
    loading=false;
    if(!im.naturalWidth||!im.naturalHeight){schedule();say("画像の寸法を読み込めませんでした。",true);return;}
    st.src=im;st.W=im.naturalWidth;st.H=im.naturalHeight;st.isSample=false;
    st.name=(f.name||"photo").replace(/\.[^.]+$/,"").replace(/[^\w぀-ヿ一-鿿-]+/g,"_").slice(0,60)||"photo";
    say("");syncGapControls();schedule();
  };
  im.onerror=()=>{URL.revokeObjectURL(url);if(token!==loadToken)return;loading=false;sourceError="この画像は読み込めませんでした。JPEGかPNGの写真を選んでください。";schedule();say(sourceError,true);};
  im.src=url;
});
$("testBtn").addEventListener("click",()=>{
  ++loadToken;loading=false;sourceError="";
  const c=CirclePattern.draw(document.createElement("canvas"));
  Object.assign(st,{src:c,W:c.width,H:c.height,name:"circle_test_20_gap8",n:20,dir:"h",unit:"pct",gap:8,trim:true,fmt:"png",isSample:false});
  $("dirH").checked=true;$("gapUnit").value="pct";$("trim").checked=true;$("fmt").value="png";
  $("mobilePreview").checked=true;$("mobileStrip").scrollLeft=0;schedule();
});

/* ---------- start ---------- */
const sample=makeSample();
st.src=sample;st.W=sample.width;st.H=sample.height;
syncGapControls();schedule();
if(window.claude&&typeof window.claude.use==="function"){
  window.claude.use("downloads").then(d=>{downloads=d||null;if(pieces.length)renderPieces();}).catch(()=>{});
}else{
  /* standalone (GitHub Pages etc.): ordinary browser download */
  downloads={save:function(o){
    const blob=o.data instanceof Blob?o.data:new Blob([o.data]);
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url;a.download=o.filename;a.style.display="none";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return Promise.resolve({status:"saved"});
  }};
  renderPieces();
}
})();
