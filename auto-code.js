/* QUIMFLUX Inventario - generación automática de códigos por categoría */
(function(){
  let observer=null;
  let currentForm=null;
  const MANUAL_CATEGORY_NAMES=new Set(['COPELAS','CRISOLES','ESCORIFICADORES']);

  function normalize(value){
    return String(value||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function categoryInfo(categoryId){
    return (state.categories||[]).find(c=>String(c.id)===String(categoryId));
  }

  function isManualCategory(categoryId){
    const cat=categoryInfo(categoryId);
    return MANUAL_CATEGORY_NAMES.has(normalize(cat?.name));
  }

  function categoryCode(categoryId){
    return normalize(categoryInfo(categoryId)?.code);
  }

  function nextCode(categoryId){
    const prefix=categoryCode(categoryId);
    if(!prefix)return '';
    const safePrefix=prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('^'+safePrefix+'[-_/ ]?(\\d+)$','i');
    let bestNumber=0;
    let bestWidth=3;
    (state.items||[]).forEach(item=>{
      const match=String(item.code||'').trim().toUpperCase().match(re);
      if(!match)return;
      const number=Number(match[1]);
      if(Number.isFinite(number)&&number>bestNumber){bestNumber=number;bestWidth=match[1].length;}
    });
    return `${prefix}-${String(bestNumber+1).padStart(Math.max(3,bestWidth),'0')}`;
  }

  function apply(){
    const form=document.querySelector('#item-form');
    if(!form||typeof state==='undefined')return;
    const category=form.querySelector('[name="category_id"]');
    const code=form.querySelector('[name="code"]');
    if(!category||!code)return;

    if(form!==currentForm){
      currentForm=form;
      form.dataset.lastCategory='';
    }

    const manual=isManualCategory(category.value);
    const label=code.closest('.field')?.querySelector('label');
    const categoryChanged=form.dataset.lastCategory!==category.value;

    if(manual){
      code.readOnly=false;
      code.dataset.autoCode='0';
      code.title='Código manual para esta categoría';
      code.style.background='';
      code.style.cursor='';
      if(label)label.textContent='Código *';
      if(categoryChanged)code.value='';
      form.dataset.lastCategory=category.value;
      return;
    }

    code.readOnly=true;
    code.dataset.autoCode='1';
    code.title='Código generado automáticamente según la categoría';
    code.style.background='#f3f4f6';
    code.style.cursor='not-allowed';
    if(label)label.innerHTML='Código * <span style="font-size:11px;font-weight:500;opacity:.7">(automático)</span>';

    if(categoryChanged||!code.value){
      code.value=nextCode(category.value);
    }
    form.dataset.lastCategory=category.value;
  }

  function start(){
    const modal=document.querySelector('#modal-content');
    if(!modal)return;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>{
      if(observer)observer.disconnect();
      try{apply();}finally{
        if(observer)observer.observe(modal,{childList:true,subtree:true});
      }
    });
    observer.observe(modal,{childList:true,subtree:true});
    apply();
  }

  const boot=setInterval(()=>{
    if(typeof state==='undefined')return;
    if(!document.querySelector('#modal-content'))return;
    clearInterval(boot);
    start();
  },100);
})();
