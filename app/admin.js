(() => {
"use strict";
const CFG=window.COMUNIO_CONFIG;
const $=id=>document.getElementById(id);
const POS={porteros:"portero",defensas:"defensa",medios:"medio",delanteros:"delantero"};

if(CFG.DEMO_MODE||!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY){
  $("adminLogin").innerHTML="<h2>Administrador</h2><p class='muted'>Activa Supabase en config.js para utilizar esta pantalla.</p>";
  return;
}
const supa=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
boot();

function normPos(v){
  const p=String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(p.includes("port"))return"portero";if(p.includes("def"))return"defensa";
  if(p.includes("medio")||p.includes("centro")||p.includes("mc"))return"medio";
  if(p.includes("del")||p.includes("ata"))return"delantero";return"";
}
function mult(v){
  if(v<=500000)return 3;if(v<=999999)return 2;if(v<=3999999)return 1.5;
  if(v<=7999999)return 1.3;if(v<=11999999)return 1.25;return 1.2;
}
function esc(v){
  return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," ");
}
function normParty(v){
  const compact=norm(v).replace(/[\s_-]+/g,"");
  if(compact==="equipomalo")return"equipomalo";
  if(compact==="computer")return"computer";
  return compact;
}
function money(v){return Math.round(Number(v)||0);}
function moneyES(v){return new Intl.NumberFormat("es-ES").format(money(v))+" €";}
function localISODate(offsetDays=0){
  const now=new Date();
  const local=new Date(now.toLocaleString("en-US",{timeZone:CFG.TIMEZONE||"Europe/Madrid"}));
  local.setDate(local.getDate()+offsetDays);
  const y=local.getFullYear(),m=String(local.getMonth()+1).padStart(2,"0"),d=String(local.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function routeText(op){return `${op.seller||"—"} → ${op.buyer||"—"}`;}

async function boot(){
  const {data:{session}}=await supa.auth.getSession();if(!session)return;
  const {data:profile}=await supa.from("profiles").select("manager_name,role").eq("id",session.user.id).single();
  if(!profile||profile.role!=="admin"){ $("adminLogin").innerHTML="<h2>Sin permiso</h2><p class='muted'>Tu usuario no es administrador.</p>";return; }
  $("adminLogin").classList.add("hidden");$("adminMain").classList.remove("hidden");
  $("syncBtn").addEventListener("click",syncPlayers);
  $("syncCalendarBtn").addEventListener("click",syncCalendar);
  $("reconcileDate").value=localISODate(-1);
  $("reconcileBtn").addEventListener("click",reconcileOperations);
  loadDays();
}
async function syncPlayers(){
  $("syncBtn").disabled=true;$("syncMsg").textContent="Sincronizando jugadores y Equipo Malo…";
  try{
    const [dr,er,br]=await Promise.all([
      fetch("../datos.json?v="+Date.now(),{cache:"no-store"}),
      fetch("../equipos.json?v="+Date.now(),{cache:"no-store"}),
      fetch("../equipomalo.json?v="+Date.now(),{cache:"no-store"})
    ]);
    if(!dr.ok||!er.ok||!br.ok)throw new Error("No se pudieron leer los JSON de la web.");
    const d=await dr.json(),e=await er.json(),b=await br.json(),teams=e.equipos||e||{};

    const rows=[];
    Object.entries(POS).forEach(([group,pos])=>(d[group]||[]).forEach(p=>rows.push({
      name:p.jugador,owner_name:p.propietario,team:teams[p.jugador]||"",position:pos,
      points:Number(p.puntos)||0,market_value:Number(p.valor)||0,clause_value:Number(p.clausula)||0,active:true
    })));
    await supa.from("players").update({active:false}).eq("active",true);
    for(let i=0;i<rows.length;i+=100){
      const {error}=await supa.from("players").upsert(rows.slice(i,i+100),{onConflict:"name"});if(error)throw error;
    }

    const badRows=(b.jugadores||[]).map(p=>{
      const value=Number(p.valor)||0,m=mult(value);
      return {
        name:p.jugador,team:teams[p.jugador]||p.equipo||"",position:normPos(p.posicion),
        points:Number(p.puntos)||0,market_value:value,multiplier:m,clause_value:Math.round(value*m)
      };
    }).filter(x=>x.name&&x.position);

    const currentNames=badRows.map(x=>x.name);
    if(currentNames.length){
      const {data:existing}=await supa.from("team_malo_players").select("name,available");
      const absent=(existing||[]).filter(x=>!currentNames.includes(x.name)&&x.available).map(x=>x.name);
      for(let i=0;i<absent.length;i+=100){
        const chunk=absent.slice(i,i+100);
        if(chunk.length)await supa.from("team_malo_players").update({available:false}).in("name",chunk);
      }
    }
    for(let i=0;i<badRows.length;i+=100){
      const {error}=await supa.from("team_malo_players").upsert(badRows.slice(i,i+100),{onConflict:"name"});if(error)throw error;
    }

    $("syncMsg").textContent=`✓ ${rows.length} jugadores de cláusulas y ${badRows.length} de Equipo Malo sincronizados.`;
  }catch(e){$("syncMsg").textContent="Error: "+e.message;}
  finally{$("syncBtn").disabled=false;}
}

async function reconcileOperations(){
  const day=$("reconcileDate").value;
  if(!day){$("reconcileMsg").textContent="Selecciona una fecha.";return;}
  $("reconcileBtn").disabled=true;
  $("reconcileMsg").textContent="Comparando app con el historial oficial…";
  $("reconcileSummary").classList.add("hidden");
  $("reconcileResult").innerHTML="";

  try{
    const [statsRes,clauses,badBuys,badSales]=await Promise.all([
      fetch("../estadisticas.json?v="+Date.now(),{cache:"no-store"}),
      supa.from("clause_executions").select("id,clause_day,executed_at,executor_name,target_owner_name,player_name,clause_value").eq("clause_day",day).order("executed_at"),
      supa.from("team_malo_purchases").select("id,purchase_day,executed_at,buyer_name,player_name,clause_value").eq("purchase_day",day).order("executed_at"),
      supa.from("team_malo_sales").select("id,sale_day,executed_at,seller_name,player_name,sale_value").eq("sale_day",day).order("executed_at")
    ]);
    if(!statsRes.ok)throw new Error("No se pudo leer estadisticas.json.");
    for(const q of [clauses,badBuys,badSales])if(q.error)throw q.error;
    const stats=await statsRes.json();

    const expected=[
      ...(clauses.data||[]).map(x=>({kind:"Cláusula",player:x.player_name,seller:x.target_owner_name,buyer:x.executor_name,price:money(x.clause_value),time:x.executed_at})),
      ...(badBuys.data||[]).map(x=>({kind:"Compra Equipo Malo",player:x.player_name,seller:"equipomalo",buyer:x.buyer_name,price:money(x.clause_value),time:x.executed_at})),
      ...(badSales.data||[]).map(x=>({kind:"Venta Equipo Malo",player:x.player_name,seller:x.seller_name,buyer:"equipomalo",price:money(x.sale_value),time:x.executed_at}))
    ].sort((a,b)=>new Date(a.time||0)-new Date(b.time||0));

    const official=(Array.isArray(stats.historial)?stats.historial:[])
      .filter(x=>x.fecha===day)
      .map(x=>({player:x.jugador,seller:x.vendedor,buyer:x.comprador,price:money(x.precio),raw:x}));

    const used=new Set();
    const results=[];

    for(const exp of expected){
      let idx=official.findIndex((off,i)=>!used.has(i)&&sameOperation(exp,off));
      if(idx>=0){
        used.add(idx);
        results.push({status:"ok",expected:exp,official:official[idx],issues:[]});
        continue;
      }

      const candidates=official
        .map((off,i)=>({off,i}))
        .filter(x=>!used.has(x.i)&&norm(x.off.player)===norm(exp.player));

      if(!candidates.length){
        results.push({status:"missing",expected:exp,official:null,issues:["No aparece este jugador en el historial oficial de ese día."]});
        continue;
      }

      candidates.sort((a,b)=>differenceScore(exp,a.off)-differenceScore(exp,b.off));
      const chosen=candidates[0];
      used.add(chosen.i);
      const issues=operationDifferences(exp,chosen.off);
      results.push({status:issues.length?"different":"ok",expected:exp,official:chosen.off,issues});
    }

    const ok=results.filter(x=>x.status==="ok").length;
    const issues=results.length-ok;
    const extras=official.filter((_,i)=>!used.has(i));

    $("reconcileAppCount").textContent=expected.length;
    $("reconcileOkCount").textContent=ok;
    $("reconcileIssueCount").textContent=issues;
    $("reconcileSummary").classList.remove("hidden");

    const updated=stats.actualizado?` · estadísticas actualizadas ${esc(stats.actualizado)}`:"";
    if(!expected.length){
      $("reconcileMsg").innerHTML=`No hay operaciones registradas desde la app el <b>${esc(day)}</b>. No hay nada que comprobar${updated}.`;
      $("reconcileResult").innerHTML=extras.length?`<div class="reconcile-info">El Excel contiene ${extras.length} movimiento(s) ese día, pero son informativos y no se marcan como incidencia porque no proceden de la app.</div>`:"";
      return;
    }

    $("reconcileMsg").innerHTML=issues===0
      ? `<span class="reconcile-good">🟢 Todo correcto · 0 incidencias</span>${updated}`
      : `<span class="reconcile-bad">🔴 ${issues} incidencia${issues===1?"":"s"}</span>${updated}`;

    $("reconcileResult").innerHTML=results.map(renderReconcileRow).join("")+
      (extras.length?`<div class="reconcile-info">ℹ️ El Excel tiene ${extras.length} movimiento(s) adicional(es) de ese día que no se usan para validar la app. Esto es normal, por ejemplo en compras o ventas con Computer.</div>`:"");
  }catch(e){
    console.error(e);
    $("reconcileMsg").textContent="Error al comprobar: "+e.message;
  }finally{
    $("reconcileBtn").disabled=false;
  }
}

function sameOperation(a,b){
  return norm(a.player)===norm(b.player)&&
    normParty(a.seller)===normParty(b.seller)&&
    normParty(a.buyer)===normParty(b.buyer)&&
    money(a.price)===money(b.price);
}
function differenceScore(a,b){return operationDifferences(a,b).length;}
function operationDifferences(exp,off){
  const out=[];
  if(normParty(exp.seller)!==normParty(off.seller))out.push(`Vendedor: app “${exp.seller||"—"}” / Excel “${off.seller||"—"}”`);
  if(normParty(exp.buyer)!==normParty(off.buyer))out.push(`Comprador: app “${exp.buyer||"—"}” / Excel “${off.buyer||"—"}”`);
  if(money(exp.price)!==money(off.price))out.push(`Precio: app ${moneyES(exp.price)} / Excel ${moneyES(off.price)}`);
  return out;
}
function renderReconcileRow(r){
  const ok=r.status==="ok";
  const title=ok?"🟢 Correcta":r.status==="missing"?"🔴 No encontrada":"🔴 Diferencia";
  const actual=r.official?`<div class="reconcile-actual"><span>Excel</span><b>${esc(routeText(r.official))}</b><em>${moneyES(r.official.price)}</em></div>`:"";
  const diffs=r.issues.length?`<ul>${r.issues.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"";
  return `<article class="reconcile-row ${ok?"ok":"issue"}">
    <div class="reconcile-row-head"><span>${title}</span><small>${esc(r.expected.kind)}</small></div>
    <strong class="reconcile-player">${esc(r.expected.player)}</strong>
    <div class="reconcile-expected"><span>App</span><b>${esc(routeText(r.expected))}</b><em>${moneyES(r.expected.price)}</em></div>
    ${actual}${diffs}
  </article>`;
}

async function syncCalendar(){
  $("syncCalendarBtn").disabled=true;$("calendarMsg").textContent="Cargando calendario oficial…";
  try{
    const motor=await ComunioCalendario.cargar("../calendario-clausulas.json");
    const days=motor.fechasHabilitadas().map(x=>({
      day:x.fecha,opens_at:x.opens_at,closes_at:x.closes_at,enabled:x.enabled
    }));
    for(let i=0;i<days.length;i+=100){
      const {error}=await supa.from("clause_days").upsert(days.slice(i,i+100),{onConflict:"day"});
      if(error)throw error;
    }
    $("calendarMsg").textContent=`✓ Calendario ${motor.config.version} sincronizado: ${days.length} días de temporada.`;
    loadDays();
  }catch(e){$("calendarMsg").textContent="Error: "+e.message;}
  finally{$("syncCalendarBtn").disabled=false;}
}
async function loadDays(){
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const {data}=await supa.from("clause_days").select("*").gte("day",today).order("day").limit(20);
  $("daysList").innerHTML=(data||[]).map(d=>`<div class="history-item"><div class="history-time">${d.day.slice(8,10)}/${d.day.slice(5,7)}</div>
  <div><div class="history-main">${d.enabled?"🟢 Abierto":"🔴 Cerrado"}</div><div class="history-sub">${String(d.opens_at).slice(0,5)}–${String(d.closes_at).slice(0,5)}</div></div></div>`).join("")||"<div class='empty'>No hay próximos días configurados.</div>";
}
})();
