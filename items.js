/* QUIMFLUX Inventario - edición de artículos
   El stock actual NO se edita aquí. Solo se modifica mediante Entradas/Salidas.
*/
(function(){
  const escLocal = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let lastBody = null;
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
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary';
      button.style.cssText = 'padding:7px 10px;font-size:12px;white-space:nowrap';
      button.textContent = '✏ Editar';
      button.setAttribute('data-edit-item','1');
      button.addEventListener('click', () => editItem(item));
      td.appendChild(button);
      row.appendChild(td);
    });

    lastBody = body;
  }

  function editItem(item){
    const categories = state.categories || [];
    document.querySelector('#modal-content').innerHTML = `
      <h2>Editar artículo</h2>
      <p class="modal-sub">Corrige los datos del artículo. El stock actual no se modifica desde aquí.</p>
      <form id="edit-item-form">
        <div class="form-grid">
          <div class="field">
            <label>Código *</label>
            <input class="form-control" name="code" value="${escLocal(item.code)}" required>
          </div>
          <div class="field">
            <label>Categoría *</label>
            <select class="form-control" name="category_id" required>
              ${categories.map(c => `<option value="${escLocal(c.id)}" ${c.id===item.category_id?'selected':''}>${escLocal(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Nombre *</label>
            <input class="form-control" name="name" value="${escLocal(item.name)}" required>
          </div>
          <div class="field">
            <label>Unidad</label>
            <input class="form-control" name="unit" value="${escLocal(item.unit || 'UND')}">
          </div>
          <div class="field">
            <label>Stock actual</label>
            <input class="form-control" value="${escLocal(item.current_stock)} ${escLocal(item.unit || '')}" disabled>
          </div>
          <div class="field">
            <label>Stock mínimo</label>
            <input class="form-control" name="minimum" type="number" min="0" step="0.001" value="${escLocal(item.minimum_stock)}" required>
          </div>
          <div class="field full">
            <label>Descripción</label>
            <textarea class="form-control" name="description" rows="3">${escLocal(item.description || '')}</textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="edit-cancel">Cancelar</button>
          <button class="btn btn-primary">Guardar cambios</button>
        </div>
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

    const { error } = await sb.from('items').update({
      code,
      category_id: f.get('category_id'),
      name,
      unit: unit || 'UND',
      minimum_stock: minimum,
      description: String(f.get('description') || '').trim() || null
    }).eq('id', item.id);

    if (error) { toast(error.message, true); return; }
    closeModal();
    await load();
    view();
    toast('Artículo actualizado correctamente');
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
