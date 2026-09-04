/* QUIMFLUX Inventario - Fase 2 Gestión */
(function(){
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('es-PE',{maximumFractionDigits:2});
  const EXCLUDED_CONSUMPTION_CATEGORIES=['COPELAS','CRISOLES','ESCORIFICADORES'];
  let started=false, dashboardData=null;

  function wait(){
    if(started)return;
    const nav=$('#nav');
    if(!nav||typeof state==='undefined'||typeof sb==='undefined'){setTimeout(wait,150);return;}
    started=true;
    const b=document.createElement('button');b.className='nav-item';b.dataset.view='dashboard';b.innerHTML='▥ <span>Gestión</span>';nav.insertBefore(b,nav.firstChild);
    nav.addEventListener('click',e=>{const btn=e.target.closest('[data-view="dashboard"]');if(!btn)return;e.preventDefault();e.stopPropagation();state.view='dashboard';document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===btn));const t=$('#page-title');if(t)t.textContent='Gestión';renderDashboard();},true);
  }

  async function renderDashboard(){
    $('#content').innerHTML='<div class="panel"><div class="panel-head"><div><h2>Panel de gestión</h2><div class="sub">Analiza existencias, consumo y necesidades de reposición.</div></div></div><div style="padding:24px">Calculando indicadores...</div></div>';
    const from=new Date(Date.now()-90*86400000).toISOString();
    const {data,error}=await sb.from('movements').select('id,item_id,movement_type,quantity,movement_date,document_number,supplier,destination,created_by,notes,items(code,name,category_id)').gte('movement_date',from).order('movement_date',{ascending:false}).limit(5000);
    if(error){$('#content').innerHTML=`<div class="panel"><div class="empty"><strong>No se pudo cargar gestión</strong>${esc(error.message)}</div></div>`;return;}
    dashboardData={movements:data||[],from};paintDashboard();
  }

  function categoryName(categoryId){
    const c=(state.categories||[]).find(x=>String(x.id)===String(categoryId));
    return c?.name||'Sin categoría';
  }
  function isExcludedConsumption(m){
    const category=categoryName(m.items?.category_id).trim().toUpperCase();
    const notes=String(m.notes||'').trim().toUpperCase();
    return EXCLUDED_CONSUMPTION_CATEGORIES.includes(category)||notes.includes('AJUSTE DE INVENTARIO');
  }
  function consumptionMovements(mov, sinceMs){
    return mov.filter(m=>m.movement_type==='EXIT'&&new Date(m.movement_date).getTime()>=sinceMs&&!isExcludedConsumption(m));
  }

  function paintDashboard(){
    const mov=dashboardData.movements||[], items=state.items||[];
    const days=30, since=Date.now()-days*86400000;
    const last30=mov.filter(m=>new Date(m.movement_date).getTime()>=since);
    const out30=consumptionMovements(mov,since);
    const low=items.filter(i=>i.stock_status==='LOW').length, critical=items.filter(i=>i.stock_status==='CRITICAL').length;
    const units=items.reduce((a,i)=>a+Number(i.current_stock||0),0);
    const noMove=items.filter(i=>!mov.some(m=>m.item_id===i.id)).length;
    const catMap={};
    out30.forEach(m=>{const k=categoryName(m.items?.category_id);catMap[k]=(catMap[k]||0)+Number(m.quantity||0)});
    const top=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const rep=buildReplenishment(items,mov);
    $('#content').innerHTML=`
      <div class="toolbar" style="margin-bottom:18px"><div><span class="sub">Período de análisis: últimos 30 días · ajustes de inventario y Copelas/Crisoles/Escorificadores excluidos del consumo</span></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary" id="p2-refresh">↻ Actualizar</button><button class="btn btn-secondary" id="p2-csv">Exportar CSV</button><button class="btn btn-secondary" id="p2-print">Imprimir / PDF</button></div></div>
      <div class="cards"><div class="card"><div class="label">Artículos activos</div><div class="value">${items.length}</div><div class="sub">Catálogo vigente</div></div><div class="card"><div class="label">Unidades en stock</div><div class="value">${fmt(units)}</div><div class="sub">Existencia actual</div></div><div class="card"><div class="label">Stock bajo / crítico</div><div class="value warning">${low} / ${critical}</div><div class="sub">Requieren atención</div></div><div class="card"><div class="label">Consumo 30 días</div><div class="value danger">${fmt(out30.reduce((a,m)=>a+Number(m.quantity||0),0))}</div><div class="sub">Solo salidas operativas</div></div></div>
      <div class="panel"><div class="panel-head"><div><h2>Reposición inteligente</h2><div class="sub">Sugerencia basada en stock mínimo y consumo operativo de los últimos 30 días. No considera ajustes de inventario ni Copelas, Crisoles o Escorificadores.</div></div><span class="badge critical">${rep.length} artículos</span></div><div class="table-wrap"><table><thead><tr><th>Prioridad</th><th>Código</th><th>Bien</th><th>Stock</th><th>Mínimo</th><th>Consumo 30d</th><th>Promedio/día</th><th>Sugerido</th></tr></thead><tbody>${rep.length?rep.map(r=>`<tr><td><span class="badge ${r.priority==='CRÍTICA'?'critical':'low'}">${r.priority}</span></td><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${fmt(r.stock)}</td><td>${fmt(r.minimum)}</td><td>${fmt(r.consumption)}</td><td>${fmt(r.daily)}</td><td><b>${fmt(r.suggested)}</b></td></tr>`).join(''):'<tr><td colspan="8">No hay necesidades de reposición.</td></tr>'}</tbody></table></div></div>
      <div class="cards" style="align-items:stretch"><div class="panel" style="margin:0;flex:1;min-width:300px"><div class="panel-head"><h2>Consumo por categoría</h2></div><div class="table-wrap"><table><thead><tr><th>Categoría</th><th>Salidas 30d</th></tr></thead><tbody>${top.map(([k,v])=>`<tr><td>${esc(k)}</td><td><b>${fmt(v)}</b></td></tr>`).join('')||'<tr><td colspan="2">Sin salidas operativas registradas</td></tr>'}</tbody></table></div></div><div class="panel" style="margin:0;flex:1;min-width:300px"><div class="panel-head"><h2>Control de actividad</h2></div><div class="form-grid" style="padding:18px"><div><b>Entradas 30d</b><div>${fmt(last30.filter(m=>m.movement_type==='ENTRY').reduce((a,m)=>a+Number(m.quantity||0),0))}</div></div><div><b>Consumo 30d</b><div>${fmt(out30.reduce((a,m)=>a+Number(m.quantity||0),0))}</div></div><div><b>Sin movimiento 90d</b><div>${noMove}</div></div><div><b>Movimientos analizados</b><div>${mov.length}</div></div></div></div></div>
      <div class="panel"><div class="panel-head"><div><h2>Consumo por artículo</h2><div class="sub">Top 15 artículos por salidas operativas en 30 días.</div></div></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Bien</th><th>Categoría</th><th>Salidas 30d</th></tr></thead><tbody>${topItems(out30).map(r=>`<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td><b>${fmt(r.qty)}</b></td></tr>`).join('')||'<tr><td colspan="4">Sin salidas operativas registradas.</td></tr>'}</tbody></table></div></div>`;
    $('#p2-refresh').onclick=renderDashboard;$('#p2-csv').onclick=exportCSV;$('#p2-print').onclick=()=>window.print();
  }

  function buildReplenishment(items,mov){
    const since=Date.now()-30*86400000;
    return items.map(i=>{const consumption=mov.filter(m=>m.item_id===i.id&&m.movement_type==='EXIT'&&new Date(m.movement_date).getTime()>=since&&!isExcludedConsumption(m)).reduce((a,m)=>a+Number(m.quantity||0),0);const daily=consumption/30;const target=Math.max(Number(i.minimum_stock||0)*2,Number(i.minimum_stock||0)+daily*30);const suggested=Math.max(0,target-Number(i.current_stock||0));if(suggested<=0&&i.stock_status==='SUFFICIENT')return null;return {code:i.code,name:i.name,stock:Number(i.current_stock||0),minimum:Number(i.minimum_stock||0),consumption,daily,suggested:Math.ceil(suggested*100)/100,priority:i.stock_status==='CRITICAL'?'CRÍTICA':'ALTA'};}).filter(Boolean).sort((a,b)=>(a.priority==='CRÍTICA'?0:1)-(b.priority==='CRÍTICA'?0:1)||b.suggested-a.suggested);
  }
  function topItems(out){const m={};out.forEach(x=>{const k=x.item_id;if(!m[k])m[k]={code:x.items?.code||'',name:x.items?.name||'',category:categoryName(x.items?.category_id),qty:0};m[k].qty+=Number(x.quantity||0)});return Object.values(m).sort((a,b)=>b.qty-a.qty).slice(0,15);}
  function exportCSV(){
    const items=state.items||[], mov=dashboardData?.movements||[];const rows=[['Código','Bien','Categoría','Stock','Mínimo','Estado','Consumo operativo 30d']];const since=Date.now()-30*86400000;items.forEach(i=>{const q=mov.filter(m=>m.item_id===i.id&&m.movement_type==='EXIT'&&new Date(m.movement_date).getTime()>=since&&!isExcludedConsumption(m)).reduce((a,m)=>a+Number(m.quantity||0),0);rows.push([i.code,i.name,i.category_name||'',i.current_stock,i.minimum_stock,i.stock_status,q])});const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='QUIMFLUX_gestion_inventario.csv';a.click();URL.revokeObjectURL(a.href);
  }
  wait();
})();