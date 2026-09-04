/* QUIMFLUX Inventario - corrección del filtro por categorías */
(function(){
  let lastState='';
  const sync=()=>{
    if(typeof state==='undefined' || !Array.isArray(state.categories) || !Array.isArray(state.items)) return;
    const map=new Map((state.categories||[]).map(c=>[String(c.code||'').trim().toUpperCase(),String(c.id)]));
    let changed=false;
    (state.items||[]).forEach(item=>{
      const id=map.get(String(item.category_code||'').trim().toUpperCase());
      if(id && String(item.category_id||'')!==id){
        item.category_id=id;
        changed=true;
      }
    });
    const signature=(state.items||[]).map(i=>`${i.id}:${i.category_id||''}`).join('|');
    if(changed && signature!==lastState && state.view==='overview' && typeof view==='function'){
      lastState=signature;
      view();
    }else if(signature!==lastState){
      lastState=signature;
    }
  };
  setInterval(sync,250);
  sync();
})();
