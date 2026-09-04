/* QUIMFLUX Inventario - edición de artículos y corrección trazable de stock */
(function(){
  const escLocal = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let observer = null;

  function addEditActions(){
    if (typeof state === 'undefined' || state.view !== 'overview') return;
    const body = document.querySelector('#body');
    const table = body?.closest('table');
    if (!body || !table) return;

    const headRow = table.querySelector('thead tr');
    if (headRow && !headRow.querySelector('[data-edit-head]')) {
      const th = document.createElement('th');
      th.textContent = 'Acciones';
      th.setAttribute('data-edit-head','1');
      headRow.appendChild(th);
    }

    [...body.querySelectorAll('tr')].forEach(row => {
      if (row.querySelector('[data-edit-item]')) return;
      const code = row.querySelector('td:first-child b')?.textContent?.trim();
      const item = (state.items || []).find(i => i.code === code);
      if (!item || row.querySelector('.empty')) return;
      const td = document.createElement('td');
      td.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'btn btn-secondary';
      editButton.style.cssText = 'padding:7px 10px;font-size:12px;white-space:nowrap';
      editButton.textContent = '✏ Editar';
      editButton.setAttribute('data-edit-item','1');
      editButton.addEventListener('click', () => editItem(item));

      const stockButton = document.createElement('button');
      stockButton.type = 'button';
      stockButton.className = 'btn btn-secondary';
      stockButton.style.cssText = 'padding:7px 10px;font-size:12px;white-space:nowrap';
      stockButton.textContent = '⚖ Corregir stock';
      stockButton.setAttribute('data-correct-stock','1');
      stockButton.addEventListener('click', () => correctStock(item));

      td.appendChild(editButton);
      td.appendChild(stockButton);
      row.appendChild(td);
    });
  }

  function editItem(item){
    const categories = state.categories || [];
    document.querySelector('#modal-content').innerHTML = `
      <h2>Editar artículo</h2>
      <p class="modal-sub">Corrige los datos del artículo. El stock actual se corrige mediante un ajuste trazable.</p>
      <form id="edit-item-form">
        <div class="form-grid">
          <div class="field"><label>Código *</label><input class="form-control" name="code" value="${escLocal(item.code)}" required></div>
          <div class="field"><label>Categoría *</label><select class="form-control" name="category_id" required>${categories.map(c => `<option value="${escLocal(c.id)}" ${c.id===item.category_id?'selected':''}>${escLocal(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Nombre *</label><input class="form-control" name="name" value="${escLocal(item.name)}" required></div>
          <div class="field"><label>Unidad</label><input class="form-control" name="unit" value="${escLocal(item.unit || 'UND')}"></div>
          <div class="field"><label>Stock actual</label><input class="form-control" value="${escLocal(item.current_stock)} ${escLocal(item.unit || '')}" disabled></div>
          <div class="field"><label>Stock mínimo</label><input class="form-control" name="minimum" type="number" min="0" step="0.001" value="${escLocal(item.minimum_stock)}" required></div>
          <div class="field full"><label>Descripción</label><textarea class="form-control" name="description" rows="3">${escLocal(item.description || '')}</textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn btn-secondary" id="edit-cancel">Cancelar</button><button class="btn btn-primary">Guardar cambios</button></div>
      </form>`;
    openModal();
    document.querySelector('#edit-cancel').onclick = closeModal;
    document.querySelector('#edit-item-form').onsubmit = e => saveEdit(e, item);
  }

  async function saveEdit(e, item){
    e.preventDefault();
    const f = new FormData(e.target);
    const code = String(f.get('code') || '').trim().toUpperCase();
    const name = String(f.get('name') || '').trim();
    const unit = String(f.get('unit') || 'UND').trim().toUpperCase();
    const minimum = Number(f.get('minimum'));
    if (!code || !name || !f.get('category_id')) { toast('Completa los campos obligatorios.', true); return; }
    if (!Number.isFinite(minimum) || minimum < 0) { toast('El stock mínimo debe ser un número igual o mayor que 0.', true); return; }

    const { error } = await sb.from('items').update({code,category_id:f.get('category_id'),name,unit:unit || 'UND',minimum_stock:minimum,description:String(f.get('description') || '').trim() || null}).eq('id', item.id);
    if (error) { toast(error.message, true); return; }
    closeModal(); await load(); view(); toast('Artículo actualizado correctamente');
  }

  function correctStock(item){
    document.querySelector('#modal-content').innerHTML = `
      <h2>Corregir stock</h2>
      <p class="modal-sub">No se sobrescribe el stock. Se registra un ajuste para conservar la trazabilidad.</p>
      <div class="card" style="margin:12px 0;padding:14px">
        <div class="label">Artículo</div><div style="font-weight:700">${escLocal(item.code)} — ${escLocal(item.name)}</div>
        <div class="sub" style="margin-top:5px">Stock actual: <b>${escLocal(item.current_stock)} ${escLocal(item.unit || '')}</b></div>
      </div>
      <form id="correct-stock-form">
        <div class="form-grid">
          <div class="field"><label>Stock correcto *</label><input class="form-control" name="target" type="number" min="0" step="0.001" value="${escLocal(item.current_stock)}" required></div>
          <div class="field full"><label>Motivo de la corrección *</label><textarea class="form-control" name="reason" rows="3" placeholder="Ej.: Corrección de stock inicial digitado incorrectamente" required></textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn btn-secondary" id="correct-cancel">Cancelar</button><button class="btn btn-primary">Registrar corrección</button></div>
      </form>`;
    openModal();
    document.querySelector('#correct-cancel').onclick = closeModal;
    document.querySelector('#correct-stock-form').onsubmit = e => saveStockCorrection(e, item);
  }

  async function saveStockCorrection(e, item){
    e.preventDefault();
    const f = new FormData(e.target);
    const target = Number(f.get('target'));
    const reason = String(f.get('reason') || '').trim();
    const current = Number(item.current_stock || 0);
    if (!Number.isFinite(target) || target < 0) { toast('El stock correcto no puede ser negativo.', true); return; }
    if (!reason) { toast('Debes indicar el motivo de la corrección.', true); return; }
    const diff = Number((target - current).toFixed(3));
    if (diff === 0) { toast('El stock correcto es igual al stock actual. No hay nada que ajustar.', true); return; }

    const movementType = diff > 0 ? 'ENTRY' : 'EXIT';
    const qty = Math.abs(diff);
    const notes = `AJUSTE DE INVENTARIO | Stock anterior: ${current} | Stock corregido: ${target} | Motivo: ${reason}`;
    const payload = {item_id:item.id,movement_type:movementType,quantity:qty,movement_date:new Date().toISOString(),notes};
    const { error } = await sb.from('movements').insert(payload);
    if (error) { toast(error.message, true); return; }
    closeModal();
    await load();
    view();
    toast(`Stock corregido: ${current} → ${target} ${item.unit || ''}`);
  }

  function start(){
    if (observer) observer.disconnect();
    observer = new MutationObserver(addEditActions);
    observer.observe(document.body, {childList:true, subtree:true});
    addEditActions();
  }

  const boot = setInterval(() => {
    if (document.querySelector('#app')) { clearInterval(boot); start(); }
  }, 200);
})();
