/* QUIMFLUX Inventario - filtros robustos de Vista general */
(function(){
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('es-PE',{maximumFractionDigits:3});
  const label=s=>({SUFFICIENT:'Suficiente',LOW:'Stock bajo',CRITICAL:'Reponer'}[s]||s);
  const cls=s=>({SUFFICIENT:'ok',LOW:'low',CRITICAL:'critical'}[s]||'ok');
  let timer=null;

  function applyFilters(){
    if(typeof state==='undefined'||state.view!=='overview') return;
    const q=document.querySelector('#q'), cat=document.querySelector('#cat'), st=document.querySelector('#st'), body=document.querySelector('#body');
    if(!q||!cat||!st||!body) return;
    const query=q.value.trim().toLowerCase();
    const category=cat.value;
    const status=st.value;
    const rows=(state.items||[]).filter(i=>{
      const haystack=`${i.code||''} ${i.name||''} ${i.description||''}`.toLowerCase();
      const categoryMatch=!category || String(i.category_id)===String(category) || String(i.category_name||'')===String(cat.options[cat.selectedIndex]?.text||'');
      const statusMatch=!status || String(i.stock_status||'')===String(status);
      return (!query||haystack.includes(query)) && categoryMatch && statusMatch;
    });
    const count=document.querySelector('#count');
    if(count) count.textContent=`${rows.length} artículo${rows.length===1?'':'s'}`;
    body.innerHTML=rows.length?rows.map(i=>{
      const f=Number(i.units_per_presentation||1);
      const p=String(i.presentation||i.unit||'UND').toUpperCase();
      const u=String(i.unit||'UND').toUpperCase();
      const presentation=f>1?`<div class="sub packaging-stock">≈ ${fmt(Number(i.current_stock)/f)} ${esc(p)}</div>`:'';
      return `<tr><td><b>${esc(i.code)}</b></td><td>${esc(i.category_name)}</td><td>${esc(i.name)}<div class="sub">${esc(i.description||'')}</div></td><td>${esc(u)}</td><td><b>${fmt(i.current_stock)}</b>${presentation}</td><td>${fmt(i.minimum_stock)}</td><td><span class="badge ${cls(i.stock_status)}">${label(i.stock_status)}</span></td></tr>`;
    }).join(''):`<tr><td colspan="7"><div class="empty"><strong>No hay resultados</strong>Ajusta los filtros o crea un artículo nuevo.</div></td></tr>`;
  }

  function bind(){
    if(typeof state==='undefined'||state.view!=='overview') return;
    ['q','cat','st'].forEach(id=>{
      const el=document.querySelector('#'+id);
      if(!el||el.dataset.filtersFixBound) return;
      el.dataset.filtersFixBound='1';
      el.addEventListener('input',applyFilters);
      el.addEventListener('change',applyFilters);
    });
    applyFilters();
  }

  const observer=new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(bind,30);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  setInterval(bind,500);
  window.addEventListener('load',bind);
})();
