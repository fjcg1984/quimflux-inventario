/* QUIMFLUX Inventario - mostrar descripción como columna independiente */
(function(){
  let observerStarted=false;
  function enhance(){
    if(typeof state==='undefined' || state.view!=='overview') return;
    const table=document.querySelector('#body')?.closest('table');
    const head=table?.querySelector('thead tr');
    const body=table?.querySelector('tbody');
    if(!table||!head||!body) return;
    if(!head.querySelector('[data-description-head]')){
      const th=document.createElement('th');
      th.textContent='Descripción';
      th.setAttribute('data-description-head','1');
      head.insertBefore(th, head.children[3] || null);
    }
    [...body.querySelectorAll('tr')].forEach(row=>{
      if(row.querySelector('.empty')) return;
      if(row.querySelector('[data-description-cell]')) return;
      const code=row.querySelector('td:first-child b')?.textContent?.trim();
      const item=(state.items||[]).find(i=>i.code===code);
      if(!item) return;
      const td=document.createElement('td');
      td.setAttribute('data-description-cell','1');
      td.textContent=item.description||'—';
      row.insertBefore(td,row.children[3]||null);
    });
    const empty=body.querySelector('.empty');
    if(empty) empty.closest('tr')?.querySelector('td')?.setAttribute('colspan','9');
  }
  const boot=setInterval(()=>{
    const content=document.querySelector('#content');
    if(!content) return;
    clearInterval(boot);
    if(observerStarted) return;
    observerStarted=true;
    const observer=new MutationObserver(enhance);
    observer.observe(content,{childList:true,subtree:true});
    enhance();
  },100);
})();
