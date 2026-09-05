(() => {
  const wait = setInterval(() => {
    const nav = document.querySelector('#nav');
    if (!nav) return;
    clearInterval(wait);
    if (nav.querySelector('[data-view="categories"]')) return;
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.view = 'categories';
    btn.innerHTML = '⚙ <span>Categorías</span>';
    nav.appendChild(btn);

    nav.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-view="categories"]');
      if (!b) return;
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === b));
      const title = document.querySelector('#page-title');
      if (title) title.textContent = 'Categorías';
      await renderCategories();
      const side = document.querySelector('.sidebar');
      if (side) side.classList.remove('open');
    });
  }, 50);

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const toast = (msg, error=false) => {
    const el = document.querySelector('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show', error ? 'error' : '');
    setTimeout(() => el.classList.remove('show','error'), 2800);
  };

  async function renderCategories() {
    const content = document.querySelector('#content');
    if (!content) return;
    const { data, error } = await sb.from('categories').select('*').order('name');
    if (error) { toast(error.message, true); return; }
    const rows = data || [];
    content.innerHTML = `
      <div class="toolbar">
        <div class="search"><input id="cat-search" placeholder="Buscar por código o nombre..."></div>
        <button class="btn btn-primary" id="cat-new">＋ Nueva categoría</button>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Catálogo de categorías</h2><div class="sub">Define si cada categoría participa en consumo y reposición o solo en control de movimientos.</div></div><span class="sub" id="cat-count"></span></div>
        <div class="table-wrap"><table><thead><tr><th>Código</th><th>Nombre</th><th>Tipo de control</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="cat-body"></tbody></table></div>
      </div>`;
    const body = content.querySelector('#cat-body');
    const paint = () => {
      const q = (content.querySelector('#cat-search')?.value || '').toLowerCase();
      const filtered = rows.filter(c => `${c.code} ${c.name}`.toLowerCase().includes(q));
      content.querySelector('#cat-count').textContent = `${filtered.length} categoría${filtered.length===1?'':'s'}`;
      body.innerHTML = filtered.length ? filtered.map(c => `
        <tr><td><b>${esc(c.code)}</b></td><td>${esc(c.name)}</td>
        <td><span class="badge ${c.control_type === 'CONTROL' ? 'low' : 'ok'}">${c.control_type === 'CONTROL' ? 'Control' : 'Consumo'}</span></td>
        <td><span class="badge ${c.active ? 'ok' : 'critical'}">${c.active ? 'Activa' : 'Inactiva'}</span></td>
        <td><button class="btn btn-secondary cat-edit" data-id="${esc(c.id)}">Editar</button> <button class="btn btn-secondary cat-delete" data-id="${esc(c.id)}">Eliminar</button></td></tr>`).join('') : `<tr><td colspan="5"><div class="empty"><strong>No hay categorías</strong>Crea una nueva categoría para comenzar.</div></td></tr>`;
    };
    content.querySelector('#cat-search').oninput = paint;
    content.querySelector('#cat-new').onclick = () => categoryModal();
    body.onclick = async e => {
      const edit = e.target.closest('.cat-edit');
      const del = e.target.closest('.cat-delete');
      if (edit) { const c = rows.find(x => x.id === edit.dataset.id); if (c) categoryModal(c); }
      if (del) {
        const c = rows.find(x => x.id === del.dataset.id);
        if (!c) return;
        if (!confirm(`¿Eliminar la categoría "${c.code} - ${c.name}"?\n\nEsta acción no se puede deshacer.`)) return;
        const { error } = await sb.from('categories').delete().eq('id', c.id);
        if (error) {
          const msg = String(error.message || '');
          if (/foreign key|violates|referenced|constraint/i.test(msg)) toast('No se puede eliminar: la categoría está siendo utilizada por artículos.', true);
          else toast(error.message, true);
          return;
        }
        toast('Categoría eliminada');
        await renderCategories();
        if (typeof load === 'function') await load();
      }
    };
    paint();
  }

  function categoryModal(category=null) {
    const modal = document.querySelector('#modal');
    const mc = document.querySelector('#modal-content');
    if (!modal || !mc) return;
    const controlType = category?.control_type || 'CONSUMO';
    mc.innerHTML = `<h2>${category ? 'Editar categoría' : 'Nueva categoría'}</h2><p class="modal-sub">El tipo de control determina cómo participa la categoría en el Dashboard.</p>
      <form id="category-form"><div class="form-grid">
      <div class="field"><label>Código *</label><input class="form-control" name="code" maxlength="20" placeholder="MAT" value="${esc(category?.code || '')}" required></div>
      <div class="field"><label>Nombre *</label><input class="form-control" name="name" maxlength="100" placeholder="Materiales" value="${esc(category?.name || '')}" required></div>
      <div class="field"><label>Tipo de control *</label><select class="form-control" name="control_type"><option value="CONSUMO" ${controlType==='CONSUMO'?'selected':''}>Consumo y reposición</option><option value="CONTROL" ${controlType==='CONTROL'?'selected':''}>Control de movimientos</option></select></div>
      </div><div class="form-actions"><button type="button" class="btn btn-secondary" id="cat-cancel">Cancelar</button><button class="btn btn-primary">${category ? 'Guardar cambios' : 'Crear categoría'}</button></div></form>`;
    modal.classList.remove('hidden');
    document.querySelector('#cat-cancel').onclick = () => modal.classList.add('hidden');
    document.querySelector('#category-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const payload = {code: String(f.get('code')).trim().toUpperCase(), name: String(f.get('name')).trim(), control_type: String(f.get('control_type')||'CONSUMO')};
      let result;
      if (category) result = await sb.from('categories').update(payload).eq('id', category.id);
      else result = await sb.from('categories').insert(payload);
      if (result.error) { toast(result.error.message, true); return; }
      modal.classList.add('hidden'); toast(category ? 'Categoría actualizada' : 'Categoría creada'); await renderCategories();
      if (typeof load === 'function') await load();
    };
  }
})();
