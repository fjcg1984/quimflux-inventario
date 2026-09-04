/* QUIMFLUX Inventario - generación automática de códigos por categoría */
(function(){
  let observer=null;
  let currentForm=null;

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
    let best=null;
    const safePrefix=prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('^'+safePrefix+'[-_/ ]?(\\d+)$');
    (state.items||[]).forEach(item=>{
      const code=String(item.code||'').trim().toUpperCase();
      const match=code.match(re);
      if(!match)return;
      const number=Number(match[1]);
      if(!Number.isFinite(number))return;
      if(!best||number>best.number)best={number,width:match[1].length,code};
    });
    if(!best)return `${prefix}-001`;
    return `${prefix}-${String(best.number+1).padStart(Math.max(3,best.width),'0')}`;
  }

  function setValueIfNeeded(input,value){
    if(input.value!==value)input.value=value;
  }

  function apply(form){
    if(!form || typeof state==='undefined')return;
    const category=form.querySelector('[name="category_id"]');
    const code=form.querySelector('[name="code"]');
    if(!category||!code)return;

    if(form!==currentForm){
      currentForm=form;
      form.dataset.lastCategory='';
    }

    const manual=isManualCategory(category.value);
    const label=code.closest('.field')?.querySelector('label');
    const desiredLabel=manual?'Código *':'Código * <span style="font-size:11px;font-weight:500;opacity:.7">(automático)</span>';

    if(manual){
      if(code.dataset.autoCode!=='0'){
        code.dataset.autoCode='0';
        code.readOnly=false;
        code.title='Código manual para esta categoría';
        code.style.background='';
        code.style.cursor='';
      }
      if(label && label.innerHTML!==desiredLabel)label.innerHTML=desiredLabel;
      if(form.dataset.lastCategory!==category.value){
        setValueIfNeeded(code,'');
        form.dataset.lastCategory=category.value;
      }
      return;
    }

    if(code.dataset.autoCode!=='1'){
      code.dataset.autoCode='1';
      code.readOnly=true;
      code.title='Código generado automáticamente según la categoría';
      code.style.background='#f3f4f6';
      code.style.cursor='not-allowed';
    }
    if(label && label.innerHTML!==desiredLabel)label.innerHTML=desiredLabel;
    if(form.dataset.lastCategory!==category.value || !code.value){
      setValueIfNeeded(code,nextCode(category.value));
      form.dataset.lastCategory=category.value;
    }
  }

  function observeModal(){
    const modal=document.querySelector('#modal-content');
    if(!modal)return;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>{
      observer.disconnect();
      try{apply(modal.querySelector('#item-form'));}
      finally{observer.observe(modal,{childList:true,subtree:true});}
    });
    observer.observe(modal,{childList:true,subtree:true});
    apply(modal.querySelector('#item-form'));
  }

  const boot=setInterval(()=>{
    if(typeof state==='undefined')return;
    const modal=document.querySelector('#modal-content');
    if(!modal)return;
    clearInterval(boot);
    observeModal();
    const pageObserver=new MutationObserver(()=>observeModal());
    pageObserver.observe(document.body,{childList:true,subtree:true});
  },100);
})();
