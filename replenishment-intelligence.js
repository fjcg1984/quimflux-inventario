/* QUIMFLUX Inventario - Reposición inteligente */
(function(){
  let started=false, cache={movements:[],loadedAt:0};
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('es-PE',{maximumFractionDigits:2});
  function category(id){return (state.categories||[]).find(c=>String(c.id)===String(id))||null}
  function type(id){return category(id)?.control_type==='CONTROL'?'CONTROL':'CONSUMO'}
  function wait(){
    if(started)return;
    if(typeof state==='undefined'||typeof sb==='undefined'){setTimeout(wait,150);return}
    started=true;
    const style=document.createElement('style');style.textContent='.ri-tools{display:grid;grid-template-columns:180px 1fr 170px minmax(220px,1.2fr);gap:10px;padding:16px 20px;border-bottom:1px solid var(--line);background:#fcfdfd}.ri-tools .control{min-width:0;width:100%}.ri-search{min-width:0}.ri-logic{margin:14px 20px;padding:11px 13px;border:1px solid var(--line);border-radius:10px;background:#f8faf9;color:var(--muted);font-size:11px;line-height:1.5}.ri-table{min-width:0!important;width:100%;table-layout:fixed}.ri-table th,.ri-table td{padding:11px 9px;font-size:11px;white-space:normal;word-break:break-word}.ri-table th{font-size:9px}.ri-table th:nth-child(1){width:10%}.ri-table th:nth-child(2){width:10%}.ri-table th:nth-child(3){width:17%}.ri-table th:nth-child(4){width:13%}.ri-table th:nth-child(5),.ri-table th:nth-child(6){width:7%}.ri-table th:nth-child(7),.ri-table th:nth-child(8){width:9%}.ri-table th:nth-child(9){width:10%}.ri-table th:nth-child(10){width:8%}.ri-refresh{margin-left:10px}@media(max-width:900px){.ri-tools{grid-template-columns:1fr 1fr}.ri-refresh{margin-left:0}}@media(max-width:560px){.ri-tools{grid-template-columns:1fr}.ri-table th,.ri-table td{padding:9px 6px;font-size:10px}.ri-table th{font-size:8px}}';document.head.appendChild(style);
    const obs=new MutationObserver(()=>enhance());
    obs.observe(document.body,{childList:true,subtree:true});
    enhance();
  }
  async function loadMovements(){
    const now=Date.now();
    if(now-cache.loadedAt<30000&&cache.movements.length)return cache.movements;
    const from=new Date(now-90*86400000).toISOString();
    const {data,error}=await sb.from('movements').select('id,item_id,movement_type,quantity,movement_date,notes').gte('movement_date',from).order('movement_date',{ascending:false}).limit(5000);
    if(error)throw error;
    cache={movements:data||[],loadedAt:now};
    return cache.movements;
  }
  function enhance(){
    if(state.view!=='dashboard')return;
    const old=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.trim()==='Reposición inteligente');
    if(!old||old.dataset.riEnhanced==='1')return;
    old.dataset.riEnhanced='1';
    render(old).catch(err=>{old.dataset.riEnhanced='';old.innerHTML='<div class="empty"><strong>No se pudo calcular reposición</strong>'+esc(err.message)+'</div>'});
  }
  async function render(panel){
    const movements=await loadMovements();
    const items=(state.items||[]).filter(i=>type(i.category_id)==='CONSUMO');
    panel.classList.add('ri-panel');
    panel.innerHTML=`<div class="panel-head"><div><h2>Reposición inteligente</h2><div class="sub">Solo categorías CONSUMO. La cobertura se calcula con el consumo real del período seleccionado.</div></div><span class="badge critical" id="ri-count">0 artículos</span></div>
      <div class="ri-tools"><select class="control" id="ri-period"><option value="7">Últimos 7 días</option><option value="30" selected>Últimos 30 días</option><option value="60">Últimos 60 días</option><option value="90">Últimos 90 días</option></select><select class="control" id="ri-category"><option value="">Todas las categorías CONSUMO</option>${(state.categories||[]).filter(c=>c.control_type!=='CONTROL').sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><select class="control" id="ri-priority"><option value="">Todas las prioridades</option><option value="CRÍTICA">Crítica</option><option value="ALTA">Alta</option></select><input class="control ri-search" id="ri-search" placeholder="Buscar por código o bien..."></div>
      <div class="ri-logic"><b>Cómo se calcula:</b> consumo promedio diario = salidas operativas ÷ días del período · cobertura = stock ÷ promedio diario · objetivo = máximo entre 2× mínimo y mínimo + consumo proyectado de 30 días · la cantidad sugerida es lo necesario para alcanzar ese objetivo. Los ajustes de inventario no cuentan.</div>
      <div class="table-wrap"><table class="ri-table"><thead><tr><th>Prioridad</th><th>Código</th><th>Bien</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Consumo</th><th>Prom./día</th><th>Cobertura</th><th>Sugerido</th></tr></thead><tbody id="ri-body"><tr><td colspan="10">Calculando...</td></tr></tbody></table></div>`;
    ['ri-period','ri-category','ri-priority','ri-search'].forEach(id=>$('#'+id)?.addEventListener('input',paint));
    ['ri-period','ri-category','ri-priority'].forEach(id=>$('#'+id)?.addEventListener('change',paint));
    paint();
    async function refresh(){try{cache.loadedAt=0;await loadMovements();paint()}catch(e){if(typeof toast==='function')toast(e.message,true)}}
    const refreshBtn=document.createElement('button');refreshBtn.className='btn btn-secondary ri-refresh';refreshBtn.textContent='↻ Actualizar datos';refreshBtn.onclick=refresh;panel.querySelector('.panel-head').appendChild(refreshBtn);
    function paint(){
      const days=Number($('#ri-period')?.value||30), catId=$('#ri-category')?.value||'', priority=$('#ri-priority')?.value||'', q=($('#ri-search')?.value||'').trim().toLowerCase();
      const cutoff=Date.now()-days*86400000;
      const rows=items.map(i=>{
        const cat=category(i.category_id);
        if(catId&&String(i.category_id)!==catId)return null;
        const outs=movements.filter(m=>m.item_id===i.id&&m.movement_type==='EXIT'&&new Date(m.movement_date).getTime()>=cutoff&&!String(m.notes||'').trim().toUpperCase().includes('AJUSTE DE INVENTARIO'));
        const consumption=outs.reduce((a,m)=>a+Number(m.quantity||0),0);
        const daily=consumption/days;
        const stock=Number(i.current_stock||0), minimum=Number(i.minimum_stock||0);
        let suggested=0, pri='';
        if(stock<=0){pri='CRÍTICA'}
        else if(stock<=minimum){pri='ALTA'}
        else if(daily>0){const target=Math.max(minimum*2,minimum+daily*30);suggested=Math.max(0,target-stock);if(suggested<=0)return null;pri='ALTA'}
        else return null;
        if(pri==='CRÍTICA')suggested=Math.max(minimum*2,minimum)-stock;
        if(pri==='ALTA'&&suggested<=0)suggested=Math.max(minimum*2,minimum)-stock;
        suggested=Math.max(0,suggested);
        const coverage=daily>0?stock/daily:null;
        const text=`${i.code||''} ${i.name||''}`.toLowerCase();
        if(q&&!text.includes(q))return null;
        if(priority&&pri!==priority)return null;
        return {id:i.id,priority:pri,code:i.code,name:i.name,category:cat?.name||'Sin categoría',stock,minimum,consumption,daily,coverage,suggested};
      }).filter(Boolean).sort((a,b)=>(a.priority==='CRÍTICA'?0:1)-(b.priority==='CRÍTICA'?0:1)||b.suggested-a.suggested||a.code.localeCompare(b.code));
      $('#ri-count').textContent=`${rows.length} ${rows.length===1?'artículo':'artículos'}`;
      $('#ri-body').innerHTML=rows.length?rows.map(r=>`<tr><td><span class="badge ${r.priority==='CRÍTICA'?'critical':'low'}">${r.priority}</span></td><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${fmt(r.stock)}</td><td>${fmt(r.minimum)}</td><td>${fmt(r.consumption)}</td><td>${fmt(r.daily)}</td><td>${r.coverage===null?'Sin consumo':fmt(r.coverage)+' días'}</td><td><b>${fmt(Math.ceil(r.suggested*100)/100)}</b></td></tr>`).join(''):'<tr><td colspan="10"><div class="empty">No hay necesidades de reposición con los filtros seleccionados.</div></td></tr>';
    }
  }
  wait();
})();