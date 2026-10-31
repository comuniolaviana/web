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
 $('marketUpdated').textContent='Histórico desde '+df(d.fechaInicio)+' · Última publicación: '+esc(d.actualizado||'sin fecha')+'.';
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
fetch('../estadisticas.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No se pudo consultar el histórico');return r.json()}).then(init).catch(e=>{$('marketKPIs').textContent='Error al cargar datos: '+e.message;$('marketFound').textContent='No se han modificado datos.'});
})();