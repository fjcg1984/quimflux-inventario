/* QUIMFLUX Inventario - correcciones visuales seguras.
   Este archivo NO observa el DOM ni sobrescribe funciones de la aplicación. */
(function(){
  const style=document.createElement('style');
  style.id='quimflux-ui-fix-style';
  style.textContent=`
    .sidebar{overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;}
    .table-wrap{width:100%;max-width:100%;overflow-x:auto!important;overflow-y:visible;scrollbar-gutter:stable;}
    .table-wrap table{min-width:980px;}
    .modal{overflow:auto;align-items:center;}
    .modal-card{max-height:calc(100vh - 32px);overflow-y:auto;overflow-x:hidden;}
    #item-form .form-actions{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);z-index:2;}
    #item-form button[disabled]{opacity:.65;cursor:wait;}
  `;
  document.head.appendChild(style);
})();
