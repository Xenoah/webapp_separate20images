(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.CirclePattern=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const width=12912,height=800,pieceWidth=600,gap=48,count=20;
  // Exact circles and coordinates: this is a calibration target, not an illustration.
  function draw(canvas){
    canvas.width=width;canvas.height=height;
    const x=canvas.getContext('2d');
    x.fillStyle='#f7fafc';x.fillRect(0,0,width,height);
    x.lineWidth=1;x.strokeStyle='#d8e3e9';
    for(let px=0;px<width;px+=40){x.beginPath();x.moveTo(px,0);x.lineTo(px,height);x.stroke();}
    for(let py=0;py<height;py+=40){x.beginPath();x.moveTo(0,py);x.lineTo(width,py);x.stroke();}
    const circle=(cx,cy,r,color,line)=>{x.beginPath();x.arc(cx,cy,r,0,2*Math.PI);x.strokeStyle=color;x.lineWidth=line;x.stroke();};
    for(let i=0;i<count;i++){
      const start=i*(pieceWidth+gap),cx=start+pieceWidth/2;
      circle(cx,355,210,'#096bca',10);circle(cx,355,154,'#096bca',3);
      x.fillStyle='#132b43';x.font='bold 44px sans-serif';x.textAlign='center';
      x.fillText(String(i+1).padStart(2,'0')+' / 20',cx,76);
      x.font='24px sans-serif';x.fillText('CIRCLE / 600 x 800 / GAP 8%',cx,760);
      // Orange circles straddle each seam. A matching gap restores their geometry.
      if(i<count-1){circle(start+pieceWidth+gap/2,595,150,'#e45925',10);}
    }
    // Horizontal / diagonal lines expose shifts; markers touch all four source edges.
    x.lineWidth=4;x.strokeStyle='#259b83';x.beginPath();x.moveTo(0,355);x.lineTo(width,355);x.stroke();
    x.lineWidth=4;x.strokeStyle='#833dc4';x.beginPath();x.moveTo(0,125);x.lineTo(width,680);x.stroke();
    x.fillStyle='#e11d48';x.fillRect(0,0,12,height);
    x.fillStyle='#0a9b74';x.fillRect(width-12,0,12,height);
    x.fillStyle='#142b43';x.fillRect(0,0,width,8);x.fillRect(0,height-8,width,8);
    return canvas;
  }
  return {width,height,pieceWidth,gap,count,draw};
});
