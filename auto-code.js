/* QUIMFLUX Inventario - generación automática de códigos por categoría */
(function(){
  let observerStarted=false;
  let lastCategory='';
  const MANUAL_CATEGORIES=['CRIS','CRI','COPELAS','COP','ESCORIFICADORES','ESC'];

  function categoryInfo(categoryId){
    return (state.categories||[]).find(c=>String(c.id)===String(categoryId));
  }

  function isManualCategory(categoryId){
    const cat=categoryInfo(categoryId);
    const code=String(cat?.code||'').trim().toUpperCase();
    const name=String(cat?.name||'').trim().toUpperCase();
    return MANUAL_CATEGORIES.some(x=>code===x||name===x||name.includes(x));
  }

  function categoryCode(categoryId){
    const cat=categoryInfo(categoryId);
    return String(cat?.code||'').trim().toUpperCase();
  }

  function nextCode(categoryId){
    const prefix=categoryCode(categoryId);
    if(!prefix)return '';

    const candidates=(state.items||[])
      .map(i=>String(i.code||'').trim().toUpperCase())
      .filter(code=>code.startsWith(prefix));

    let best=null;
    candidates.forEach(code=>{
      const match=code.match(new RegExp('^'+prefix.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'([-_/ ]?)(\\d+)$'));
      if(!match)return;
      const number=Number(match[2]);
      if(!Number.isFinite(number))return;
      const candidate={code,separator:match[1]||'',number,width:match[2].length};
      if(!best || number>best.number)best=candidate;
    });

    if(!best)return `${prefix}-001`;
    const width=Math.max(3,best.width);
    return `${prefix}${best.separator}${String(best.number+1).padStart(width,'0')}`;
  }

  function apply(){
    const form=document.querySelector('#item-form');
    if(!form || typeof state==='undefined')return;
    const category=form.querySelector('[name="category_id"]');
    const code=form.querySelector('[name="code"]');
    if(!category || !code)return;

    const manual=isManualCategory(category.value);
    const label=code.closest('.field')?.querySelector('label');

    if(manual){
      code.dataset.autoCode='0';
      code.readOnly=false;
      code.title='Código manual para esta categoría';
      code.style.background='';
      code.style.cursor='';
      if(label && label.textContent!=='Código *')label.textContent='Código *';
      if(lastCategory!==category.value){
        code.value='';
        lastCategory=category.value;
      }
      if(!category.dataset.codeListener){
        category.dataset.codeListener='1';
        category.addEventListener('change',apply);
      }
      return;
    }

    if(code.dataset.autoCode!=='1'){
      code.dataset.autoCode='1';
      code.readOnly=true;
      code.title='Código generado automáticamente según la categoría';
      code.style.background='#f3f4f6';
      code.style.cursor='not-allowed';
      if(label && !label.querySelector('[data-auto-label]')){
        label.innerHTML='Código * <span data-auto-label style="font-size:11px;font-weight:500;opacity:.7">(automático)</span>';
      }
      if(!category.dataset.codeListener){
        category.dataset.codeListener='1';
        category.addEventListener('change',apply);
      }
    }

    if(lastCategory!==category.value || !code.value){
      code.value=nextCode(category.value);
      lastCategory=category.value;
    }
  }

  const boot=setInterval(()=>{
    if(typeof state==='undefined')return;
    const modal=document.querySelector('#modal-content');
    if(!modal)return;
    if(!observerStarted){
      observerStarted=true;
      new MutationObserver(apply).observe(modal,{childList:true,subtree:true});
    }
    apply();
  },100);
})();
