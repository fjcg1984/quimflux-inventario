(() => {
  const codeCache = new Map();
  const normalize = value => String(value || '').trim().toUpperCase();
  const categoryById = id => (window.state?.categories || []).find(c => String(c.id) === String(id));

  function prefixRegex(prefix) {
    const safe = normalize(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^' + safe + '[-_/ ]?(\\d+)$', 'i');
  }

  async function refreshCodes(prefix) {
    prefix = normalize(prefix);
    if (!prefix) return [];
    const { data, error } = await window.sb
      .from('items')
      .select('code')
      .ilike('code', `${prefix}-%`);
    if (error) throw error;
    const codes = (data || []).map(row => normalize(row.code)).filter(Boolean);
    codeCache.set(prefix, codes);
    return codes;
  }

  function fallbackCodes(prefix) {
    const re = prefixRegex(prefix);
    return (window.state?.items || [])
      .map(item => normalize(item.code))
      .filter(code => re.test(code));
  }

  function calculateNext(prefix, codes) {
    prefix = normalize(prefix);
    if (!prefix) return '';
    const re = prefixRegex(prefix);
    let max = 0;
    let width = 3;
    (codes || []).forEach(code => {
      const match = code.match(re);
      if (!match) return;
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > max) {
        max = n;
        width = Math.max(3, match[1].length);
      }
    });
    return `${prefix}-${String(max + 1).padStart(width, '0')}`;
  }

  window.nextAutomaticCode = function(categoryId) {
    const category = categoryById(categoryId);
    const prefix = normalize(category?.code);
    if (!prefix) return '';
    const codes = codeCache.get(prefix) || fallbackCodes(prefix);
    return calculateNext(prefix, codes);
  };

  window.updateNewItemCode = function(form) {
    if (!form) return;
    const category = form.querySelector('[name="category_id"]');
    const code = form.querySelector('[name="code"]');
    const saveButton = form.querySelector('button[type="submit"]');
    const label = code?.closest('.field')?.querySelector('label');
    if (!category || !code) return;

    const selected = categoryById(category.value);
    const name = normalize(selected?.name);
    const manual = ['COPELAS', 'CRISOLES', 'ESCORIFICADORES'].includes(name);

    if (manual) {
      code.readOnly = false;
      code.value = '';
      code.removeAttribute('title');
      code.style.background = '';
      code.style.cursor = '';
      if (label) label.textContent = 'Código *';
      if (saveButton) saveButton.disabled = false;
      return;
    }

    code.readOnly = true;
    code.title = 'Código generado automáticamente según la categoría';
    code.style.background = '#f3f4f6';
    code.style.cursor = 'not-allowed';
    if (label) label.innerHTML = 'Código * <span style="font-size:11px;font-weight:500;opacity:.7">(automático)</span>';

    const prefix = normalize(selected?.code);
    code.value = prefix ? 'Generando…' : '';
    if (saveButton) saveButton.disabled = true;

    refreshCodes(prefix)
      .then(codes => {
        if (!document.body.contains(form)) return;
        code.value = calculateNext(prefix, codes);
        if (saveButton) saveButton.disabled = false;
      })
      .catch(error => {
        console.error('[QUIMFLUX] No se pudieron consultar los códigos existentes:', error);
        if (!document.body.contains(form)) return;
        code.value = calculateNext(prefix, fallbackCodes(prefix));
        if (saveButton) saveButton.disabled = false;
        if (typeof toast === 'function') toast('No se pudo verificar el último código. Revisa antes de guardar.', true);
      });
  };

  // En cada apertura/cambio de categoría se consulta public.items, incluyendo
  // artículos inactivos, porque la columna code es UNIQUE aunque active=false.
  const wait = setInterval(() => {
    if (window.state?.categories?.length && window.sb && window.nextAutomaticCode === window.nextAutomaticCode) {
      clearInterval(wait);
    }
  }, 100);
})();
