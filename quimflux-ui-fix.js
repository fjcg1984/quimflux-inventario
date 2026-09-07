/* QUIMFLUX Inventario - correcciones visuales y formularios.
   Sin MutationObserver: usa un temporizador ligero para evitar ciclos de renderizado. */
(function(){
  const style=document.createElement('style');
  style.id='quimflux-ui-fix-style';
  style.textContent=`
    .sidebar{overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;}
    .table-wrap{width:100%;max-width:100%;overflow-x:auto!important;overflow-y:visible;scrollbar-gutter:stable;}
    .table-wrap table{min-width:980px;}
    .modal{overflow:auto;align-items:center;}
    .modal-card{max-height:calc(100vh - 32px);overflow-y:auto;overflow-x:hidden;}
    #item-form .form-actions{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);z-index:2;}
    #item-form button[disabled],#edit-item-form button[disabled]{opacity:.65;cursor:wait;}
  `;
  document.head.appendChild(style);

  const appState=()=>typeof state!=='undefined'?state:null;
  function toastError(prefix,error){
    const msg=error?.message||error?.details||error?.hint||'Error desconocido al guardar.';
    if(typeof toast==='function')toast(prefix+msg,true);
    console.error('[QUIMFLUX]',prefix,msg,error);
  }
  function categoryCode(category){
    const raw=String(category?.code||category?.name||'MAT').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    return raw.slice(0,12)||'MAT';
  }
  function nextCode(category){
    const prefix=categoryCode(category);let max=0;const s=appState();
    (s?.items||[]).forEach(i=>{const code=String(i.code||'').toUpperCase();const m=code.match(new RegExp('^'+prefix.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'[-_/ ]?(\\\\d+)$'));if(m)max=Math.max(max,Number(m[1])||0);});
    return `${prefix}-${String(max+1).padStart(3,'0')}`;
  }
  async function saveNewItem(form){
    const f=new FormData(form),s=appState();
    const categoryId=String(f.get('category_id')||'').trim(),category=(s?.categories||[]).find(c=>String(c.id)===categoryId);
    const code=String(f.get('code')||'').trim().toUpperCase()||nextCode(category),name=String(f.get('name')||'').trim(),unit=String(f.get('unit')||'UND').trim().toUpperCase()||'UND';
    const initial=Number(f.get('initial')||0),minimum=Number(f.get('minimum')||0);
    if(!categoryId||!name){toastError('Completa Código/Categoría/Nombre. ',null);return;}
    if(!Number.isFinite(initial)||initial<0||!Number.isFinite(minimum)||minimum<0){toastError('Stock inicial y mínimo deben ser números válidos. ',null);return;}
    const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Guardando...';}
    const {data,error}=await sb.from('items').insert({code,category_id:categoryId,name,description:String(f.get('description')||'').trim()||null,unit,current_stock:0,minimum_stock:minimum}).select('id').single();
    if(error){if(btn){btn.disabled=false;btn.textContent=btn.dataset.oldText||'Guardar artículo';}toastError('No se pudo guardar el artículo: ',error);return;}
    if(initial>0){const {error:movementError}=await sb.from('movements').insert({item_id:data.id,movement_type:'ENTRY',quantity:initial,notes:'Stock inicial'});if(movementError)toastError('El artículo se creó, pero no se pudo registrar el stock inicial: ',movementError);}
    if(typeof closeModal==='function')closeModal();if(typeof load==='function')await load();if(typeof view==='function')view();if(typeof toast==='function')toast('Artículo creado correctamente');
  }
  function wireItemForm(){
    const form=document.querySelector('#item-form');if(!form||form.dataset.qfSave)return;form.dataset.qfSave='1';
    const code=form.querySelector('[name="code"]'),cat=form.querySelector('[name="category_id"]');
    const fill=()=>{if(code&&!code.value&&cat){const s=appState(),c=(s?.categories||[]).find(x=>String(x.id)===String(cat.value));code.value=nextCode(c);}};
    fill();cat?.addEventListener('change',()=>{if(code)code.value='';fill();});
    form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();saveNewItem(form);},true);
  }
  function wireEditForm(){
    const form=document.querySelector('#edit-item-form');if(!form||form.dataset.qfSave)return;form.dataset.qfSave='1';
    form.addEventListener('submit',async e=>{
      e.preventDefault();e.stopImmediatePropagation();const f=new FormData(form),code=String(f.get('code')||'').trim().toUpperCase(),name=String(f.get('name')||'').trim(),unit=String(f.get('unit')||'UND').trim().toUpperCase()||'UND',minimum=Number(f.get('minimum')),s=appState();
      const original=form.querySelector('[name="code"]')?.defaultValue,item=(s?.items||[]).find(i=>String(i.code)===String(original))||null;
      if(!item){toastError('No se pudo identificar el artículo para editar. ',null);return}
      if(!code||!name||!f.get('category_id')||!Number.isFinite(minimum)||minimum<0){toastError('Revisa los campos obligatorios y el stock mínimo. ',null);return}
      const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Guardando...';}
      const {error}=await sb.from('items').update({code,category_id:f.get('category_id'),name,unit,minimum_stock:minimum,description:String(f.get('description')||'').trim()||null}).eq('id',item.id);
      if(error){if(btn){btn.disabled=false;btn.textContent='Guardar cambios';}toastError('No se pudieron guardar los cambios: ',error);return}
      closeModal();await load();view();toast('Cambios guardados correctamente');
    },true);
  }
  function cleanDuplicateFicha(){
    const s=appState();if(s?.view!=='overview')return;const body=document.querySelector('#body'),table=body?.closest('table'),head=table?.querySelector('thead tr');if(!table||!head)return;
    const fichaHeads=[...head.children].filter(th=>th.textContent.trim().toLowerCase()==='ficha');if(fichaHeads.length<=1)return;
    const removeIndex=[...head.children].indexOf(fichaHeads[1]);
    [...body.querySelectorAll('tr')].forEach(row=>{if(row.children.length>removeIndex)row.removeChild(row.children[removeIndex]);});
    fichaHeads.slice(1).forEach(th=>th.remove());
  }
  function tick(){try{wireItemForm();wireEditForm();cleanDuplicateFicha();}catch(err){console.error('[QUIMFLUX ui-fix]',err);}}
  setInterval(tick,500);setTimeout(tick,300);
})();
