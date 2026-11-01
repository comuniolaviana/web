(()=>{'use strict';
const $=id=>document.getElementById(id);
const nf=new Intl.NumberFormat('es-ES');
const money=n=>nf.format(Number(n)||0)+' €';
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const df=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):esc(s||'—');
const inputs=['marketSearch','marketFrom','marketTo','marketOwner','marketType'];
let entries=[],source=null,page=0,filtered=[];
const pageSize=35;
function render(){
 const q=norm($('marketSearch').value),start=$('marketFrom').value,end=$('marketTo').value,owner=norm($('marketOwner').value),type=$('marketType').value;
 filtered=entries.filter(x=>{
  if(start&&x.fecha<start||end&&x.fecha>end)return false;
  if(q&&!norm(x.jugador+' '+x.vendedor+' '+x.comprador).includes(q))return false;
  if(owner){const seller=norm(x.vendedor)===owner,buyer=norm(x.comprador)===owner;if(type==='compra'&&!buyer||type==='venta'&&!seller||!type&&!seller&&!buyer)return false}
  return true;
 });
 const count=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,count-1);
 $('marketFound').textContent=nf.format(filtered.length)+' movimientos encontrados';
 $('marketRows').innerHTML=filtered.slice(page*pageSize,(page+1)*pageSize).map(x=>'<tr><td style="white-space:nowrap">'+df(x.fecha)+'</td><td>'+esc(x.jugador)+'</td><td>'+esc(x.vendedor)+' → '+esc(x.comprador)+'</td><td class="num">'+money(x.precio)+'</td></tr>').join('')||'<tr><td colspan="4">Sin movimientos para estos filtros.</td></tr>';
 $('marketPage').textContent=(page+1)+' / '+count;
 $('marketPrev').disabled=page===0;$('marketNext').disabled=page>=count-1;
}
function filterOnPlayer(name){$('marketSearch').value=name;$('marketFrom').value='';$('marketTo').value='';$('marketOwner').value='';$('marketType').value='';page=0;render();document.querySelector('#marketSearch').scrollIntoView({behavior:'smooth',block:'center'});}
function filterOnOwner(name){$('marketOwner').value=name;$('marketSearch').value='';$('marketFrom').value='';$('marketTo').value='';$('marketType').value='';page=0;render();document.querySelector('#marketSearch').scrollIntoView({behavior:'smooth',block:'center'});}
function init(d){
 source=d;
 entries=(d.historial||[]).filter(x=>x&&x.fecha).sort((a,b)=>b.fecha.localeCompare(a.fecha));
 const teams=d.equipos||[],players=d.jugadoresMasTraspasados||[];
 $('marketKPIs').innerHTML=[
  ['Movimientos del histórico',d.totalMovimientosUsuarios??entries.length],
  ['Futbolistas distintos',d.totalJugadores??new Set(entries.map(x=>x.jugador)).size],
  ['Propietarios',teams.length],
  ['Jugadores en equipos',teams.reduce((n,x)=>n+(Number(x.jugadores)||0),0)]
 ].map(([label,num])=>'<div class="market-kpi"><b>'+nf.format(num)+'</b><span>'+esc(label)+'</span></div>').join('');
 $('marketUpdated').textContent='Histórico desde '+df(d.fechaInicio)+' · Última actualización de Comuniazo: '+esc(d.actualizado||'sin fecha')+'.';
 $('marketOwner').innerHTML='<option value="">Todos los propietarios</option>'+teams.map(x=>'<option value="'+esc(x.propietario)+'">'+esc(x.propietario)+'</option>').join('');
 $('marketOwners').innerHTML=teams.slice().sort((a,b)=>b.movimientos-a.movimientos).map(x=>'<tr><td><button type="button" data-owner="'+esc(x.propietario)+'" class="market-clear">'+esc(x.propietario)+'</button></td><td class="num">'+nf.format(x.movimientos)+'</td><td class="num">'+nf.format(x.jugadores)+'</td></tr>').join('');
 $('marketPlayers').innerHTML=players.map(x=>'<tr><td><button type="button" data-player="'+esc(x.jugador)+'" class="market-clear">'+esc(x.jugador)+'</button></td><td class="num">'+nf.format(x.traspasos)+'</td></tr>').join('');
 render();
}
inputs.forEach(id=>$(id).addEventListener(id==='marketSearch'?'input':'change',()=>{page=0;render()}));
$('marketReset').addEventListener('click',()=>{inputs.forEach(id=>$(id).value='');page=0;render()});
$('marketPrev').addEventListener('click',()=>{if(page>0){page--;render()}});
$('marketNext').addEventListener('click',()=>{if((page+1)*pageSize<filtered.length){page++;render()}});
$('marketOwners').addEventListener('click',e=>{const b=e.target.closest('[data-owner]');if(b)filterOnOwner(b.dataset.owner)});
$('marketPlayers').addEventListener('click',e=>{const b=e.target.closest('[data-player]');if(b)filterOnPlayer(b.dataset.player)});
// El mercado usa la misma fuente que Cláusulas y Equipo Malo: Supabase.
// estadisticas.json era una fotografía antigua del Excel, no la liga actual.
const cfg=window.COMUNIO_CONFIG;
const client=cfg&&window.supabase?.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
let loading=false,lastLoaded=0;
const managers=Array.isArray(cfg?.LOGIN_USERS)?cfg.LOGIN_USERS:[];
const managerByKey=new Map(managers.map(n=>[norm(n),n]));
function managerName(v){
 const text=String(v||'').trim();
 const key=norm(text)==='carlos1926'?'carlos':norm(text);
 return managerByKey.get(key)||text;
}
async function getAllTransfers(){
 const rows=[];
 for(let i=0;i<15000;i+=500){
   const {data,error}=await client.from('comunio_transfers')
     .select('id,transfer_date,player_name,price,seller,buyer')
     .order('id',{ascending:true}).range(i,i+499);
   if(error)throw error;
   rows.push(...(data||[]));
   if(!data||data.length<500)return rows;
 }
 throw Error('El histórico supera el máximo de consulta; no se muestra incompleto.');
}
function madridTimestamp(value){
 if(!value)return '';
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return '';
 return new Intl.DateTimeFormat('es-ES',{
   timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',
   year:'numeric',hour:'2-digit',minute:'2-digit'
 }).format(date);
}
async function loadCurrentMarket(){
 if(loading||!client)return;
 loading=true;
 $('marketUpdated').textContent='Consultando mercado actualizado en Supabase…';
 try{
   const {data:{session},error:authError}=await client.auth.getSession();
   if(authError||!session)throw Error('Inicia sesión en la aplicación para consultar el mercado actualizado.');
   const [transfers,p,sync]=await Promise.all([
     getAllTransfers(),
     client.from('players').select('name,owner_name').eq('active',true).range(0,499),
     client.from('data_sync_state').select('synced_at').eq('source','comuniazo_last_published').maybeSingle()
   ]);
   if(p.error)throw p.error;
   if(sync.error)throw sync.error;
   const owners=new Map(managers.map(name=>[name,{propietario:name,movimientos:0,jugadores:0}]));
   const playerCounts=new Map();
   const history=transfers.map(x=>{
     const seller=managerName(x.seller),buyer=managerName(x.buyer);
     if(owners.has(seller))owners.get(seller).movimientos++;
     if(owners.has(buyer))owners.get(buyer).movimientos++;
     const player=String(x.player_name||'').trim();
     playerCounts.set(player,(playerCounts.get(player)||0)+1);
     return {fecha:x.transfer_date,jugador:player,precio:Number(x.price),vendedor:seller,comprador:buyer};
   });
   for(const x of p.data||[]){
     const manager=managerName(x.owner_name);
     if(owners.has(manager))owners.get(manager).jugadores++;
   }
   const earliest=history.reduce((v,x)=>!v||x.fecha<v?x.fecha:v,'');
   const topPlayers=[...playerCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'es')).slice(0,25)
     .map(([jugador,traspasos])=>({jugador,traspasos}));
   init({
     historial:history,
     totalMovimientosUsuarios:history.length,
     totalJugadores:playerCounts.size,
     fechaInicio:earliest,
     actualizado:madridTimestamp(sync.data?.synced_at)||'sin fecha de publicación',
     equipos:[...owners.values()],
     jugadoresMasTraspasados:topPlayers
   });
   $('marketSource').textContent='Fuente: traspasos y propietarios actuales de Supabase. Las cláusulas ejecutadas desde la aplicación cuentan una sola vez, aunque Comunio haya confirmado el mismo movimiento.';
   lastLoaded=Date.now();
 }catch(e){
   $('marketKPIs').textContent='No se pudo cargar el mercado actualizado: '+e.message;
   $('marketFound').textContent='No se ha recurrido al archivo antiguo de Excel.';
 }finally{loading=false;}
}
loadCurrentMarket();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadCurrentMarket();});
window.addEventListener('focus',()=>loadCurrentMarket());
window.addEventListener('pageshow',()=>loadCurrentMarket());
document.addEventListener('comuniazo-updated',()=>loadCurrentMarket());
$('marketRefresh')?.addEventListener('click',()=>loadCurrentMarket());
})();