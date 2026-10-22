(() => {
"use strict";
const CFG=window.COMUNIO_CONFIG;
const $=id=>document.getElementById(id);
const POS={porteros:"portero",defensas:"defensa",medios:"medio",delanteros:"delantero"};

if(CFG.DEMO_MODE || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY){
  $("adminLogin").innerHTML="<h2>Administrador</h2><p class='muted'>Activa Supabase en config.js para utilizar esta pantalla.</p>";
  return;
}
const supa=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);

boot();
async function boot(){
  const {data:{session}}=await supa.auth.getSession();
  if(!session)return;
  const {data:profile}=await supa.from("profiles").select("manager_name,role").eq("id",session.user.id).single();
  if(!profile || profile.role!=="admin"){
    $("adminLogin").innerHTML="<h2>Sin permiso</h2><p class='muted'>Tu usuario no está marcado como administrador.</p>";
    return;
  }
  $("adminLogin").classList.add("hidden");
  $("adminMain").classList.remove("hidden");
  $("dayInput").value=new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  bind();
  loadDays();
}
function bind(){
  $("syncBtn").addEventListener("click",syncPlayers);
  $("saveDayBtn").addEventListener("click",saveDay);
}
async function syncPlayers(){
  $("syncBtn").disabled=true;$("syncMsg").textContent="Sincronizando…";
  try{
    const [dr,er]=await Promise.all([
      fetch("../datos.json?v="+Date.now(),{cache:"no-store"}),
      fetch("../equipos.json?v="+Date.now(),{cache:"no-store"})
    ]);
    if(!dr.ok||!er.ok)throw new Error("No se pudieron leer los JSON de la web.");
    const d=await dr.json(), e=await er.json(), teams=e.equipos||e||{};
    const rows=[];
    Object.entries(POS).forEach(([group,pos])=>{
      (d[group]||[]).forEach(p=>rows.push({
        name:p.jugador,owner_name:p.propietario,team:teams[p.jugador]||"",position:pos,
        points:Number(p.puntos)||0,market_value:Number(p.valor)||0,clause_value:Number(p.clausula)||0,active:true
      }));
    });

    // Desactivar primero los que ya no están en datos.json.
    const {error:e1}=await supa.from("players").update({active:false}).eq("active",true);
    if(e1)throw e1;

    for(let i=0;i<rows.length;i+=100){
      const {error}=await supa.from("players").upsert(rows.slice(i,i+100),{onConflict:"name"});
      if(error)throw error;
    }
    $("syncMsg").textContent=`✓ ${rows.length} jugadores sincronizados.`;
  }catch(e){$("syncMsg").textContent="Error: "+e.message;}
  finally{$("syncBtn").disabled=false;}
}
async function saveDay(){
  const row={
    day:$("dayInput").value,opens_at:$("openInput").value+":00",
    closes_at:$("closeInput").value+":00",enabled:$("enabledInput").checked
  };
  if(!row.day){$("dayMsg").textContent="Selecciona una fecha.";return;}
  const {error}=await supa.from("clause_days").upsert(row,{onConflict:"day"});
  $("dayMsg").textContent=error?"Error: "+error.message:"✓ Día guardado.";
  if(!error)loadDays();
}
async function loadDays(){
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:CFG.TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const {data}=await supa.from("clause_days").select("*").gte("day",today).order("day").limit(20);
  $("daysList").innerHTML=(data||[]).map(d=>`<div class="history-item">
    <div class="history-time">${d.day.slice(8,10)}/${d.day.slice(5,7)}</div>
    <div><div class="history-main">${d.enabled?"🟢 Abierto":"🔴 Cerrado"}</div>
    <div class="history-sub">${String(d.opens_at).slice(0,5)}–${String(d.closes_at).slice(0,5)}</div></div>
  </div>`).join("")||"<div class='empty'>No hay próximos días configurados.</div>";
}
})();
