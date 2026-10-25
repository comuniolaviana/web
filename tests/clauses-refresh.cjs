const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2]||path.join(__dirname,'../app/app.js'),'utf8');
function harness(){
 const elements={ownerFilter:{value:'Rival',options:[{value:''},{value:'Rival'}]},confirmExecuteBtn:{disabled:false}};
 let calls=0,paints=0,failTable=null,release=null;
 const data={players:[{name:'A',owner_name:'Rival',active:true},{name:'B',owner_name:'Rival',active:true},{name:'C',owner_name:'Otro',active:true}],team_malo_players:[],clause_days:{enabled:true,opens_at:'00:00',closes_at:'23:59'},clause_executions:[],team_malo_purchases:[],team_malo_sales:[]};
 const client={from(table){calls++;const result={data:structuredClone(data[table]),error:failTable===table?Error('offline'):null};const wait=release;const q={select(){return q},eq(){return q},order(){return q},maybeSingle(){return q},then(ok,no){return (wait?wait.then(()=>result):Promise.resolve(result)).then(ok,no)}};return q}};
 const ctx={window:{COMUNIO_CONFIG:{SUPABASE_URL:'mock',SUPABASE_ANON_KEY:'mock',TIMEZONE:'Europe/Madrid'},addEventListener(){}},document:{hidden:false,addEventListener(){},getElementById:id=>elements[id]},setInterval(){},console:{error(){}},Intl,Date};
 vm.createContext(ctx);
 const setup=`
 supa=globalThis.mockClient; session={user:{id:'me'}}; profile={manager_name:'Yo'}; currentView='clauses';
 updateStatusUI=()=>{}; renderBadPlayers=()=>{}; renderMyTeam=()=>{}; renderActivityMini=()=>{};
 fillFilters=()=>{document.getElementById('ownerFilter').value='';};
 renderPlayers=()=>globalThis.paint(availablePlayers().map(p=>p.name));
 globalThis.api={refreshOpenLists,loadRealData,availablePlayers,setView(v){currentView=v;},setPending(v){pendingAction=v?{}:null;},snapshot(){return {players,clauseExecutions};}};
 })();`;
 ctx.mockClient=client;ctx.paint=names=>{paints++;ctx.visible=names};
 vm.runInContext(source.slice(0,source.lastIndexOf('boot().catch(e=>{'))+setup,ctx);
 return {ctx,data,elements,get calls(){return calls},get paints(){return paints},fail(table){failTable=table},resumeNewRequests(){release=null},hold(){let resolve;release=new Promise(r=>resolve=r);return()=>{release=null;resolve()}}};
}
(async()=>{
 const h=harness(),a=h.ctx.api;
 await a.refreshOpenLists();assert.deepEqual(Array.from(h.ctx.visible),['A','B','C']);assert.equal(h.elements.ownerFilter.value,'Rival');
 const firstPaint=h.paints;await a.refreshOpenLists();assert.equal(h.paints,firstPaint,'unchanged data must not redraw');
 h.data.players[0].owner_name='Comprador';h.data.clause_executions.push({target_owner_name:'Rival',player_name:'A',executor_name:'Comprador'});
 await a.refreshOpenLists();assert.deepEqual(Array.from(h.ctx.visible),['A','C'],'all players belonging to protected Rival disappear, purchased A now belongs to Comprador');
 h.data.players[0].owner_name='Yo';await a.refreshOpenLists();assert.deepEqual(Array.from(h.ctx.visible),['C'],'own new player is unavailable for own clauses');
 const snapshot=JSON.stringify(a.snapshot());h.fail('clause_executions');h.data.players=[];await a.refreshOpenLists();assert.equal(JSON.stringify(a.snapshot()),snapshot,'failed snapshot preserves previous lists and owner protections');h.fail(null);
 const calls=h.calls;h.ctx.document.hidden=true;await a.refreshOpenLists();assert.equal(h.calls,calls);h.ctx.document.hidden=false;a.setView('home');await a.refreshOpenLists();assert.equal(h.calls,calls);a.setView('clauses');a.setPending(true);h.elements.confirmExecuteBtn.disabled=true;await a.refreshOpenLists();assert.equal(h.calls,calls);a.setPending(false);h.elements.confirmExecuteBtn.disabled=false;
 const release=h.hold(),waiting=a.refreshOpenLists(),inFlightCalls=h.calls;await a.refreshOpenLists();assert.equal(h.calls,inFlightCalls,'no overlapping background requests');release();await waiting;
 const race=harness(),r=race.ctx.api,unblock=race.hold(),older=r.loadRealData();race.data.players=[{name:'Newest',owner_name:'Other',active:true}];race.resumeNewRequests();await r.loadRealData();unblock();await older;assert.equal(r.snapshot().players[0].name,'Newest','older response cannot overwrite a newer snapshot');
 assert.ok(source.includes('setInterval(refreshOpenLists,5000)'));assert.ok(source.includes('function miniNewsHtml(e)'));
 console.log('PASS: automatic refresh, protected owners, own players, preserved filters, no unnecessary redraw, errors, hidden views, confirmation, overlapping loads and stale responses.');
})().catch(e=>{console.error(e);process.exitCode=1});
