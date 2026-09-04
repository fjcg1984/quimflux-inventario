/* QUIMFLUX Inventario - cierre robusto de ventanas emergentes */
(function(){
  const boot=()=>{
    const modal=document.querySelector('#modal');
    if(!modal || modal.dataset.closeFix)return;
    modal.dataset.closeFix='1';
    const close=()=>{ if(typeof window.closeModal==='function') window.closeModal(); else modal.classList.add('hidden'); };
    modal.addEventListener('click',e=>{
      const btn=e.target.closest('#close,.modal-close');
      if(btn){e.preventDefault();e.stopPropagation();close();return;}
      if(e.target===modal)close();
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close();});
    const btn=modal.querySelector('#close');
    if(btn){btn.setAttribute('aria-label','Cerrar ventana');btn.setAttribute('title','Cerrar');}
  };
  const timer=setInterval(()=>{
    if(document.querySelector('#modal')){clearInterval(timer);boot();}
  },100);
  setTimeout(boot,500);
})();
