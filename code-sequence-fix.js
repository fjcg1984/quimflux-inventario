/* QUIMFLUX Inventario - la numeración automática comienza en 001 */
(function(){
  if(typeof window==='undefined' || typeof window.nextAutomaticCode!=='function') return;
  const original=window.nextAutomaticCode;
  window.nextAutomaticCode=function(categoryId){
    const code=original(categoryId);
    const match=String(code||'').match(/^(.*?)-(\d+)$/);
    if(!match)return code;
    const width=Math.max(3,match[2].length);
    const number=Math.max(1,Number(match[2]));
    return `${match[1]}-${String(number).padStart(width,'0')}`;
  };
})();
