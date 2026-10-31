(() => {
  'use strict';
  const panel = document.getElementById('autoMercadoPanel');
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const cfg = window.COMUNIO_CONFIG;
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let draft = [], busy = false;
  // Restar un día de calendario de Madrid; no restar 24 horas (cambio de horario).
  const yesterday = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
      timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
    return new Date(Date.UTC(parts.year,parts.month-1,parts.day-1,12)).toISOString().slice(0,10);
  };
  $('maFecha').value = yesterday();
  $('maFecha').readOnly = true;
  $('maFecha').setAttribute('aria-readonly','true');

  function message(value, error=false) {
    $('maMensaje').textContent = value;
    $('maMensaje').style.color = error ? '#f87171' : '';
  }
  function parseMoney(raw) {
    const text = String(raw || '').trim().replace(/\s/g, '');
    if (!/^[\d.,]+$/.test(text)) return NaN;
    const normalized = text.includes(',') ? text.replace(/\./g,'').replace(',', '.') : text.replace(/\./g,'');
    const num = Number(normalized);
    return Number.isFinite(num) && num >= 0 ? num : NaN;
  }
  function parseText(input, defaultDate) {
    const items = [], errors = [];
    let date = defaultDate, pending = '';
    for (const original of String(input).split(/\r?\n/)) {
      const line = original.trim();
      if (!line) continue;
      const dateMatch = line.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s*[-–]|$)/);
      if (dateMatch) {
        const reported = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        if (reported !== defaultDate) errors.push('El bloque con fecha '+reported+' no corresponde al día anterior ('+defaultDate+').');
        date = defaultDate; pending = ''; continue;
      }
      if (/^(editado|transferencias|computer|noticias)\s*:?\s*$/i.test(line) || /^editado\s*:/i.test(line)) { pending=''; continue; }
      if (!/\bcambia\s+por\b/i.test(line)) { pending = line; continue; }
      const full = /^cambia\b/i.test(line) ? `${pending} ${line}` : line;
      const match = full.match(/^(.+?)\s+cambia\s+por\s+([\d.,]+)\s+de\s+(.+?)\s+para\s+(.+?)\.?\s*$/i);
      pending = '';
      if (!match) { errors.push('No se entiende: '+line); continue; }
      const price = parseMoney(match[2]);
      if (!Number.isFinite(price) || !date) { errors.push('Precio o fecha incorrectos: '+line); continue; }
      items.push({fecha:date,jugador:match[1].trim(),precio:price,vendedor:match[3].trim(),comprador:match[4].replace(/\.$/,'').trim()});
    }
    return {items,errors};
  }
  function renderDraft() {
    $('maGuardar').disabled = busy;
    if (!draft.length) { $('maVista').innerHTML=''; return; }
    $('maVista').innerHTML = '<div style="overflow-x:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>Fecha</th><th>Jugador</th><th>De → Para</th><th>Precio</th></tr></thead><tbody>'+
      draft.map(x=>`<tr><td>${esc(x.fecha)}</td><td>${esc(x.jugador)}</td><td>${esc(x.vendedor)} → ${esc(x.comprador)}</td><td style="text-align:right;white-space:nowrap">${nf.format(x.precio)} €</td></tr>`).join('')+'</tbody></table></div>';
  }
  async function adminSession() {
    const {data:{session},error}=await client.auth.getSession();
    if (error || !session) throw new Error('Necesitas iniciar sesión como administrador.');
    const {data:profile,error:pe}=await client.from('profiles').select('role').eq('id',session.user.id).single();
    if (pe || profile?.role!=='admin') throw new Error('Acceso permitido únicamente a administradores.');
    return session;
  }
  async function getAll(table,sort='id',fields='*') {
    const all=[];
    for (let start=0;start<10000;start+=500) {
      const {data,error}=await client.from(table).select(fields).order(sort,{ascending:true}).range(start,start+499);
      if (error) throw error;
      all.push(...data);
      if (data.length<500) break;
    }
    return all;
  }
  async function loadStatus() {
    try {
      await adminSession();
      const [a,b,c,e] = await Promise.all([
        client.from('comunio_transfers').select('id',{count:'exact',head:true}),
        client.from('comunio_market_quotes').select('player_name',{count:'exact',head:true}),
        client.from('comunio_calculated').select('player_name',{count:'exact',head:true}).not('owner_name','is',null),
        client.from('comunio_sync_errors').select('id',{count:'exact',head:true})
      ]);
      for (const x of [a,b,c,e]) if(x.error)throw x.error;
      $('maEstado').textContent=`${nf.format(a.count)} traspasos · ${nf.format(b.count)} cotizaciones · ${nf.format(c.count)} jugadores con propietario`;
      $('maFallos').textContent=e.count ? `⚠ ${e.count} incidencia(s) de sincronización: revisar antes de confiar en los cambios.` : '✓ Sin incidencias registradas en la sincronización';
      const {data,error}=await client.from('comunio_transfers').select('transfer_date,player_name,price,seller,buyer,source').order('id',{ascending:false}).limit(10);
      if (error)throw error;
      $('maUltimos').innerHTML=(data||[]).map(x=>`<div style="border-top:1px solid #ffffff22;padding:7px 0;font-size:12px"><b>${esc(x.player_name)}</b> · ${nf.format(x.price)} €<div style="opacity:.72">${esc(x.transfer_date)} · ${esc(x.seller)} → ${esc(x.buyer)} · ${esc(x.source)}</div></div>`).join('')||'<p>Sin movimientos.</p>';
    } catch(e) { $('maEstado').textContent='Error al consultar el mercado: '+e.message; }
  }
  $('maPrevisualizar').addEventListener('click', () => {
    const parsed = parseText($('maTexto').value,$('maFecha').value);
    draft = parsed.items;
    renderDraft();
    message(parsed.errors.length ? `${draft.length} reconocidos, ${parsed.errors.length} con errores: ${parsed.errors.slice(0,3).join(' | ')}` : `${draft.length} traspaso(s) preparados. Revísalos antes de guardarlos.`,!!parsed.errors.length);
    if(parsed.errors.length)message('Corrige los errores antes de actualizar.',true);
  });
  // La previsualización aparece al pegar, sin exigir otro botón.
  $('maTexto').addEventListener('input',()=>{
    const parsed=parseText($('maTexto').value,yesterday());
    draft=parsed.items;renderDraft();
    if(parsed.errors.length) message('⚠ '+parsed.errors.slice(0,3).join(' | '),true);
    else if(draft.length) message('✓ '+draft.length+' traspaso(s) reconocidos del día anterior. Pulsa «Actualizar todo».');
    else message('Sin traspasos: puedes pulsar «Actualizar todo» igualmente.');
  });
  // Estado local: permite retomar un trabajo iniciado, incluso al cerrar Administración.
  // El proceso se inicia SOLO al pulsar el botón.
  const dailyKey='comunio-actualizacion-diaria-2627-v2';
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const storage=window.localStorage;
  function readDaily() {
    try { return JSON.parse(storage.getItem(dailyKey)||'null'); } catch(_) { return null; }
  }
  function saveDaily(value) { storage.setItem(dailyKey,JSON.stringify(value)); }
  async function comuniazoApi(action,extra={}) {
    const session=await adminSession();
    const response=await fetch(cfg.SUPABASE_URL+'/functions/v1/actualizar-comuniazo',{
      method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json',apikey:cfg.SUPABASE_ANON_KEY,Authorization:'Bearer '+session.access_token},
      body:JSON.stringify({action,...extra})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Error de comunicación con la actualización de Comuniazo.');
    return data;
  }
  async function checkPublication() {
    const {count,error}=await client.from('comunio_sync_errors').select('id',{count:'exact',head:true});
    if(error)throw new Error('No se pudo comprobar la publicación en la web: '+error.message);
    if(count)throw new Error('Hay '+count+' incidencia(s) de publicación en Supabase. Revisa el panel; no se certifica éxito.');
  }
  async function followDaily(id,day) {
    let connectionFailures=0;
    for(let attempt=0;attempt<175;attempt++){
      let data;
      try {
        data=await comuniazoApi('status',{request_id:id});
        connectionFailures=0;
      } catch(e) {
        connectionFailures++;
        if(connectionFailures>=4)throw e;
        message('Comprobando la descarga iniciada… (conexión intermitente)');
        await pause(7000);continue;
      }
      if(data.status==='completed'){
        if(data.conclusion!=='success'){
          saveDaily({day,status:'failed',reason:data.message||'GitHub informó de un fallo'});
          throw new Error(data.message||'Falló la descarga. Los movimientos ya registrados se conservan.');
        }
        if(!data.already_applied && (!Number.isInteger(data.players_downloaded)||data.players_downloaded<550))
          throw new Error('No se ha podido verificar el número de jugadores descargados.');
        await checkPublication();
        await loadStatus();
        saveDaily({day,status:'completed',completed_at:new Date().toISOString(),result:data});
        message('✓ Actualización completada. '+(data.players_downloaded||'Los')+
          ' jugadores de Comuniazo; '+(data.updated_values||0)+' valores cambiados; '+
          (data.updated_points||0)+' puntuaciones de Comuniazo actualizadas. '+
          'Propietarios y cláusulas calculados con los 383 tramos originales. Puntos oficiales conservados.');
        document.dispatchEvent(new CustomEvent('comuniazo-updated'));
        return;
      }
      message('2/3 · '+(data.message||'Descargando Comuniazo…')+' 3/3 · Aplicación y recálculo al finalizar.');
      await pause(7000);
    }
    throw new Error('La descarga continúa pendiente. Reabre Administración y pulsa «Actualizar todo» para consultar el mismo proceso, sin duplicarlo.');
  }
  $('maGuardar').addEventListener('click',async() => {
    if(busy)return;
    busy=true;renderDraft();
    try {
      await adminSession();
      const day=today();
      let state=readDaily();
      if(state?.status==='pending' && state.request_id){
        message('Retomando la descarga pendiente del '+state.day+'…');
        await followDaily(state.request_id,state.day);
        return;
      }
      if(state?.status==='completed' && state.day===day &&
        !window.confirm('La actualización de hoy ya se completó. ¿Quieres realizar otra actualización manual?')) {
        message('✓ Ya completada hoy. No se han enviado movimientos ni iniciado otra descarga.');
        return;
      }
      // Ayer es obligatorio, aunque un encabezado pegado indique otro día.
      const transferDay=yesterday();
      $('maFecha').value=transferDay;
      const parsed=parseText($('maTexto').value,transferDay);
      if(parsed.errors.length)throw new Error('Corrige el texto: '+parsed.errors.slice(0,4).join(' | '));
      if(!parsed.items.length && $('maTexto').value.trim())
        throw new Error('No hay traspasos reconocibles. Deja el campo completamente vacío si ayer no hubo ninguno.');
      message('1/3 · Registrando '+parsed.items.length+' traspaso(s) del '+transferDay+'…');
      let inserted=0,duplicates=0;
      for(let i=0;i<parsed.items.length;i+=100){
        const {data,error}=await client.rpc('comunio_register_transfers',{p_items:parsed.items.slice(i,i+100)});
        if(error)throw error;
        inserted+=Number(data.insertados)||0;
        duplicates+=Number(data.duplicados)||0;
      }
      message('1/3 ✓ '+inserted+' registrados, '+duplicates+
        ' duplicados. 2/3 · Solicitando descarga nueva de Comuniazo…');
      const started=await comuniazoApi('start');
      if(!started.request_id)throw new Error('GitHub no devolvió el identificador de seguimiento.');
      state={day,status:'pending',request_id:started.request_id,transfer_day:transferDay};
      saveDaily(state);
      $('maTexto').value='';draft=[];renderDraft();
      await followDaily(state.request_id,day);
    }catch(e){
      message('⚠ No se ha completado toda la actualización: '+e.message+
        ' Los traspasos aceptados no se duplicarán al reintentar.',true);
    }finally{busy=false;renderDraft();}
  });
  // No bloquear la operación cuando el cuadro de traspasos esté vacío.
  $('maGuardar').disabled=false;
  const last=readDaily();
  if(last?.status==='pending' && last.request_id)
    message('Hay una descarga pendiente del '+last.day+'. Pulsa «Actualizar todo» para comprobarla sin repetir traspasos.');
  else if(last?.status==='completed' && last.day===today())
    message('✓ Actualización de hoy finalizada. Puedes consultar los resultados o descargar una copia para Excel.');

  $('maCotizaciones').addEventListener('click', async() => {
    if(busy)return;
    busy=true;$('maCotizaciones').disabled=true;message('Leyendo la última descarga de Comuniazo…');
    try{
      await adminSession();
      const response=await fetch('../datos-comuniazo-prueba/ultimo.json?v='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo leer el archivo de Comuniazo.');
      const latest=await response.json();
      if(!Array.isArray(latest.jugadores)||latest.jugadores.length<550)throw new Error('La descarga está incompleta; no se cambia nada.');
      const existing=await getAll('comunio_market_quotes','player_name');
      const map=new Map(existing.map(x=>[norm(x.player_name),x]));
      const withPoints=$('maActualizarPuntos').checked;
      const changes=[];
      for (const x of latest.jugadores){
        const previous=map.get(norm(x.jugador));
        const v=Number(x.valor_eur),pts=Number(x.puntos);
        if(!x.jugador || !Number.isFinite(v) || v<0 || !Number.isFinite(pts))continue;
        const pos=({t:'1.Portero',a:'2.Defensa',m:'3.Medio',s:'4.Delantero'})[x.posicion_filtro]||previous?.position||'';
        const team=x.equipo||previous?.team||'';
        const row={player_name:previous?.player_name||x.jugador,market_value:Math.round(v),points:withPoints?Math.round(pts):(previous?.points??Math.round(pts)),position:pos,team,source:'comuniazo_'+(latest.fecha||today()),updated_at:new Date().toISOString()};
        if(!previous || previous.market_value!==row.market_value || previous.points!==row.points || previous.position!==row.position || previous.team!==row.team)changes.push(row);
      }
      if(!changes.length){message(`✓ Sin cambios. Última descarga disponible: ${latest.fecha||'sin fecha'}.`);return;}
      const stale=latest.fecha && latest.fecha<today();
      const info=`Se aplicarán ${changes.length} cambios usando la descarga del ${latest.fecha||'día desconocido'}.`;
      if(!window.confirm(info+(stale?' La descarga es anterior a hoy. ¿Continuar?':''))) {message('Actualización cancelada.');return;}
      for(let i=0;i<changes.length;i+=80){
        const {error}=await client.from('comunio_market_quotes').upsert(changes.slice(i,i+80),{onConflict:'player_name'});
        if(error)throw error;
      }
      message(`✓ ${changes.length} cotizaciones actualizadas a partir de ${latest.fecha||'última descarga'}. Cláusulas recalculadas. ${withPoints?'Incluidos los puntos de Comuniazo.':'Puntos oficiales existentes conservados.'}`);
      await loadStatus();
    }catch(e){message('No se aplicaron todos los cambios: '+e.message,true)}
    finally{busy=false;$('maCotizaciones').disabled=false;}
  });
  $('maCopia').addEventListener('click', async() => {
    if(busy)return;
    busy=true;$('maCopia').disabled=true;message('Preparando copia de seguridad de Supabase…');
    try {
      await adminSession();
      const [transfers,quotes,tiers,calculated]=await Promise.all([
        getAll('comunio_transfers'),getAll('comunio_market_quotes','player_name'),
        getAll('comunio_clause_tiers','tier_index'),getAll('comunio_calculated','player_name')
      ]);
      const backup={version:'2026/27',exportado_en:new Date().toISOString(),
        origen:'Supabase · Comunio Laviana',uso:'Datos estructurados para respaldo e importación posterior al Excel original',
        traspasos:transfers,cotizaciones:quotes,clausulas_calculadas:calculated,multiplicadores:tiers};
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='comunio-copia-para-excel-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      message(`✓ Copia preparada: ${transfers.length} traspasos, ${quotes.length} cotizaciones, ${calculated.length} cálculos y ${tiers.length} tramos. El Excel original no se ha modificado.`);
    }catch(e){message('No se pudo descargar la copia: '+e.message,true)}
    finally{busy=false;$('maCopia').disabled=false;}
  });
  $('maDesplegable').addEventListener('toggle',()=>{if($('maDesplegable').open)loadStatus()});
})();