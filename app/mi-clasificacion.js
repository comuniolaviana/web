(() => {
  "use strict";
  const target=document.getElementById("myTeamLeagueSummary");
  const nameEl=document.getElementById("myTeamManager");
  if(!target||!nameEl)return;
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  const fmt=new Intl.NumberFormat("es-ES");
  let db=null,lastManager="",loading=null;
  async function getData(){
    if(db)return db;
    if(!loading)loading=fetch("jornadas-data.json?v=20261023",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("No disponible");return r.json()}).then(d=>db=d);
    return loading;
  }
  async function update(){
    const manager=nameEl.textContent.trim();
    if(!manager||manager==="—"||manager==="MI EQUIPO"){target.hidden=true;return}
    if(manager===lastManager&&db)return;
    lastManager=manager;
    try{
      const data=await getData();
      if(lastManager!==manager)return;
      const m=data.managers.find(x=>norm(x.id)===norm(manager)||norm(x.name)===norm(manager));
      if(!m){target.hidden=true;return;}
      const totalFor=x=>data.rounds.reduce((sum,r)=>sum+(r.results.find(z=>z.id===x.id)?.points||0),0);
      const ordered=[...data.managers].sort((a,b)=>totalFor(b)-totalFor(a)||(data.managers.indexOf(a)-data.managers.indexOf(b)));
      const position=ordered.findIndex(x=>x.id===m.id)+1,total=totalFor(m);
      const rounds=[...data.rounds].sort((a,b)=>(a.order??Number(a.round))-(b.order??Number(b.round)));
      const latest=rounds.at(-1);
      const latestResult=latest?.results.find(x=>x.id===m.id);
      const pending=data.rounds.some(r=>r.status==="provisional");
      target.hidden=false;
      target.innerHTML='<div class="my-league-title">🏆 Mi clasificación Comunio <a href="jornadas.html">Ver todas las jornadas →</a></div>'+
      '<div class="my-league-numbers"><div><strong>'+fmt.format(total)+'</strong><span>Puntos en la general</span></div><div><strong>'+position+'º</strong><span>Posición de 18</span></div><div><strong>'+(latestResult?fmt.format(latestResult.points):"—")+'</strong><span>'+(latest.label||"Jornada "+latest.round)+'</span></div></div>'+
      (pending?'<p class="my-league-warning">⚠️ Clasificación provisional: la jornada 8 tiene un partido pendiente.</p>':'');
    }catch(err){target.hidden=false;target.textContent="No se pudo cargar tu clasificación personal."}
  }
  new MutationObserver(update).observe(nameEl,{childList:true,characterData:true,subtree:true});
  update();
})();