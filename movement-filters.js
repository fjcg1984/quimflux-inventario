/* QUIMFLUX Inventario - filtros avanzados del historial de movimientos */
(function(){
  let started=false;
  const wait=setInterval(()=>{
    const content=document.querySelector('#content');
    if(!content)return;
    clearInterval(wait);
    if(started)return;
    started=true;
    new MutationObserver(enhance).observe(content,{childList:true,subtree:true});
    enhance();
  },100);

  function enhance(){
    const panel=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.includes('Historial de movimientos'));
    if(!panel || panel.dataset.filtersEnhanced)return;
    panel.dataset.filtersEnhanced='1';

    const head=panel.querySelector('.panel-head');
    if(!head)return;

    const filters=document.createElement('div');
    filters.className='movement-filters';
    filters.innerHTML=`
      <div class="movement-filter-row">
        <input class="control mf-text" placeholder="Bien o código...">
        <input class="control mf-document" placeholder="Documento...">
        <select class="control mf-type">
          <option value="">Entrada y salida</option>
          <option value="ENTRY">Solo entradas</option>
          <option value="EXIT">Solo salidas</option>
        </select>
        <label class="movement-date-filter"><span>Desde</span><input class="control mf-from" type="date"></label>
        <label class="movement-date-filter"><span>Hasta</span><input class="control mf-to" type="date"></label>
        <button type="button" class="btn btn-secondary mf-clear">Limpiar filtros</button>
      </div>`;
    head.insertAdjacentElement('afterend',filters);

    const table=panel.querySelector('table');
    if(!table)return;
    const rows=[...table.querySelectorAll('tbody tr')];
    rows.forEach(row=>attachData(row));

    filters.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',apply));
    filters.querySelectorAll('select').forEach(el=>el.addEventListener('change',apply));
    filters.querySelector('.mf-clear').onclick=()=>{
      filters.querySelector('.mf-text').value='';
      filters.querySelector('.mf-document').value='';
      filters.querySelector('.mf-type').value='';
      filters.querySelector('.mf-from').value='';
      filters.querySelector('.mf-to').value='';
      apply();
    };
  }

  function attachData(row){
    if(row.dataset.filterData)return;
    const cells=row.querySelectorAll('td');
    if(cells.length<6 || row.querySelector('.empty'))return;
    const dateText=cells[0]?.textContent.trim()||'';
    const typeText=cells[1]?.textContent.trim()||'';
    const code=cells[2]?.textContent.trim()||'';
    const name=cells[3]?.textContent.trim()||'';
    const movement=state.movements.find(m=>m.id && m.items?.code===code && m.items?.name===name && limaDisplay(m.movement_date)===dateText)
      || state.movements.find(m=>m.id && m.items?.code===code && (m.movement_type==='ENTRY' ? typeText.includes('ENTRADA') : typeText.includes('SALIDA')));
    if(!movement)return;
    row.dataset.filterData=JSON.stringify({
      type:movement.movement_type,
      code:String(movement.items?.code||code).toLowerCase(),
      name:String(movement.items?.name||name).toLowerCase(),
      document:String(movement.document_number||'').toLowerCase(),
      date:limaInputFromISO(movement.movement_date).slice(0,10)
    });
  }

  function apply(){
    const panel=[...document.querySelectorAll('.panel')].find(p=>p.querySelector('h2')?.textContent.includes('Historial de movimientos'));
    if(!panel)return;
    const box=panel.querySelector('.movement-filters');
    if(!box)return;
    const text=box.querySelector('.mf-text').value.trim().toLowerCase();
    const documentQ=box.querySelector('.mf-document').value.trim().toLowerCase();
    const type=box.querySelector('.mf-type').value;
    const from=box.querySelector('.mf-from').value;
    const to=box.querySelector('.mf-to').value;
    panel.querySelectorAll('tbody tr').forEach(row=>{
      if(row.querySelector('.empty'))return;
      attachData(row);
      let d={};
      try{d=JSON.parse(row.dataset.filterData||'{}')}catch(e){}
      const okText=!text || `${d.code||''} ${d.name||''}`.includes(text);
      const okDoc=!documentQ || (d.document||'').includes(documentQ);
      const okType=!type || d.type===type;
      const okFrom=!from || !d.date || d.date>=from;
      const okTo=!to || !d.date || d.date<=to;
      row.style.display=okText&&okDoc&&okType&&okFrom&&okTo?'':'none';
    });
  }
})();
