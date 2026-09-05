/* QUIMFLUX Inventario - Fase 2 Gestión */
(function(){
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('es-PE',{maximumFractionDigits:2});
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
    $('#content').innerHTML='<div class="panel"><div class="panel-head"><div><h2>Panel de gestión</h2><div class="sub">Inventario, consumo, reposición y control de bienes especiales.</div></div></div><div style="padding:24px">Calculando indicadores...</div></div>';
    const from=new Date(Date.now()-90*86400000).toISOString();
    const {data,error}=await sb.from('movements').select('id,item_id,movement_type,quantity,movement_date,document_number,supplier,destination,created_by,notes,items(code,name,category_id)').gte('movement_date',from).order('movement_date',{ascending:false}).limit(5000);
    if(error){$('#content').innerHTML=`<div class="panel"><div class="empty"><strong>No se pudo cargar gestión</strong>${esc(error.message)}</div></div>`;return;}
    dashboardData={movements:data||[],from};paintDashboard();
  }

  function category(categoryId){return (state.categories||[]).find(x=>String(x.id)===String(categoryId))||null;}
  function categoryName(categoryId){return category(categoryId)?.name||'Sin categoría';}
  function controlType(categoryId){return category(categoryId)?.control_type==='CONTROL'?'CONTROL':'CONSUMO';}
  function isControlItem(item){return controlType(item.category_id)==='CONTROL';}
  function isExcludedOperational(m){return String(m.notes||'').trim().toUpperCase().includes('AJUSTE DE INVENTARIO');}
  function operationalExits(mov,sinceMs){return mov.filter(m=>m.movement_type==='EXIT'&&new Date(m.movement_date).getTime()>=sinceMs&&!isExcludedOperational(m)&&controlType(m.items?.category_id)==='CONSUMO');}

  function paintDashboard(){
    const mov=dashboardData.movements||[], items=state.items||[];
    const since=Date.now()-30*86400000;
    const last30=mov.filter(m=>new Date(m.movement_date).getTime()>=since);
    const out30=operationalExits(mov,since);
    const consumptionItems=items.filter(i=>!isControlItem(i));
    const controlItems=items.filter(isControlItem);
    const low=consumptionItems.filter(i=>i.stock_status==='LOW').length, critical=consumptionItems.filter(i=>i.stock_status==='CRITICAL').length;
    const units=items.reduce((a,i)=>a+Number(i.current_stock||0),0);
    const unitsConsumption=consumptionItems.reduce((a,i)=>a+Number(i.current_stock||0),0);
    const unitsControl=controlItems.reduce((a,i)=>a+Number(i.current_stock||0),0);
    const noMove=items.filter(i=>!mov.some(m=>m.item_id===i.id)).length;
    const rep=buildReplenishment(consumptionItems,mov);
    const catMap={};out30.forEach(m=>{const k=categoryName(m.items?.category_id);catMap[k]=(catMap[k]||0)+Number(m.quantity||0)});
    const top=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const controlRows=buildControlRows(controlItems,mov);
    $('#content').innerHTML=`
      <div class="toolbar" style="margin-bottom:18px"><div><span class="sub">Últimos 30 días · consumo y reposición solo para categorías de tipo CONSUMO. Los bienes de CONTROL se siguen registrando, pero no generan alertas de reposición.</span></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary" id="p2-refresh">↻ Actualizar</button><button class="btn btn-secondary" id="p2-csv">Exportar CSV</button><button class="btn btn-secondary" id="p2-print">Imprimir / PDF</button></div></div>
      <div class="cards"><div class="card"><div class="label">Artículos activos</div><div class="value">${items.length}</div><div class="sub">Catálogo vigente</div></div><div class="card"><div class="label">Stock total</div><div class="value">${fmt(units)}</div><div class="sub">Consumo: ${fmt(unitsConsumption)} · Control: ${fmt(unitsControl)}</div></div><div class="card"><div class="label">Stock bajo / crítico</div><div class="value warning">${low} / ${critical}</div><div class="sub">Solo categorías CONSUMO</div></div><div class="card"><div class="label">Consumo 30 días</div><div class="value danger">${fmt(out30.reduce((a,m)=>a+Number(m.quantity||0),0))}</div><div class="sub">Salidas operativas de CONSUMO</div></div></div>
      <div class="panel"><div class="panel-head"><div><h2>Reposición inteligente</h2><div class="sub">Solo bienes de categorías CONSUMO. Se excluyen ajustes de inventario.</div></div><span class="badge critical">${rep.length} artículos</span></div><div class="table-wrap"><table><thead><tr><th>Prioridad</th><th>Código</th><th>Bien</th><th>Stock</th><th>Mínimo</th><th>Consumo 30d</th><th>Promedio/día</th><th>Sugerido</th></tr></thead><tbody>${rep.length?rep.map(r=>`<tr><td><span class="badge ${r.priority==='CRÍTICA'?'critical':'low'}">${r.priority}</span></td><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${fmt(r.stock)}</td><td>${fmt(r.minimum)}</td><td>${fmt(r.consumption)}</td><td>${fmt(r.daily)}</td><td><b>${fmt(r.suggested)}</b></td></tr>`).join(''):'<tr><td colspan="8">No hay necesidades de reposición en bienes de consumo.</td></tr>'}</tbody></table></div></div>
      <div class="panel"><div class="panel-head"><div><h2>🔵 Bienes de control</h2><div class="sub">Copelas, Crisoles, Escorificadores y cualquier categoría marcada como CONTROL. Se controla existencia y movimiento, sin alertas automáticas de reposición.</div></div><span class="badge low">${controlItems.length} artículos</span></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Bien</th><th>Categoría</th><th>Stock actual</th><th>Entradas 30d</th><th>Salidas 30d</th><th>Último movimiento</th><th>Acción</th></tr></thead><tbody>${controlRows.length?controlRows.map(r=>`<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td><b>${fmt(r.stock)}</b></td><td>${fmt(r.entries)}</td><td>${fmt(r.exits)}</td><td>${esc(r.last||'Sin movimiento')}</td><td><button class="btn btn-secondary p2-control-mov" data-item="${esc(r.id)}">Ver movimientos</button></td></tr>`).join(''):'<tr><td colspan="8">No hay bienes de control registrados.</td></tr>'}</tbody></table></div></div>
      <div class="cards" style="align-items:stretch"><div class="panel" style="margin:0;flex:1;min-width:300px"><div class="panel-head"><div><h2>Consumo por categoría</h2><div class="sub">Solo salidas operativas de categorías CONSUMO.</div></div></div><div class="table-wrap"><table><thead><tr><th>Categoría</th><th>Salidas 30d</th></tr></thead><tbody>${top.map(([k,v])=>`<tr><td>${esc(k)}</td><td><b>${fmt(v)}</b></td></tr>`).join('')||'<tr><td colspan="2">Sin salidas operativas registradas</td></tr>'}</tbody></table></div></div><div class="panel" style="margin:0;flex:1;min-width:300px"><div class="panel-head"><h2>Control de actividad</h2></div><div class="form-grid" style="padding:18px"><div><b>Entradas 30d</b><div>${fmt(last30.filter(m=>m.movement_type==='ENTRY').reduce((a,m)=>a+Number(m.quantity||0),0))}</div></div><div><b>Consumo 30d</b><div>${fmt(out30.reduce((a,m)=>a+Number(m.quantity||0),0))}</div></div><div><b>Sin movimiento 90d</b><div>${noMove}</div></div><div><b>Movimientos analizados</b><div>${mov.length}</div></div></div></div></div>
      <div class="panel"><div class="panel-head"><div><h2>Consumo por artículo</h2><div class="sub">Top 15 artículos por salidas operativas en 30 días. Solo CONSUMO.</div></div></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Bien</th><th>Categoría</th><th>Salidas 30d</th></tr></thead><tbody>${topItems(out30).map(r=>`<tr><td><b>${esc(r.code)}</b></td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td><b>${fmt(r.qty)}</b></td></tr>`).join('')||'<tr><td colspan="4">Sin salidas operativas registradas.</td></tr>'}</tbody></table></div></div>`;
    $('#p2-refresh').onclick=renderDashboard;$('#p2-csv').onclick=exportCSV;$('#p2-print').onclick=()=>window.print();
    document.querySelectorAll('.p2-control-mov').forEach(btn=>btn.onclick=()=>showControlMovements(btn.dataset.item));
  }

  function buildReplenishment(items,mov){
    const since=Date.now()-30*86400000;
    return items.map(i=>{const consumption=mov.filter(m=>m.item_id===i.id&&m.movement_type==='EXIT'&&new Date(m.movement_date).getTime()>=since&&!isExcludedOperational(m)).reduce((a,m)=>a+Number(m.quantity||0),0);const daily=consumption/30;const target=Math.max(Number(i.minimum_stock||0)*2,Number(i.minimum_stock||0)+daily*30);const suggested=Math.max(0,target-Number(i.current_stock||0));if(suggested<=0&&i.stock_status==='SUFFICIENT')return null;return {code:i.code,name:i.name,stock:Number(i.current_stock||0),minimum:Number(i.minimum_stock||0),consumption,daily,suggested:Math.ceil(suggested*100)/100,priority:i.stock_status==='CRITICAL'?'CRÍTICA':'ALTA'};}).filter(Boolean).sort((a,b)=>(a.priority==='CRÍTICA'?0:1)-(b.priority==='CRÍTICA'?0:1)||b.suggested-a.suggested);
  }
  function buildControlRows(items,mov){
    return items.map(i=>{const mm=mov.filter(m=>m.item_id===i.id);const entries=mm.filter(m=>m.movement_type==='ENTRY').reduce((a,m)=>a+Number(m.quantity||0),0);const exits=mm.filter(m=>m.movement_type==='EXIT').reduce((a,m)=>a+Number(m.quantity||0),0);const last=mm.sort((a,b)=>new Date(b.movement_date)-new Date(a.movement_date))[0];return {id:i.id,code:i.code,name:i.name,category:categoryName(i.category_id),stock:Number(i.current_stock||0),entries,exits,last:last?new Date(last.movement_date).toLocaleString('es-PE',{timeZone:'America/Lima'}):''};}).sort((a,b)=>a.code.localeCompare(b.code));
  }
  function showControlMovements(itemId){
    const item=(state.items||[]).find(i=>String(i.id)===String(itemId));if(!item)return;
    const mm=(dashboardData?.movements||[]).filter(m=>m.item_id===itemId).sort((a,b)=>new Date(b.movement_date)-new Date(a.movement_date));
    const rows=mm.map(m=>`<tr><td>${new Date(m.movement_date).toLocaleString('es-PE',{timeZone:'America/Lima'})}</td><td><span class="badge ${m.movement_type==='ENTRY'?'ok':'low'}">${m.movement_type==='ENTRY'?'ENTRADA':'SALIDA'}</span></td><td>${fmt(m.quantity)}</td><td>${esc(m.document_number||'—')}</td><td>${esc(m.supplier||m.destination||'—')}</td><td>${esc(m.notes||'—')}</td></tr>`).join('');
    $('#content').innerHTML=`<div class="panel"><div class="panel-head"><div><h2>${esc(item.code)} · ${esc(item.name)}</h2><div class="sub">Historial de movimientos del bien de control · Stock actual: <b>${fmt(item.current_stock)}</b></div></div><button class="btn btn-secondary" id="p2-back-dashboard">← Volver a Gestión</button></div><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Documento</th><th>Proveedor / Destino</th><th>Notas</th></tr></thead><tbody>${rows||'<tr><td colspan="6">No hay movimientos en los últimos 90 días.</td></tr>'}</tbody></table></div></div>`;
    $('#p2-back-dashboard').onclick=paintDashboard;
  }
  function topItems(out){const m={};out.forEach(x=>{const k=x.item_id;if(!m[k])m[k]={code:x.items?.code||'',name:x.items?.name||'',category:categoryName(x.items?.category_id),qty:0};m[k].qty+=Number(x.quantity||0)});return Object.values(m).sort((a,b)=>b.qty-a.qty).slice(0,15);}
  function exportCSV(){
    const items=state.items||[], mov=dashboardData?.movements||[];const rows=[['Código','Bien','Categoría','Tipo de control','Stock','Mínimo','Estado','Consumo operativo 30d']];const since=Date.now()-30*86400000;items.forEach(i=>{const q=controlType(i.category_id)==='CONSUMO'?mov.filter(m=>m.item_id===i.id&&m.movement_type==='EXIT'&&new Date(m.movement_date).getTime()>=since&&!isExcludedOperational(m)).reduce((a,m)=>a+Number(m.quantity||0),0):0;rows.push([i.code,i.name,categoryName(i.category_id),controlType(i.category_id),i.current_stock,i.minimum_stock,controlType(i.category_id)==='CONSUMO'?i.stock_status:'CONTROL',q])});const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='QUIMFLUX_gestion_inventario.csv';a.click();URL.revokeObjectURL(a.href);
  }
  wait();
})();
