/* QUIMFLUX Inventario - Fase 1 Control: perfiles, ficha, ubicacion y auditoria */
(function(){
  let role='READONLY';
  const $q=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel={ADMIN:'Administrador',WAREHOUSE:'Almacén',SUPERVISOR:'Supervisor',READONLY:'Solo lectura'};
  async function boot(){
    if(typeof sb==='undefined'||!state.session?.user?.id)return;
    const {data}=await sb.from('profiles').select('role,full_name').eq('id',state.session.user.id).maybeSingle();
    role=data?.role||'READONLY';
    const pill=document.querySelector('.user-pill small'); if(pill)pill.textContent=roleLabel[role]||'QUIMFLUX';
    if(role==='ADMIN') addControlNav();
    enhanceOverview();
  }
  function addControlNav(){
    const nav=$q('#nav'); if(!nav||nav.querySelector('[data-view="control"]'))return;
    const b=document.createElement('button'); b.className='nav-item'; b.dataset.view='control'; b.innerHTML='⚙ <span>Control</span>'; nav.appendChild(b);
  }
  function enhanceOverview(){
    if(typeof state==='undefined'||state.view!=='overview')return;
    const table=$q('#body')?.closest('table'); const head=table?.querySelector('thead tr'); const body=table?.querySelector('tbody');
    if(!table||!head||!body)return;
    if(!head.querySelector('[data-phase1]')){const th=document.createElement('th');th.textContent='Ficha';th.dataset.phase1='1';head.appendChild(th);}
    body.querySelectorAll('tr').forEach(row=>{if(row.querySelector('.empty')||row.querySelector('[data-item-card]'))return;const code=row.querySelector('td:first-child b')?.textContent?.trim();const item=(state.items||[]).find(i=>i.code===code);if(!item)return;const td=document.createElement('td');td.dataset.itemCard='1';const btn=document.createElement('button');btn.className='btn btn-secondary';btn.textContent='Ver ficha';btn.onclick=()=>showItem(item);td.appendChild(btn);row.appendChild(td);});
  }
  async function showItem(item){
    const [{data:movs},{data:audit}]=await Promise.all([
      sb.from('movements').select('*').eq('item_id',item.id).order('movement_date',{ascending:false}).limit(100),
      sb.from('audit_logs').select('action,table_name,old_data,new_data,created_at,user_id').eq('record_id',item.id).order('created_at',{ascending:false}).limit(50)
    ]);
    const lastEntry=(movs||[]).find(m=>m.movement_type==='ENTRY'); const lastExit=(movs||[]).find(m=>m.movement_type==='EXIT');
    const canLocate=['ADMIN','SUPERVISOR'].includes(role);
    $('#modal-content').innerHTML=`<h2>Ficha del artículo</h2><p class="modal-sub">Trazabilidad y ubicación del bien.</p><div class="cards"><div class="card"><div class="label">Código</div><div class="value" style="font-size:20px">${esc(item.code)}</div></div><div class="card"><div class="label">Stock</div><div class="value" style="font-size:20px">${esc(item.current_stock)} ${esc(item.unit)}</div></div><div class="card"><div class="label">Estado</div><div class="value" style="font-size:20px">${esc(item.stock_status)}</div></div></div><div class="panel"><div class="panel-head"><h2>${esc(item.name)}</h2><span class="badge">${esc(item.category_name||item.category_code||'')}</span></div><div class="form-grid"><div><b>Descripción</b><div>${esc(item.description||'—')}</div></div><div><b>Stock mínimo</b><div>${esc(item.minimum_stock)}</div></div><div><b>Última entrada</b><div>${lastEntry?esc(limaDisplay(lastEntry.movement_date)):'—'}</div></div><div><b>Última salida</b><div>${lastExit?esc(limaDisplay(lastExit.movement_date)):'—'}</div></div><div><b>Proveedor reciente</b><div>${esc(lastEntry?.supplier||'—')}</div></div><div><b>Documento reciente</b><div>${esc(lastEntry?.document_number||'—')}</div></div></div></div><div class="panel"><div class="panel-head"><h2>Ubicación física</h2></div><form id="location-form"><div class="form-grid"><div class="field"><label>Almacén</label><input class="form-control" name="warehouse" value="${esc(item.warehouse||'')}" ${canLocate?'':'disabled'}></div><div class="field"><label>Zona</label><input class="form-control" name="zone" value="${esc(item.zone||'')}" ${canLocate?'':'disabled'}></div><div class="field"><label>Estante</label><input class="form-control" name="shelf" value="${esc(item.shelf||'')}" ${canLocate?'':'disabled'}></div><div class="field"><label>Nivel</label><input class="form-control" name="level" value="${esc(item.level||'')}" ${canLocate?'':'disabled'}></div></div>${canLocate?'<div class="form-actions"><button class="btn btn-primary">Guardar ubicación</button></div>':''}</form></div><div class="panel"><div class="panel-head"><h2>Historial</h2><span class="sub">${(movs||[]).length} movimientos · ${(audit||[]).length} registros auditados</span></div><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Documento</th><th>Detalle</th></tr></thead><tbody>${(movs||[]).slice(0,50).map(m=>`<tr><td>${esc(limaDisplay(m.movement_date))}</td><td>${m.movement_type==='ENTRY'?'ENTRADA':'SALIDA'}</td><td>${esc(m.quantity)}</td><td>${esc(m.document_number||'—')}</td><td>${esc(m.notes||m.supplier||m.destination||'—')}</td></tr>`).join('')||'<tr><td colspan="5">Sin movimientos</td></tr>'}</tbody></table></div></div>`;
    openModal();
    const lf=$q('#location-form'); if(lf&&canLocate)lf.onsubmit=async e=>{e.preventDefault();const f=new FormData(lf);const {error}=await sb.from('items').update({warehouse:String(f.get('warehouse')||'').trim()||null,zone:String(f.get('zone')||'').trim()||null,shelf:String(f.get('shelf')||'').trim()||null,level:String(f.get('level')||'').trim()||null}).eq('id',item.id);if(error){toast(error.message,true);return;}item.warehouse=f.get('warehouse');item.zone=f.get('zone');item.shelf=f.get('shelf');item.level=f.get('level');toast('Ubicación actualizada');};
  }
  async function controlView(){
    $('#content').innerHTML='<div class="panel"><div class="panel-head"><div><h2>Control de usuarios y auditoría</h2><div class="sub">Administración de perfiles y trazabilidad.</div></div></div><div id="control-content">Cargando...</div></div>';
    const [{data:profiles},{data:audit}]=await Promise.all([sb.from('profiles').select('id,full_name,role,active,created_at').order('created_at'),sb.from('audit_logs').select('id,action,table_name,record_id,created_at,user_id').order('created_at',{ascending:false}).limit(100)]);
    const cc=$q('#control-content'); cc.innerHTML=`<h3>Usuarios</h3><div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Activo</th><th>Alta</th></tr></thead><tbody>${(profiles||[]).map(p=>`<tr><td>${esc(p.full_name||p.id)}</td><td><select class="control role-select" data-id="${esc(p.id)}" ${p.id===state.session.user.id?'disabled':''}>${Object.entries(roleLabel).map(([v,l])=>`<option value="${v}" ${p.role===v?'selected':''}>${l}</option>`).join('')}</select></td><td>${p.active?'Sí':'No'}</td><td>${esc(limaDisplay(p.created_at))}</td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:28px">Auditoría reciente</h3><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Tabla</th><th>Registro</th></tr></thead><tbody>${(audit||[]).map(a=>`<tr><td>${esc(limaDisplay(a.created_at))}</td><td>${esc(a.action)}</td><td>${esc(a.table_name)}</td><td>${esc(a.record_id||'—')}</td></tr>`).join('')||'<tr><td colspan="4">Sin registros</td></tr>'}</tbody></table></div>`;
    cc.querySelectorAll('.role-select').forEach(s=>s.onchange=async()=>{const {error}=await sb.from('profiles').update({role:s.value,updated_at:new Date().toISOString()}).eq('id',s.dataset.id);if(error){toast(error.message,true);return;}toast('Rol actualizado');});
  }
  const wait=setInterval(()=>{if(typeof state==='undefined'||!state.session)return;if(!$q('#content'))return;clearInterval(wait);boot();},200);
  const obs=new MutationObserver(()=>{if(state?.view==='overview')enhanceOverview();});
  setTimeout(()=>{const c=$q('#content');if(c)obs.observe(c,{childList:true,subtree:true});},500);
  window.quimfluxPhase1={controlView};
})();