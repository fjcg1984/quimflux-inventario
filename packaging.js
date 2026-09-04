/* QUIMFLUX Inventario - presentaciones y conversiones de unidades */
(function(){
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number(n || 0).toLocaleString('es-PE',{maximumFractionDigits:3});
  let timer = null;

  function itemById(id){ return (typeof state!=='undefined' ? state.items : []).find(i=>i.id===id); }
  function itemPresentation(i){ return String(i?.presentation || i?.unit || 'UND').trim().toUpperCase(); }
  function factor(i){ const n=Number(i?.units_per_presentation); return Number.isFinite(n)&&n>0?n:1; }

  function enhanceNewItem(){
    const form=document.querySelector('#item-form');
    if(!form || form.dataset.packagingReady) return;
    form.dataset.packagingReady='1';
    const grid=form.querySelector('.form-grid');
    const unit=grid?.querySelector('[name="unit"]')?.closest('.field');
    if(!grid || !unit) return;
    const wrap=document.createElement('div'); wrap.className='field';
    wrap.innerHTML='<label>Presentación</label><input class="form-control" name="presentation" value="UND" placeholder="PAQUETE, CAJA, BOLSA...">';
    unit.insertAdjacentElement('afterend',wrap);
    const factorWrap=document.createElement('div'); factorWrap.className='field';
    factorWrap.innerHTML='<label>Unidades por presentación</label><input class="form-control" name="units_per_presentation" type="number" min="0.001" step="0.001" value="1"><div class="sub">Ej.: 1 paquete = 10 unidades</div>';
    wrap.insertAdjacentElement('afterend',factorWrap);
    form.onsubmit=createItemWithPackaging;
  }

  async function createItemWithPackaging(e){
    e.preventDefault();
    const f=new FormData(e.target);
    const initial=Number(f.get('initial')||0), unitsPer=Number(f.get('units_per_presentation')||1);
    const unit=String(f.get('unit')||'UND').trim().toUpperCase()||'UND';
    const presentation=String(f.get('presentation')||unit).trim().toUpperCase()||unit;
    if(!Number.isFinite(unitsPer)||unitsPer<=0){toast('La equivalencia debe ser mayor que 0.',true);return;}
    const {data,error}=await sb.from('items').insert({code:String(f.get('code')||'').trim().toUpperCase(),category_id:f.get('category_id'),name:String(f.get('name')||'').trim(),description:String(f.get('description')||'').trim()||null,unit,current_stock:0,minimum_stock:Number(f.get('minimum')||0),presentation,units_per_presentation:unitsPer}).select().single();
    if(error){toast(error.message,true);return;}
    if(initial>0){const {error:me}=await sb.from('movements').insert({item_id:data.id,movement_type:'ENTRY',quantity:initial,presentation:presentation,presentation_quantity:Number((initial/unitsPer).toFixed(3)),conversion_factor:unitsPer,notes:'Stock inicial'});if(me){toast(me.message,true);return;}}
    closeModal();await load();view();toast('Artículo creado correctamente');
  }

  function enhanceMovement(){
    const form=document.querySelector('#movement-form');
    if(!form || form.dataset.packagingReady) return;
    form.dataset.packagingReady='1';
    const itemSelect=form.querySelector('[name="item_id"]'), qty=form.querySelector('[name="quantity"]');
    if(!itemSelect||!qty) return;
    const qtyField=qty.closest('.field');
    const presentationWrap=document.createElement('div'); presentationWrap.className='field';
    presentationWrap.innerHTML='<label>Presentación *</label><select class="form-control" name="presentation_choice"></select><div id="conversion-help" class="sub" style="margin-top:5px"></div>';
    qtyField.insertAdjacentElement('beforebegin',presentationWrap);
    const refresh=()=>{
      const i=itemById(itemSelect.value); const select=form.querySelector('[name="presentation_choice"]');
      if(!i||!select) return;
      const p=itemPresentation(i), u=String(i.unit||'UND').toUpperCase(), f=factor(i);
      select.innerHTML=`<option value="${esc(p)}">${esc(p)}${f!==1?' — '+fmt(f)+' '+esc(u):''}</option>${f!==1?`<option value="${esc(u)}">${esc(u)} — 1 ${esc(u)}</option>`:''}`;
      select.dataset.baseUnit=u; select.dataset.factor=f;
      updateHelp();
    };
    const updateHelp=()=>{
      const i=itemById(itemSelect.value), select=form.querySelector('[name="presentation_choice"]'), help=form.querySelector('#conversion-help');
      if(!i||!select||!help)return;
      const chosen=select.value, p=itemPresentation(i), f=factor(i), base=String(i.unit||'UND').toUpperCase();
      const chosenFactor=chosen===p?f:1; const n=Number(qty.value||0); const baseQty=n*chosenFactor;
      help.textContent=chosenFactor!==1?`${fmt(n)} ${chosen} = ${fmt(baseQty)} ${base}`:`${fmt(n)} ${chosen} = ${fmt(baseQty)} ${base}`;
    };
    itemSelect.addEventListener('change',refresh); qty.addEventListener('input',updateHelp); form.querySelector('[name="presentation_choice"]').addEventListener('change',updateHelp);
    refresh();
    form.onsubmit=e=>saveMovementWithPackaging(e, form.closest('#content')?.querySelector('h2')?.textContent?.toLowerCase().includes('entrada')?'ENTRY':'EXIT');
  }

  async function saveMovementWithPackaging(e,type){
    e.preventDefault();
    const f=new FormData(e.target), item=itemById(f.get('item_id')), qty=Number(f.get('quantity')), chosen=String(f.get('presentation_choice')||'');
    if(!item||!Number.isFinite(qty)||qty<=0){toast('Selecciona un artículo e indica una cantidad válida.',true);return;}
    const p=itemPresentation(item), base=String(item.unit||'UND').toUpperCase(), units=factor(item), chosenFactor=chosen===p?units:1, baseQty=Number((qty*chosenFactor).toFixed(3));
    if(type==='EXIT'&&baseQty>Number(item.current_stock)){toast(`Stock insuficiente. Disponible: ${fmt(item.current_stock)} ${base}`,true);return;}
    const payload={item_id:item.id,movement_type:type,quantity:baseQty,movement_date:new Date(f.get('date')).toISOString(),presentation:chosen,presentation_quantity:qty,conversion_factor:chosenFactor,notes:f.get('notes')||null};
    if(type==='ENTRY'){payload.supplier=f.get('supplier')||null;payload.document_number=f.get('document')||null}else{payload.destination=f.get('destination')||null;payload.responsible=f.get('responsible')||null}
    const {error}=await sb.from('movements').insert(payload);
    if(error){toast(error.message,true);return;}
    await load();view();toast(`${type==='ENTRY'?'Entrada':'Salida'} registrada: ${fmt(qty)} ${chosen} = ${fmt(baseQty)} ${base}`);
  }

  function enhanceOverview(){
    if(typeof state==='undefined'||state.view!=='overview')return;
    const body=document.querySelector('#body'); if(!body)return;
    [...body.querySelectorAll('tr')].forEach(row=>{
      if(row.querySelector('.packaging-stock'))return;
      const code=row.querySelector('td:first-child b')?.textContent?.trim(), i=(state.items||[]).find(x=>x.code===code); if(!i||row.querySelector('.empty'))return;
      const stockCell=row.children[4]; if(!stockCell)return;
      const f=factor(i), p=itemPresentation(i), u=String(i.unit||'UND').toUpperCase();
      if(f!==1)stockCell.insertAdjacentHTML('beforeend',`<div class="sub packaging-stock">≈ ${fmt(Number(i.current_stock)/f)} ${esc(p)}</div>`);
    });
  }

  function enhanceMovements(){
    if(typeof state==='undefined'||state.view!=='movements')return;
    const rows=state.movements||[], body=document.querySelector('.panel tbody'); if(!body)return;
    [...body.querySelectorAll('tr')].forEach((row,idx)=>{
      if(row.querySelector('.packaging-movement'))return;
      const m=rows[idx]; if(!m||row.querySelector('.empty'))return;
      const qCell=row.children[4]; if(!qCell)return;
      const q=Number(m.presentation_quantity), p=m.presentation, f=Number(m.conversion_factor||1), base=Number(m.quantity);
      if(p && q && f!==1) qCell.innerHTML=`<b>${fmt(q)} ${esc(p)}</b><div class="sub packaging-movement">= ${fmt(base)} ${esc(itemById(m.item_id)?.unit||'UND')}</div>`;
    });
  }

  function run(){enhanceNewItem();enhanceMovement();enhanceOverview();enhanceMovements();}
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(run,20);});
  observer.observe(document.body,{childList:true,subtree:true});
  setInterval(run,500);
})();
