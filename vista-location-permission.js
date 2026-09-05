/* QUIMFLUX Inventario - permisos de edición de ubicación */
(function(){
  let busy=false;
  async function protect(){
    const form=document.querySelector('#vista20-location');
    if(!form||form.dataset.permissionChecked||busy||typeof sb==='undefined'||!state?.session?.user?.id)return;
    busy=true;
    const {data}=await sb.from('profiles').select('role').eq('id',state.session.user.id).maybeSingle();
    const canEdit=['ADMIN','SUPERVISOR'].includes(data?.role);
    form.dataset.permissionChecked='1';
    if(!canEdit){
      form.querySelectorAll('input').forEach(x=>x.disabled=true);
      const button=form.querySelector('button[type="submit"]');
      if(button)button.remove();
      const note=document.createElement('div');note.className='sub';note.style.marginTop='8px';note.textContent='Solo Administrador o Supervisor puede modificar la ubicación.';form.appendChild(note);
    }
    busy=false;
  }
  setInterval(protect,300);
})();
