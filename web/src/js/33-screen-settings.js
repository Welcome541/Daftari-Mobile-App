/* =====================================================================
 * Daftari · 33-screen-settings.js
 * ---------------------------------------------------------------------
 * SCREEN: settings
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const S_settings=()=>{const cur=curAcc();const st=sec.enabled?'var(--green)':'var(--muted)';
 const accRow='<div class="card" style="padding:14px 16px"><div class="row" style="align-items:center;gap:12px">'+
  '<span class="av" style="width:44px;height:44px;background:'+(cur.type==='grocery'?'var(--green-bg);color:var(--green)':'var(--navy-bg);color:var(--navy)')+'">'+ic(cur.type==='grocery'?'store':'user',20)+'</span>'+
  '<div class="sp"><div style="font-weight:800">'+esc(cur.name)+'</div><div class="muted" style="font-size:12.5px">'+t(cur.type==='grocery'?'grocery':'personal')+' · '+(cName(cur.cur)?cName(cur.cur)+' · ':'')+esc(cur.cur)+'</div></div>'+
  '<button class="btn btn-line" style="min-width:0;padding:8px 14px;font-size:13px" onclick="openAccSheet()">'+ic('gear',16)+t('switchAcc')+'</button></div></div>';
 const sec0=(title,body)=>'<div class="lb">'+title+'</div>'+body;
 const kv=(bg,col,icon,label,right,click)=>'<div class="kv"'+(click?' style="cursor:pointer" onclick="'+click+'"':'')+'><span class="kic" style="width:34px;height:34px;border-radius:10px;background:'+bg+';color:'+col+';display:flex;align-items:center;justify-content:center">'+ic(icon,17)+'</span><span class="k" style="margin-inline-start:8px">'+label+'</span><span class="v">'+right+'</span></div>';
 return '<div class="hdr"><button class="hbtn" style="visibility:hidden">.</button><div class="sp" style="text-align:center"><h1>'+t('settings')+'</h1></div><div style="width:42px"></div></div>'+
 '<div class="pad">'+
 sec0(t('account'),accRow)+
 sec0(t('prefs'),'<div class="card" style="padding:6px 16px">'+
 kv('var(--green-bg)','var(--green)','coins',t('country'),'<select class="selctl" aria-label="'+t('country')+'" onchange="if(this.value===\'__c\'){openCurSheet()}else setCur(this.value)">'+COUNTRIES.map(x=>'<option value="'+x[1]+'"'+(cur.cur===x[1]?' selected':'')+'>'+x[0]+' · '+x[1]+'</option>').join('')+(cName(cur.cur)?'':'<option value="'+esc(cur.cur)+'" selected>'+esc(cur.cur)+'</option>')+'<option value="__c">✎ '+t('curCustom')+'</option></select>')+
 '<div class="sep"></div>'+kv(darkOn()?'var(--navy-bg)':'var(--amber-bg)',darkOn()?'var(--navy)':'var(--amber)',darkOn()?'moon':'sun',t('theme'),'<div class="dmsw"><span class="soft" style="font-weight:800;font-size:12px;min-width:38px;text-align:center">'+(sec.darkAuto?t('darkAuto'):darkOn()?t('darkNight'):t('darkDay'))+'</span><div class="sw2 '+(sec.dark?'on':'')+'" role="switch" aria-checked="'+(sec.dark?'true':'false')+'" aria-label="'+t('theme')+'" onclick="sec.dark=!sec.dark;sec.darkAuto=false;saveSec();render()"></div><button class="autochip '+(sec.darkAuto?'on':'')+'" onclick="sec.darkAuto=!sec.darkAuto;saveSec();render()">'+t('darkAuto')+'</button></div>')+
'</div>')+
 sec0(t('sound'),'<div class="card" style="padding:6px 16px">'+
  kv(sec.sound?'var(--green-bg)':'var(--line2)',sec.sound?'var(--green)':'var(--muted)',sec.sound?'bell':'belloff',t('sound'),'<div class="sw2 '+(sec.sound?'on':'')+'" role="switch" aria-checked="'+(sec.sound?'true':'false')+'" aria-label="'+t('sound')+'" onclick="sec.sound=!sec.sound;saveSec();render()"></div>')+
 '<div class="sep"></div>'+
 kv(sec.vib?'var(--green-bg)':'var(--line2)',sec.vib?'var(--green)':'var(--muted)',sec.vib?'vibrate':'viboff',t('vib'),'<div class="sw2 '+(sec.vib?'on':'')+'" role="switch" aria-checked="'+(sec.vib?'true':'false')+'" aria-label="'+t('vib')+'" onclick="sec.vib=!sec.vib;saveSec();render()"></div>')+
 '</div>')+
 sec0(t('trashT'),'<div class="card" style="padding:6px 16px">'+kv('var(--red-bg)','var(--red)','trash',t('trashT'),'<span class="num" style="background:var(--red);color:#fff;border-radius:999px;font-size:10.5px;min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-weight:900">'+(DD().trash||[]).length+'</span> '+ic('fwd',16),'go(\'trash\',{})')+'</div>')+
  sec0(t('security'),'<div class="card" style="padding:6px 16px">'+
  kv(sec.enabled?'var(--green-bg)':'var(--line2)',sec.enabled?'var(--green)':'var(--muted)',sec.enabled?'lock':'unlock',t('pinLock'),'<span style="font-weight:800;color:'+st+'">'+t(sec.enabled?'on':'off')+'</span><button class="hbtn" aria-label="'+t('setPin')+'" onclick="askPin()">'+ic('shield',17)+'</button>')+
  (sec.enabled?
   '<div class="sep"></div>'+
   kv((sec.fps&&sec.fps.length)?'var(--green-bg)':'var(--line2)',(sec.fps&&sec.fps.length)?'var(--green)':'var(--muted)','fp',t('useFinger')+' ('+(sec.fps?sec.fps.length:0)+')','<button class="hbtn" onclick="addFp()" style="color:var(--navy)">'+t('fpAdd')+'</button>')+
   ((sec.fps&&sec.fps.length)?sec.fps.map((f,i)=>'<div class="sep"></div><div class="kv"><span class="kic" style="width:34px;height:34px;border-radius:10px;background:var(--navy-bg);color:var(--navy);display:flex;align-items:center;justify-content:center">'+ic('fp',16)+'</span><span class="k" style="margin-inline-start:8px">'+t('fpN')+' '+(i+1)+'</span><span class="v"><button class="hbtn" style="color:var(--red)" onclick="fpDel('+i+')">'+ic('x',15)+'</button></span></div>').join(''):'')+
   '<div class="sep"></div>'+
   kv('var(--red-bg)','var(--red)','clock',t('autoLock'),'<select class="inp" style="width:130px;padding:7px 10px" onchange="sec.autoMin=+this.value;saveSec()">'+[1,5,15,30,60].map(m=>'<option value="'+m+'"'+(sec.autoMin===m?' selected':'')+'>'+m+'</option>').join('')+'</select>')+
   '<div class="sep"></div>'+
   kv('var(--red-bg)','var(--red)','lock',t('lockNow'),ic('fwd',16),'locked=true;masterKey=null;pinBuf=\'\';stack=[{s:\'home\'}];render()')+
   '<div class="sep"></div>'+
   kv('var(--red-bg)','var(--red)','x',t('turnOffPin'),ic('fwd',16),'disableLock()')
  :'')+'</div>')+
 sec0(t('dataSec'),'<div class="card" style="padding:6px 16px">'+
  kv('var(--green-bg)','var(--green)','down',t('backupT'),ic('fwd',16),'Backup.download()')+
 '<div class="sep"></div>'+
 kv('var(--navy-bg)','var(--navy)','up',t('restoreT'),ic('fwd',16),'document.getElementById(\'bkFile\').click()')+
 '<input type="file" id="bkFile" accept=".json" style="display:none" onchange="Backup.pick(this)">'+
 '<div class="sep"></div>'+
 kv('var(--navy-bg)','var(--navy)','excel',t('exportAll'),ic('fwd',16),'exportAll()')+
  '<div class="sep"></div>'+
   '<div class="sep"></div>'+
  kv('var(--red-bg)','var(--red)','trash',t('reset'),ic('fwd',16),'reset()')+
 '</div>')+
 '<div class="card" style="margin-top:16px;padding:2px 16px">'+
 '<div class="kv" style="cursor:pointer" onclick="ui.voskOpen=!ui.voskOpen;render()"><span class="kic" style="background:'+(sec.vosk?'var(--green-bg)':'var(--line2)')+';color:'+(sec.vosk?'var(--green)':'var(--muted)')+'">'+ic('mic',17)+'</span><span class="k">'+t('voskOpt')+'</span><span class="v" style="font-weight:800;color:var(--soft)">'+(sec.vosk?t('on'):t('off'))+(ui.voskOpen?' ▾':'')+'</span></div>'+
 (ui.voskOpen?'<div class="sep"></div><div class="muted" style="padding:10px 2px;font-size:12px;line-height:1.9;white-space:pre-line">'+t('voskHelp')+'</div><div style="display:flex;gap:8px;margin:4px 0 12px"><button class="btn btn-line" style="flex:1" onclick="sec.vosk=!sec.vosk;saveSec();render()">'+(sec.vosk?t('voskOff'):t('voskOn'))+'</button>'+(window.Daftari?'<button class="btn btn-soft" style="flex:1" onclick="Daftari.pickVosk()">'+ic('excel',16)+t('impBtn')+'</button>':'')+'</div>':'')+
 '<div class="sep"></div><div class="kv" style="cursor:pointer" onclick="openExtSheet()"><span class="kic" style="background:var(--green-bg);color:var(--green)">'+ic('mic',17)+'</span><span class="k">'+t('extT')+'</span><span class="v" style="color:var(--soft);font-weight:700;font-size:12px">'+t('extGo')+'</span></div>'+
 '<div class="sep"></div><div class="kv" style="cursor:pointer" onclick="projPick()"><span class="kic" style="background:var(--navy-bg);color:var(--navy)">'+ic('up',17)+'</span><span class="k">'+t('projPull')+'</span><span class="v" style="color:var(--soft);font-weight:700;font-size:12px">'+t('projGo')+'</span></div>'+
 '<input type="file" id="projFile" accept=".html,.htm,.zip" style="display:none" onchange="projPickFile(this)">'+
 '<div class="muted" style="text-align:center;font-size:11px;padding:10px 16px 0;line-height:1.9">'+t('locHint')+'</div>'+
 '<div class="sep"></div><div class="kv" style="cursor:pointer" onclick="Appearance.sheet()">'+
 '<span class="kic" style="background:var(--navy-bg);color:var(--navy)">'+ic('sliders',17)+'</span>'+
 '<span class="k" style="margin-inline-start:8px">'+t('appearT')+'</span>'+
 '<span class="v" style="color:var(--soft);font-weight:700;font-size:12px">'+esc(Appearance.scaleLabel(Appearance.scale))+' · '+esc(Appearance.densityLabel(Appearance.density))+'</span></div>'+
 '<div class="sep"></div><div class="kv" style="cursor:pointer" onclick="Updater.sheet()">'+
 '<span class="kic" style="background:var(--green-bg);color:var(--green)">'+ic('down',17)+'</span>'+
 '<span class="k" style="margin-inline-start:8px">'+t('updT')+'</span>'+
 '<span class="v num" style="color:var(--soft);font-weight:700;font-size:12px">'+esc(Updater.version())+'</span></div>'+
 '<div class="sep"></div><div class="kv" style="cursor:pointer" onclick="DaftariApp.sheet()">'+
 '<span class="kic" style="background:var(--amber-bg);color:var(--amber)">'+ic('zap',17)+'</span>'+
 '<span class="k" style="margin-inline-start:8px">'+t('extensT')+'</span>'+
 '<span class="v" style="color:var(--soft);font-weight:700;font-size:12px">'+Object.keys(DaftariApp.modules).length+' '+t('modLoaded')+'</span></div>'+
 '<div class="muted" style="text-align:center;font-size:11px;padding:16px 0 6px">'+t('ver')+' <span class="num">'+__BUILD+'</span></div>'+
 '</div>'+
 '</div>';
};
