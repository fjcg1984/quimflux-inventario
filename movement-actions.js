(function(){
  let observerStarted=false;
  const wait=setInterval(()=>{
    const content=document.querySelector('#content');
    if(!content)return;
    clearInterval(wait);
    if(observerStarted)return;
    observerStarted=true;
    const observer=new MutationObserver(()=>enhance());
    observer.observe(content,{childList:true,subtree:true});
    enhance();
  },100);

  function enhance(){
    const path=location.pathname;
    enhanceMovementForm();
    enhanceHistory();
  }

  function enhanceMovementForm(){
    const form=document.querySelector('#movement-form');
    if(!form || form.dataset.enhanced)return;
    form.dataset.enhanced='1';
    const select=form.querySelector('select[name="item_id"]');
    if(!select)return;
    const field=select.closest('.field');
    if(!field)return;
    const label=field.querySelector('label');
    const search=document.createElement('input');
    search.className='form-control movement-search';
    search.placeholder='🔎 Buscar por código o nombre...';
    search.style.marginBottom='8px';
    field.insertBefore(search,select);
    const options=[...select.options].map(o=>({value:o.value,text:o.textContent,search:o.textContent.toLowerCase()}));
    search.addEventListener('input',()=>{
      const q=search.value.trim().toLowerCase();
      const current=select.value;
      select.innerHTML='';
      options.filter(o=>!q || o.search.includes(q)).forEach(o=>{
        const opt=document.createElement('option'); opt.value=o.value; opt.textContent=o.text; select.appendChild(opt);
      });
      if(current && [...select.options].some(o=>o.value===current))select.value=current;
    });
  }

  function enhanceHistory(){
    const panel=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.includes('Historial de movimientos'));
    if(!panel || panel.dataset.enhanced)return;
    panel.dataset.enhanced='1';
    const head=panel.querySelector('.panel-head');
    if(head){
      const input=document.createElement('input');
      input.className='control movement-history-search';
      input.placeholder='🔎 Buscar movimiento...';
      input.style.maxWidth='320px';
      head.appendChild(input);
      input.addEventListener('input',()=>filterHistory(input.value));
    }
    const table=panel.querySelector('table');
    if(!table)return;
    const th=document.createElement('th'); th.textContent='Acciones'; table.querySelector('thead tr').appendChild(th);
    [...table.querySelectorAll('tbody tr')].forEach(row=>addAction(row));
  }

  function addAction(row){
    if(row.dataset.actionEnhanced)return;
    const cells=row.querySelectorAll('td');
    if(cells.length<6)return;
    const code=cells[2]?.textContent.trim();
    const itemName=cells[3]?.textContent.trim();
    const date=cells[0]?.textContent.trim();
    const type=cells[1]?.textContent.includes('ENTRADA')?'ENTRY':'EXIT';
    const movement=state.movements.find(m=>m.id && m.items?.code===code && m.items?.name===itemName && new Date(m.movement_date).toLocaleString('es-PE')===date) || state.movements.find(m=>m.id && m.items?.code===code && m.movement_type===type);
    if(!movement)return;
    row.dataset.actionEnhanced='1';
    row.dataset.searchText=row.textContent.toLowerCase();
    const td=document.createElement('td');
    td.innerHTML='<div class="movement-actions"><button type="button" class="btn btn-secondary btn-sm js-edit-movement">✏ Editar</button> <button type="button" class="btn btn-danger btn-sm js-delete-movement">🗑 Eliminar</button></div>';
    row.appendChild(td);
    td.querySelector('.js-edit-movement').onclick=()=>editMovement(movement);
    td.querySelector('.js-delete-movement').onclick=()=>deleteMovement(movement);
  }

  function filterHistory(q){
    const panel=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.includes('Historial de movimientos'));
    if(!panel)return;
    const query=q.trim().toLowerCase();
    panel.querySelectorAll('tbody tr').forEach(row=>{
      if(row.querySelector('.empty'))return;
      row.style.display=!query || (row.dataset.searchText||row.textContent.toLowerCase()).includes(query)?'':'none';
    });
  }

  function editMovement(m){
    const item=state.items.find(i=>i.id===m.item_id);
    if(!item){toast('No se encontró el artículo del movimiento',true);return;}
    const dt=new Date(m.movement_date); const local=new Date(dt.getTime()-dt.getTimezoneOffset()*60000).toISOString().slice(0,16);
    const detail=m.movement_type==='ENTRY'
      ? `<div class="field"><label>Proveedor</label><input class="form-control" name="supplier" value="${esc(m.supplier||'')}"></div><div class="field"><label>Documento</label><input class="form-control" name="document" value="${esc(m.document_number||'')}"></div>`
      : `<div class="field"><label>Destino</label><input class="form-control" name="destination" value="${esc(m.destination||'')}"></div><div class="field"><label>Responsable</label><input class="form-control" name="responsible" value="${esc(m.responsible||'')}"></div>`;
    $('#modal-content').innerHTML=`<h2>Editar ${m.movement_type==='ENTRY'?'entrada':'salida'}</h2><p class="modal-sub">Puedes corregir la cantidad y los datos del movimiento. El stock se recalcula automáticamente.</p><form id="edit-movement-form"><div class="form-grid"><div class="field full"><label>Artículo</label><input class="form-control" value="${esc(m.items?.code||item.code)} — ${esc(m.items?.name||item.name)}" disabled></div><div class="field"><label>Cantidad *</label><input class="form-control" name="quantity" type="number" min="0.001" step="0.001" value="${Number(m.quantity)}" required></div><div class="field"><label>Fecha</label><input class="form-control" name="date" type="datetime-local" value="${local}"></div>${detail}<div class="field full"><label>Observación</label><textarea class="form-control" name="notes" rows="3">${esc(m.notes||'')}</textarea></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" id="cancel-edit-movement">Cancelar</button><button class="btn btn-primary">Guardar cambios</button></div></form>`;
    openModal();
    $('#cancel-edit-movement').onclick=closeModal;
    $('#edit-movement-form').onsubmit=async e=>{
      e.preventDefault();
      const f=new FormData(e.target),qty=Number(f.get('quantity'));
      if(!Number.isFinite(qty)||qty<=0){toast('La cantidad debe ser mayor que cero',true);return;}
      if(m.movement_type==='EXIT' && qty>Number(item.current_stock)+Number(m.quantity)){toast(`Stock insuficiente para la nueva salida. Disponible máximo: ${fmt(Number(item.current_stock)+Number(m.quantity))} ${item.unit}`,true);return;}
      const patch={quantity:qty,movement_date:new Date(f.get('date')).toISOString(),notes:f.get('notes')||null};
      if(m.movement_type==='ENTRY'){patch.supplier=f.get('supplier')||null;patch.document_number=f.get('document')||null;}
      else{patch.destination=f.get('destination')||null;patch.responsible=f.get('responsible')||null;}
      const {error}=await sb.from('movements').update(patch).eq('id',m.id);
      if(error){toast(error.message,true);return;}
      closeModal();await load();view();toast('Movimiento actualizado correctamente');
    };
  }

  async function deleteMovement(m){
    const labelType=m.movement_type==='ENTRY'?'entrada':'salida';
    if(!confirm(`¿Eliminar esta ${labelType} de ${fmt(m.quantity)} unidades de ${m.items?.code||''}?\n\nEl stock será recalculado automáticamente.`))return;
    const {error}=await sb.from('movements').delete().eq('id',m.id);
    if(error){toast(error.message,true);return;}
    await load();view();toast('Movimiento eliminado y stock recalculado');
  }
})();
