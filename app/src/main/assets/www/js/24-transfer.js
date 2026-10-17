/* =====================================================================
 * Daftari · 24-transfer.js
 * ---------------------------------------------------------------------
 * Trash, WhatsApp/SMS, Bluetooth, QR transfer
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
function trashRestore(id){const tr=DD().trash||[];const ix=tr.findIndex(e=>e.o.id===id);if(ix<0)return;const e=tr[ix];tr.splice(ix,1);(e.k==='d'?DD().invoices:e.k==='p'?DD().payments:DD().customers).push(e.o);save();render();toastMsg(t('restore')+' ✓')}
function trashPurge(){if(!confirm(t('emptyTrashQ')))return;DD().trash=[];save();render()}
function waRemind(invId){const i=DD().invoices.find(x=>x.id===invId);if(!i)return;const c=cust(i.cust);if(!c||!c.phone){toastMsg(t('waNoPhone'));return}
 const msg=(db.lang==='ar'?'السلام عليكم '+c.name+'، يذكّركم '+curAcc().name+' بمتبقي '+fmt(invRem(i.id))+' '+CUR()+(i.due?' (استحقاق '+dateStr(i.due)+')':'')+' — جزاكم الله خيرًا':'Hello '+c.name+', '+curAcc().name+' reminds you of the remaining '+fmt(invRem(i.id))+' '+CUR()+'. Thank you!');
 window.open('https://wa.me/'+(c.phone||'').replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg));}
let btDev=null,btChar=null;
const BT_SERV=['000018f0-0000-1000-8000-00805f9b34fb','0000ff00-0000-1000-8000-00805f9b34fb','e7810a71-73ae-499d-8c15-faa9aef0c3f2','49535343-fe7d-4ae5-8fa9-9fafd205e455'];
async function connectBT(){if(!navigator.bluetooth){toastMsg(t('btNo'));return}
 try{const dev=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:BT_SERV});
  btDev=dev;const server=await dev.gatt.connect();
  for(const su of BT_SERV){try{const svc=await server.getPrimaryService(su);const chs=await svc.getCharacteristics();btChar=chs.find(c=>c.properties.write||c.properties.writeWithoutResponse);if(btChar)break}catch(e){}}
  if(!btChar)throw 0;sec.btName=dev.name||'BT';saveSec();render();toastMsg('🖨 '+esc(sec.btName))}catch(e){toastMsg(t('btFail'))}}
async function btWrite(bytes){if(!btChar)throw 0;for(let i=0;i<bytes.length;i+=100)await btChar.writeValue(bytes.slice(i,i+100))}
async function printBT(text){if(!btChar){toastMsg(t('btNoDev'));return}
 try{await btWrite(new Uint8Array([0x1b,0x40]));await btWrite(new TextEncoder().encode(text+'\n\n\n'));await btWrite(new Uint8Array([0x1d,0x56,0x42,0x00]));toastMsg('🖨 ✓')}catch(e){toastMsg(t('btFail'))}}
function btStatement(id){const c=cust(id);const L=[curAcc().name+' · '+t('appName'),t('cust')+': '+c.name,'----------------------------'];
 custInvoices(id).forEach(i=>L.push(i.code+'  '+fmt(i.amount)+(i.edits&&i.edits.length?'  ('+t('edited')+' '+new Date(i.edits[i.edits.length-1].ts).toLocaleDateString('en-GB')+')':'')+'  '+new Date(i.ts).toLocaleDateString('en-GB')));
 L.push('----------------------------',t('remaining')+': '+fmt(custOpen(id))+' '+CUR());return L.join('\n')}
function qrB64(u){let b='';for(let i=0;i<u.length;i+=8192)b+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(b)}
async function openQrSend(){if(typeof qrcode==='undefined'){toastMsg('QR');return}
 const json=JSON.stringify({v:1,db});let payload='J'+json;
 try{if(window.CompressionStream){const cs=new CompressionStream('gzip');const rs=new Blob([json]).stream().pipeThrough(cs);const buf=await new Response(rs).arrayBuffer();const z=qrB64(new Uint8Array(buf));if(z.length<json.length)payload='Z'+z}}catch(e){}
 if(payload.length>2900){toastMsg(t('qrBig'));return}
 const q=qrcode(0,'L');q.addData(payload,'Byte');q.make();
 openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('qrSend')+'</h3><span class="sp"></span><button class="hbtn" onclick="closeSheet()">'+ic('x',17)+'</button></div><div class="card" style="padding:16px;background:#fff;display:flex;justify-content:center" dir="ltr">'+q.createSvgTag({scalable:true})+'</div><div class="muted" style="text-align:center;margin-top:10px">'+t('qrHint')+'</div>')}
async function qrDecompress(b64){const bin=atob(b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const ds=new DecompressionStream('gzip');const rs=new Blob([u]).stream().pipeThrough(ds);return await new Response(rs).text()}
function stopQr(){clearInterval(window.__qrTimer);if(window.__qrStream){window.__qrStream.getTracks().forEach(t=>t.stop());window.__qrStream=null}}
async function openQrStmt(id){if(typeof qrcode==='undefined'){toastMsg('QR');return}
 const txt=statementText(id);if(txt.length>2900){toastMsg(t('qrBig'));return}
 const q=qrcode(0,'L');q.addData(txt,'Byte');q.make();
 openSheet('<h3>'+t('qrStmt')+' — '+esc(cust(id).name)+'</h3><div style="display:flex;justify-content:center;padding:14px 0"><div style="background:#fff;padding:12px;border-radius:14px;width:max-content">'+q.createImgTag(4,0).replace('<img ','<img style="width:220px;height:220px" ')+'</div></div><div class="muted" style="text-align:center;line-height:1.8;font-size:12.5px">'+t('qrStmtHint')+'</div><div class="transcript" style="margin-top:12px;max-height:130px;overflow:auto;white-space:pre-line;text-align:start">'+esc(txt)+'</div>');}
function openQrRecv(){if(typeof jsQR==='undefined'){toastMsg('QR');return}
 openSheet('<div class="row" style="margin-bottom:10px"><h3 style="margin:0">'+t('qrRecv')+'</h3><span class="sp"></span><button class="hbtn" onclick="stopQr();closeSheet()">'+ic('x',17)+'</button></div><div class="card" style="overflow:hidden"><video id="qrVid" autoplay playsinline muted style="width:100%;display:block"></video></div><div class="muted" style="text-align:center;margin:10px 0">'+t('qrScan')+'</div>');
 if(!navigator.mediaDevices){toastMsg(t('qrCam'));return}
 navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(st=>{window.__qrStream=st;const v=document.getElementById('qrVid');if(!v){st.getTracks().forEach(t=>t.stop());return}v.srcObject=st;const cv=document.createElement('canvas');const cx=cv.getContext('2d');
  window.__qrTimer=setInterval(()=>{if(!v.videoWidth)return;cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);const res=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height);
   if(res&&res.data){stopQr();closeSheet();qrApply(res.data)}},400);
 }).catch(()=>{stopQr();toastMsg(t('qrCam'))})}
async function qrApply(payload){try{const json=payload[0]==='Z'?await qrDecompress(payload.slice(1)):payload.slice(1);const obj=JSON.parse(json);if(obj&&obj.format==='dafter-backup'){await Backup.restore(obj);return}
 if(!obj||!obj.db)throw 0;
 db=migrate(obj.db);save();stack=[{s:'home'}];render();toastMsg(t('qrDone'))}catch(e){toastMsg(db.lang==='ar'?'تعذّرت قراءة البيانات':'Could not read data')}}
function selFind(k){const d=DD();const id=k.substring(2);return k[0]==='d'?d.invoices.find(x=>x.id===id):d.payments.find(x=>x.id===id)}
function fallbackCopy(text){try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toastMsg(t('copied'))}catch(e){toastMsg(esc(text.slice(0,80)))}}
function selShare(){if(!ui.sel||!ui.sel.on||!ui.sel.ids.length){toastMsg(t('selEmpty'));return}
 const lines=ui.sel.ids.map(k=>{const it=selFind(k);if(!it)return null;const c=it.cust?cust(it.cust):null;
  if(k[0]==='d')return (c?c.name+' — ':'')+t('newDebt')+': '+fmt(it.amount)+' '+CUR()+(it.note?' — '+it.note:'')+' ('+dateStr(it.ts)+')';
  return (c?c.name+' — ':'')+t('pay')+': '+fmt(it.amount)+' '+CUR()+' ('+dateStr(it.ts)+')';}).filter(Boolean);
 const text=curAcc().name+'\n'+lines.join('\n');
 if(navigator.share){navigator.share({text}).catch(()=>{})}
 else if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>toastMsg(t('copied'))).catch(()=>fallbackCopy(text))}
 else fallbackCopy(text);}
function selArchive(){if(!ui.sel||!ui.sel.on||!ui.sel.ids.length){toastMsg(t('selEmpty'));return}
 const ids=ui.sel.ids.slice();const n=ids.length;
 ids.forEach(k=>{const it=selFind(k);if(it)it.arch=true});
 save();ui.sel={on:false,ids:[]};render();
 toastMsg(t('txArchived')(n),()=>{ids.forEach(k=>{const it=selFind(k);if(it)it.arch=false});save();render()});}
