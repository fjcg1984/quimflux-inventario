/* QUIMFLUX Inventario - correcciones de interfaz y alta de artículos */
(function(){
  const $=s=>document.querySelector(s);

  // Alta de artículos: validación clara, evita dobles clics y conserva el movimiento inicial.
  window.createItem=async function(e){
    e.preventDefault();
    const form=e.currentTarget||e.target;
    const f=new FormData(form);
    const code=String(f.get('code')||'').trim().toUpperCase();
    const categoryId=String(f.get('category_id')||'').trim();
    const name=String(f.get('name')||'').trim();
    const unit=String(f.get('unit')||'UND').trim().toUpperCase()||'UND';
    const description=String(f.get('description')||'').trim();
    const initial=Number(f.get('initial')||0);
    const minimum=Number(f.get('minimum')||0);
    const submit=form.querySelector('button[type="submit"],button.btn-primary');
    if(!code||!categoryId||!name){toast('Completa código, categoría y nombre.',true);return;}
    if(!Number.isFinite(initial)||initial<0){toast('El stock inicial debe ser un número igual o mayor que 0.',true);return;}
    if(!Number.isFinite(minimum)||minimum<0){toast('El stock mínimo debe ser un número igual o mayor que 0.',true);return;}
    if((state.items||[]).some(i=>String(i.code||'').trim().toUpperCase()===code)){toast(`El código ${code} ya existe. Usa el siguiente código disponible.`,true);return;}
    if(submit){submit.disabled=true;submit.textContent='Guardando…';}
    try{
      const {data,error}=await sb.from('items').insert({
        code,category_id:categoryId,name,description:description||null,unit,
        current_stock:0,minimum_stock:minimum
      }).select().single();
      if(error){toast(`No se pudo guardar el artículo: ${error.message}`,true);return;}
      if(initial>0){
        const {error:movementError}=await sb.from('movements').insert({item_id:data.id,movement_type:'ENTRY',quantity:initial,notes:'Stock inicial'});
        if(movementError){
          await sb.from('items').update({active:false}).eq('id',data.id);
          toast(`El artículo no quedó activo porque falló el stock inicial: ${movementError.message}`,true);
          return;
        }
      }
      closeModal();
      await load();
      view();
      toast('Artículo creado correctamente');
    }catch(err){
      toast(`No se pudo guardar el artículo: ${err?.message||err}`,true);
    }finally{
      if(submit){submit.disabled=false;submit.textContent='Guardar artículo';}
    }
  };

  function normalizeOverview(){
    if(typeof state==='undefined'||state.view!=='overview')return;
    const table=$('#body')?.closest('table');
    if(!table)return;
    const head=table.querySelector('thead tr');
    if(!head)return;

    // Vista General 2.0 ya genera Descripción y Ficha.
    // Evitamos que módulos anteriores vuelvan a insertar columnas duplicadas.
    ['Descripción','Ficha'].forEach(label=>{
      const headers=[...head.children].filter(th=>th.textContent.trim().toLowerCase()===label.toLowerCase());
      if(headers.length<=1)return;
      headers.slice(1).forEach(th=>{
        const index=[...head.children].indexOf(th);
        [...table.tBodies].forEach(tbody=>[...tbody.rows].forEach(row=>row.children[index]?.remove()));
        th.remove();
      });
    });

    // Por fila, una sola acción "Ver ficha".
    [...table.tBodies].forEach(tbody=>[...tbody.rows].forEach(row=>{
      const ficha=[...row.querySelectorAll('.js-vista-ficha')];
      ficha.slice(1).forEach(btn=>btn.closest('td')?.remove());
    }));

    const wrap=table.closest('.table-wrap');
    if(wrap){
      wrap.style.overflowX='auto';
      wrap.style.overflowY='visible';
      wrap.style.maxWidth='100%';
      wrap.style.scrollbarGutter='stable';
    }
  }

  function injectUi(){
    if(document.getElementById('quimflux-ui-fix-style'))return;
    const style=document.createElement('style');
    style.id='quimflux-ui-fix-style';
    style.textContent=`
      .sidebar{overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;}
      .table-wrap{width:100%;max-width:100%;overflow-x:auto!important;overflow-y:visible;scrollbar-gutter:stable;}
      .table-wrap table{min-width:980px;}
      .modal{overflow:auto;align-items:center;}
      .modal-card{max-height:calc(100vh - 32px);overflow-y:auto;overflow-x:hidden;}
      #item-form .form-actions{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);z-index:2;}
      #item-form button[disabled]{opacity:.65;cursor:wait;}
    `;
    document.head.appendChild(style);
  }

  injectUi();
  const boot=setInterval(()=>{
    if(document.querySelector('#content')){
      clearInterval(boot);
      const observer=new MutationObserver(()=>{normalizeOverview();injectUi();});
      observer.observe(document.querySelector('#content'),{childList:true,subtree:true});
      normalizeOverview();
    }
  },200);
})();
