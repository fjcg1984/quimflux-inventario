/* QUIMFLUX Inventario - Vista general 2.0 y ficha completa */
(function(){
  let running=false;
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmtLocal=n=>Number(n||0).toLocaleString('es-PE',{maximumFractionDigits:3});
  const statusLabel=s=>({SUFFICIENT:'Suficiente',LOW:'Stock bajo',CRITICAL:'Reponer'}[s]||s||'—');
  const statusClass=s=>({SUFFICIENT:'ok',LOW:'low',CRITICAL:'critical'}[s]||'ok');
  const normalize=v=>String(v??'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const categoryName=id=>(state.categories||[]).find(c=>String(c.id)===String(id))?.name||'';
  const locationText=i=>[i.warehouse,i.zone,i.shelf,i.level].filter(Boolean).join(' / ')||'Sin ubicación';
  const displayDate=iso=>iso?new Date(iso).toLocaleString('es-PE',{timeZone:'America/Lima'}):'—';

  async function enrichLocations(){
    if(!state.items?.length)return;
    const ids=state.items.map(i=>i.id).filter(Boolean);
    const {data,error}=await sb.from('items').select('id,warehouse,zone,shelf,level,created_at,updated_at').in('id',ids);
    if(error||!data)return;
    const map=new Map(data.map(x=>[x.id,x]));
    state.items.forEach(i=>Object.assign(i,map.get(i.id)||{}));
  }

  function enhance(){
    if(running||state?.view!=='overview')return;
    const table=document.querySelector('#body')?.closest('table');
    const body=document.querySelector('#body');
    if(!table||!body||table.dataset.vista20Rendered==='1')return;
    running=true;
    enrichLocations().then(()=>{
      if(state.view!=='overview'){running=false;return;}
      if(table.dataset.vista20Rendered==='1'){running=false;return;}
      table.dataset.vista20Rendered='1';
      renderOverview(table,body);
      running=false;
    }).catch(err=>{
      console.error('[QUIMFLUX vista]',err);
      running=false;
    });
  }

  function renderOverview(table,body){
    const oldToolbar=document.querySelector('.toolbar');
    let loc=document.querySelector('#loc-filter');
    if(oldToolbar&&!loc){
      loc=document.createElement('select');
      loc.id='loc-filter';
      loc.className='control';
      oldToolbar.insertBefore(loc,oldToolbar.querySelector('#new')||null);
    }

    // La ubicación se construye con los datos reales disponibles para que el filtro
    // pueda seleccionar una ubicación concreta, además de con/sin ubicación.
    if(loc){
      const locations=[...new Set((state.items||[]).map(locationText))].sort((a,b)=>a.localeCompare(b,'es'));
      loc.innerHTML='<option value="">Todas las ubicaciones</option><option value="__located__">Con ubicación</option><option value="__unlocated__">Sin ubicación</option>'+locations.filter(x=>x!=='Sin ubicación').map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    }

    const head=table.querySelector('thead tr');
    head.innerHTML='<th>Código</th><th>Categoría</th><th>Bien</th><th>Descripción</th><th>Ubicación</th><th>Unidad</th><th>Stock</th><th>Mínimo</th><th>Estado</th><th>Ficha</th>';
    body.innerHTML='';

    function paint(){
      const q=(document.querySelector('#q')?.value||'').trim().toLowerCase();
      const cat=document.querySelector('#cat')?.value||'';
      const st=document.querySelector('#st')?.value||'';
      const lf=document.querySelector('#loc-filter')?.value||'';
      const selectedCategory=(state.categories||[]).find(c=>String(c.id)===String(cat));
      const selectedCategoryName=normalize(selectedCategory?.name);
      const selectedCategoryCode=normalize(selectedCategory?.code);

      const rows=state.items.filter(i=>{
        const text=`${i.code||''} ${i.name||''} ${i.description||''} ${i.category_name||''} ${i.category_code||''} ${locationText(i)}`.toLowerCase();
        const itemCategoryId=String(i.category_id||'');
        const itemCategoryName=normalize(i.category_name||categoryName(i.category_id));
        const itemCategoryCode=normalize(i.category_code||'');
        const categoryMatches=!cat ||
          itemCategoryId===String(cat) ||
          (selectedCategoryName && itemCategoryName===selectedCategoryName) ||
          (selectedCategoryCode && itemCategoryCode===selectedCategoryCode);
        const located=!!(i.warehouse||i.zone||i.shelf||i.level);
        const location=locationText(i);
        const locationMatches=!lf ||
          (lf==='__located__'&&located) ||
          (lf==='__unlocated__'&&!located) ||
          (lf!=='__located__'&&lf!=='__unlocated__'&&location===lf);
        return (!q||text.includes(q))&&categoryMatches&&(!st||String(i.stock_status||'')===String(st))&&locationMatches;
      });

      const count=document.querySelector('#count');
      if(count)count.textContent=`${rows.length} artículo${rows.length===1?'':'s'}`;
      body.innerHTML=rows.length?rows.map(i=>{
        const locText=locationText(i);
        return `<tr><td><b>${esc(i.code)}</b></td><td>${esc(i.category_name||categoryName(i.category_id)||'—')}</td><td><b>${esc(i.name)}</b></td><td data-description-cell="1">${esc(i.description||'—')}</td><td><span class="sub">${esc(locText)}</span></td><td>${esc(i.unit||'UND')}</td><td><b>${fmtLocal(i.current_stock)}</b></td><td>${fmtLocal(i.minimum_stock)}</td><td><span class="badge ${statusClass(i.stock_status)}">${statusLabel(i.stock_status)}</span></td><td><button type="button" class="btn btn-secondary btn-sm js-vista-ficha">Ver ficha</button></td></tr>`;
      }).join(''):`<tr><td colspan="10"><div class="empty"><strong>No hay resultados</strong>Ajusta los filtros de búsqueda.</div></td></tr>`;

      body.querySelectorAll('.js-vista-ficha').forEach(btn=>{
        const code=btn.closest('tr')?.querySelector('td:first-child b')?.textContent.trim();
        const item=state.items.find(i=>i.code===code);
        if(item)btn.onclick=()=>showFullItem(item);
      });
    }

    // Sustituimos los handlers del render original de app.js. Antes solo loc-filter
    // llamaba a este paint; q/cat/st seguían ejecutando el paint antiguo y devolvían
    // la tabla a su estado anterior. Con estos handlers los cuatro filtros comparten
    // exactamente la misma fuente de datos y pueden combinarse.
    const qEl=document.querySelector('#q');
    const catEl=document.querySelector('#cat');
    const stEl=document.querySelector('#st');
    if(qEl){qEl.oninput=paint;qEl.onchange=paint;}
    if(catEl){catEl.onchange=paint;catEl.oninput=paint;}
    if(stEl){stEl.onchange=paint;stEl.oninput=paint;}
    if(loc){loc.onchange=paint;loc.oninput=paint;}

    paint();
  }

  async function showFullItem(item){
    const {data:movs,error}=await sb.from('movements').select('*').eq('item_id',item.id).order('movement_date',{ascending:false}).limit(100);
    if(error){toast(error.message,true);return;}
    const movements=movs||[];
    const lastEntry=movements.find(m=>m.movement_type==='ENTRY');
    const lastExit=movements.find(m=>m.movement_type==='EXIT');
    $('#modal-content').innerHTML=`<h2>Ficha completa del artículo</h2><p class="modal-sub">Consulta integral del bien. El stock se muestra desde el inventario y no se modifica desde esta ficha.</p>
      <div class="cards"><div class="card"><div class="label">Código</div><div class="value" style="font-size:20px">${esc(item.code)}</div></div><div class="card"><div class="label">Stock actual</div><div class="value" style="font-size:20px">${fmtLocal(item.current_stock)} ${esc(item.unit)}</div></div><div class="card"><div class="label">Estado</div><div class="value" style="font-size:18px"><span class="badge ${statusClass(item.stock_status)}">${statusLabel(item.stock_status)}</span></div></div></div>
      <div class="panel"><div class="panel-head"><h2>${esc(item.name)}</h2><span class="badge">${esc(item.category_name||categoryName(item.category_id)||'')}</span></div><div class="form-grid">
        <div><b>Descripción</b><div>${esc(item.description||'—')}</div></div><div><b>Unidad</b><div>${esc(item.unit||'—')}</div></div><div><b>Stock mínimo</b><div>${fmtLocal(item.minimum_stock)}</div></div><div><b>Fecha de creación</b><div>${displayDate(item.created_at)}</div></div>
        <div><b>Última entrada</b><div>${lastEntry?displayDate(lastEntry.movement_date):'—'}</div></div><div><b>Proveedor / documento</b><div>${esc([lastEntry?.supplier,lastEntry?.document_number].filter(Boolean).join(' · ')||'—')}</div></div>
        <div><b>Última salida</b><div>${lastExit?displayDate(lastExit.movement_date):'—'}</div></div><div><b>Destino / responsable</b><div>${esc([lastExit?.destination,lastExit?.responsible].filter(Boolean).join(' · ')||'—')}</div></div>
      </div></div>
      <div class="panel"><div class="panel-head"><h2>Ubicación física</h2><span class="sub">${esc(locationText(item))}</span></div><form id="vista20-location"><div class="form-grid"><div class="field"><label>Almacén</label><input class="form-control" name="warehouse" value="${esc(item.warehouse||'')}"></div><div class="field"><label>Zona</label><input class="form-control" name="zone" value="${esc(item.zone||'')}"></div><div class="field"><label>Estante</label><input class="form-control" name="shelf" value="${esc(item.shelf||'')}"></div><div class="field"><label>Nivel</label><input class="form-control" name="level" value="${esc(item.level||'')}"></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Guardar ubicación</button></div></form></div>
      <div class="panel"><div class="panel-head"><h2>Historial reciente</h2><span class="sub">${movements.length} movimientos</span></div><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Documento</th><th>Proveedor / destino</th><th>Responsable</th><th>Observación</th></tr></thead><tbody>${movements.slice(0,50).map(m=>`<tr><td>${esc(displayDate(m.movement_date))}</td><td>${m.movement_type==='ENTRY'?'ENTRADA':'SALIDA'}</td><td>${fmtLocal(m.quantity)}</td><td>${esc(m.document_number||'—')}</td><td>${esc(m.movement_type==='ENTRY'?(m.supplier||'—'):(m.destination||'—'))}</td><td>${esc(m.responsible||'—')}</td><td>${esc(m.notes||'—')}</td></tr>`).join('')||'<tr><td colspan="7">Sin movimientos</td></tr>'}</tbody></table></div></div>`;
    openModal();
    const form=document.querySelector('#vista20-location');
    form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);const patch={warehouse:String(f.get('warehouse')||'').trim()||null,zone:String(f.get('zone')||'').trim()||null,shelf:String(f.get('shelf')||'').trim()||null,level:String(f.get('level')||'').trim()||null};const {error}=await sb.from('items').update(patch).eq('id',item.id);if(error){toast(error.message,true);return;}Object.assign(item,patch);toast('Ubicación actualizada');};
  }

  const wait=setInterval(()=>{if(typeof state==='undefined'||!state.session||!document.querySelector('#content'))return;clearInterval(wait);new MutationObserver(enhance).observe(document.querySelector('#content'),{childList:true,subtree:true});enhance();},200);
})();
