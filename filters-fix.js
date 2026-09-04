/* QUIMFLUX Inventario - filtros de Vista general */
(function(){
  let timer=null;
  function bind(){
    if(typeof state==='undefined'||state.view!=='overview')return;
    ['q','cat','st'].forEach(id=>{
      const el=document.querySelector('#'+id);
      if(!el||el.dataset.filterBound)return;
      el.dataset.filterBound='1';
      el.addEventListener('input',()=>{ if(typeof window.renderInventoryTable==='function') window.renderInventoryTable(); });
      el.addEventListener('change',()=>{ if(typeof window.renderInventoryTable==='function') window.renderInventoryTable(); });
    });
  }
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(bind,30);});
  observer.observe(document.body,{childList:true,subtree:true});
  setInterval(bind,500);
  window.addEventListener('load',bind);
})();
