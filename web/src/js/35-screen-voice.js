/* =====================================================================
 * Daftari · 35-screen-voice.js
 * ---------------------------------------------------------------------
 * SCREEN: voice capture
 *
 * Classic script: shares the global scope with the other modules so the
 * runtime contract matches the original single-file build exactly.
 * Load order is defined by web/build.mjs (filename prefix = order).
 * ===================================================================== */
const S_voice=p=>{const v=ui.voice;const pre=p&&p.cust?cust(p.cust):null;let body='';
 if(v.st==='idle'){body='<div class="micwrap"><button class="mic" onclick="voiceStart()">'+ic('mic',50)+'</button><div class="wave" style="opacity:.25">'+waveHtml()+'</div><div style="font-weight:700;margin-top:6px">'+t('tapMic')+'</div><div class="transcript" style="background:var(--card2);border-color:var(--line);color:var(--soft)">'+t('example')+'</div><div class="muted" style="margin-top:10px;text-align:center;line-height:1.8;padding:0 28px">'+t('voiceHint')+'</div></div>';}
 else if(v.st==='listen'){body='<div class="micwrap"><button class="mic live">'+ic('mic',50)+'</button><div class="wave">'+waveHtml()+'</div><div style="font-weight:800;color:var(--green)">'+t('listening')+'</div></div>';}
 else{const d=v.d;body='<div class="micwrap" style="padding-top:8px"><div class="wave" style="opacity:.5">'+waveHtml()+'</div><div class="transcript">'+t('heard')+' «'+esc(d.say)+'»</div></div>'
 +'<div class="pad"><div class="card" style="padding:5px 16px">'+(v.edit?
 '<div class="kv"><span class="k">'+ic('user',16)+t('cust')+'</span><span class="v" style="min-width:55%"><select class="inp" style="padding:8px 10px" id="ve_c">'+DD().customers.filter(c=>!c.archived).map(c=>'<option value="'+c.id+'"'+(c.id===d.custId?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></span></div>'
 +'<div class="kv"><span class="k">'+ic('wallet',16)+t('amount')+'</span><span class="v" style="min-width:35%"><input class="inp num" style="padding:8px 10px" id="ve_a" type="number" value="'+(d.amt?Money.dec(d.amt):'')+'"></span></div>'
 +'<div class="kv"><span class="k">'+ic('tag',16)+t('remind')+'</span><span class="v" style="min-width:55%"><input class="inp" style="padding:8px 10px" id="ve_n" value="'+esc(d.note)+'" placeholder="'+t('remindPh')+'"></span></div>'
 :(!isP()?'<div class="kv"><span class="kic">'+ic('user',17)+'</span><span class="k">'+t('cust')+'</span><span class="v">'+esc(d.name)+'</span></div>':'')
 +'<div class="kv"><span class="kic" style="color:var(--red)">'+ic('wallet',17)+'</span><span class="k">'+t('amount')+'</span><span class="v amt red">'+money(d.amt)+'</span></div>'
 +'<div class="kv"><span class="kic">'+ic('tag',17)+'</span><span class="k">'+t('remind')+'</span><span class="v">'+esc(d.note)+'</span></div>')+'</div>'
 +(v.cands.length&&!v.edit?'<div class="muted" style="margin:10px 2px 4px;font-weight:700">'+t('cand')+'</div><div class="cand">'+v.cands.map(c=>'<button class="'+(c.id===v.d.custId?'on':'')+'" onclick="ui.voice.d.custId=\''+c.id+'\';ui.voice.d.name=\''+esc(c.name)+'\';render()">'+esc(c.name)+'</button>').join('')+'</div>':'')
 +'<div style="display:flex;gap:12px;margin-top:14px"><button class="btn btn-red" style="flex:1.5" onclick="voiceConfirm()">'+ic('checkc',18)+t('confirmReg')+'</button><button class="btn btn-line" style="flex:1" onclick="voiceToggleEdit()">'+ic('edit',17)+t('editL')+'</button><button class="hbtn" onclick="ui.voice.st=\'idle\';render()">'+ic('x',18)+'</button></div>'
 +'<div class="muted" style="text-align:center;margin-top:13px">'+ic('lock',12)+' '+t('privacyC')+'</div></div>';}
 return headerBar(t('voiceTitle'),pre?esc(pre.name):null,'back()')+body;};
