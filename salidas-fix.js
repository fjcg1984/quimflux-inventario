/* QUIMFLUX Inventario - reparación robusta de la pestaña Salidas */
(function(){
  let ready=false;
  function boot(){
    if(ready)return;
    if(typeof state==='undefined' || typeof movement!=='function'){
      setTimeout(boot,100);
      return;
    }
    ready=true;
    document.addEventListener('click',function(e){
      const btn=e.target.closest('#nav [data-view="exits"]');
      if(!btn)return;
      e.preventDefault();
      e.stopPropagation();
      state.view='exits';
      document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===btn));
      const title=document.querySelector('#page-title');
      if(title)title.textContent='Salidas';
      movement('EXIT');
    },true);
  }
  boot();
})();
