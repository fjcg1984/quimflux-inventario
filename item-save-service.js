(() => {
  function showSaveError(message) {
    if (typeof toast === 'function') toast(message, true);
    else console.error('[QUIMFLUX] Error al guardar artículo:', message);
  }

  async function saveNewItem(form) {
    const f = new FormData(form);
    const code = String(f.get('code') || '').trim().toUpperCase();
    const categoryId = f.get('category_id');
    const name = String(f.get('name') || '').trim();
    const unit = String(f.get('unit') || 'UND').trim().toUpperCase();
    const description = String(f.get('description') || '').trim() || null;
    const initial = Number(f.get('initial') || 0);
    const minimum = Number(f.get('minimum') || 0);

    if (!code || !categoryId || !name) {
      showSaveError('Completa código, categoría y nombre.');
      return;
    }
    if (!Number.isFinite(initial) || initial < 0 || !Number.isFinite(minimum) || minimum < 0) {
      showSaveError('Stock inicial y stock mínimo deben ser valores válidos.');
      return;
    }

    // No usamos .select() en el INSERT: así el guardado no depende de una
    // política SELECT sobre public.items. Supabase v2 permite INSERT sin retorno.
    const { error } = await sb.from('items').insert({
      code, category_id: categoryId, name, description, unit,
      current_stock: 0, minimum_stock: minimum
    });
    if (error) {
      showSaveError(error.message);
      return;
    }

    // Para stock inicial obtenemos el id desde la vista que ya usa el inventario.
    if (initial > 0) {
      const { data: item, error: lookupError } = await sb
        .from('inventory_overview')
        .select('id,code')
        .eq('code', code)
        .maybeSingle();

      if (lookupError || !item?.id) {
        showSaveError(lookupError?.message || 'El artículo se creó, pero no se pudo registrar el stock inicial.');
        return;
      }

      const { error: movementError } = await sb.from('movements').insert({
        item_id: item.id, movement_type: 'ENTRY', quantity: initial, notes: 'Stock inicial'
      });
      if (movementError) {
        showSaveError(movementError.message);
        return;
      }
    }

    closeModal();
    await load();
    view();
    toast('Artículo creado correctamente');
  }

  // Capturamos únicamente el formulario de Nuevo artículo y detenemos el
  // handler anterior de app.js para evitar el INSERT + SELECT que estaba fallando.
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'item-form') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveNewItem(form).catch(error => {
      console.error('[QUIMFLUX] Error inesperado al guardar artículo:', error);
      showSaveError(error?.message || 'No se pudo guardar el artículo.');
    });
  }, true);
})();
