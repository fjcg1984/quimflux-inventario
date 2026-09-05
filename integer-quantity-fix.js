/* QUIMFLUX Inventario - cantidades enteras para entradas y salidas */
(function(){
  let started=false;
  function apply(){
    document.querySelectorAll('#movement-form input[name="quantity"]').forEach(input=>{
      input.type='number';
      input.min='1';
      input.step='1';
      input.setAttribute('inputmode','numeric');
      const n=Number(input.value);
      if(!Number.isInteger(n)||n<1) input.value='1';
    });
    document.querySelectorAll('#edit-movement-form input[name="quantity"]').forEach(input=>{
      input.type='number';
      input.min='1';
      input.step='1';
      input.setAttribute('inputmode','numeric');
      const n=Number(input.value);
      if(!Number.isInteger(n)||n<1) input.value='1';
    });
  }
  function boot(){
    if(started)return;
    if(typeof state==='undefined'){setTimeout(boot,100);return;}
    started=true;
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    apply();
  }
  boot();
})();
