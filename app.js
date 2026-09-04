const { createClient } = window.supabase;
const sb = createClient(INVENTORY_CONFIG.supabaseUrl, INVENTORY_CONFIG.supabaseKey);
const state = { view:'overview', items:[], categories:[], movements:[], session:null };
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('es-PE',{maximumFractionDigits:3});
const label=s=>({SUFFICIENT:'Suficiente',LOW:'Stock bajo',CRITICAL:'Reponer'}[s]||s);
const cls=s=>({SUFFICIENT:'ok',LOW:'low',CRITICAL:'critical'}[s]||'ok');

// QUIMFLUX usa siempre la hora oficial de Lima (UTC-5).
const LIMA_TZ='America/Lima';
function limaParts(date=new Date()){
  const p={};
  new Intl.DateTimeFormat('en-CA',{timeZone:LIMA_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).forEach(x=>{if(x.type!=='literal')p[x.type]=x.value});
  return p;
}
function limaNowInput(){const p=limaParts();return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
function limaInputToISO(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if(!m)return new Date().toISOString();
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-05:00`).toISOString();
}
function limaInputFromISO(iso){
  const p=limaParts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function limaDisplay(iso){return new Date(iso).toLocaleString('es-PE',{timeZone:LIMA_TZ});}

async function init(){
  const {data:{session}}=await sb.auth.getSession(); state.session=session;
  if(!session){loginView();return;}
  await load(); shell();
  sb.auth.onAuthStateChange((_e,s)=>{state.session=s;if(!s)loginView();});
}
function loginView(){document.body.innerHTML=`<div class="login-shell"><div class="login-card"><img src="assets/quimflux-logo.svg" class="login-logo" alt="QUIMFLUX"><div class="eyebrow">GESTIÓN DE INVENTARIO</div><h1>Bienvenido</h1><p class="login-sub">Consulta existencias y registra entradas y salidas.</p><form id="login"><div class="field"><label>Correo electrónico</label><input class="form-control" id="email" type="email" required></div><div class="field"><label>Contraseña</label><input class="form-control" id="password" type="password" minlength="6" required></div><button class="btn btn-primary" style="width:100%;margin-top:8px">Ingresar</button></form><div id="login-msg" class="login-msg"></div><button id="signup" class="text-btn">Crear una cuenta</button></div></div>`;$('#login').onsubmit=login;$('#signup').onclick=signup;}
async function login(e){e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error)$('#login-msg').textContent=error.message;else init();}
async function signup(){const email=$('#email').value.trim(),password=$('#password').value;if(password.length<6){$('#login-msg').textContent='La contraseña debe tener al menos 6 caracteres.';return;}const {error}=await sb.auth.signUp({email,password});$('#login-msg').textContent=error?error.message:'Cuenta creada. Revisa tu correo si se solicita confirmación.';}
async function load(){const [c,i,m]=await Promise.all([sb.from('categories').select('*').eq('active',true).order('name'),sb.from('inventory_overview').select('*').eq('active',true).order('name'),sb.from('movements').select('*,items(code,name)').order('movement_date',{ascending:false}).limit(200)]);const err=c.error||i.error||m.error;if(err){toast(err.message,true);return;}state.categories=c.data||[];state.items=i.data||[];state.movements=m.data||[];}
function shell(){document.body.innerHTML=`<div id="app"><aside class="sidebar"><div class="brand"><img src="assets/quimflux-logo.svg" alt="QUIMFLUX"><div><strong>INVENTARIO</strong><span>Control de existencias</span></div></div><nav id="nav"><button class="nav-item active" data-view="overview">▦ <span>Vista general</span></button><button class="nav-item" data-view="entries">＋ <span>Entradas</span></button><button class="nav-item" data-view="exits">− <span>Salidas</span></button><button class="nav-item" data-view="alerts">⚠ <span>Reposición</span></button><button class="nav-item" data-view="movements">↕ <span>Movimientos</span></button></nav><div class="sidebar-footer"><span class="status-dot"></span> Sistema conectado<br><button id="logout" class="text-btn" style="margin-top:10px">Cerrar sesión</button></div></aside><main class="main"><header class="topbar"><div><p class="eyebrow">GESTIÓN DE INVENTARIO</p><h1 id="page-title">Vista general</h1></div><button class="mobile-menu" id="mobile">☰</button><div class="top-actions"><button class="icon-btn" id="refresh">↻</button><div class="user-pill"><span>${esc((state.session?.user?.email||'A')[0].toUpperCase())}</span><div><b>${esc(state.session?.user?.email||'Administrador')}</b><small>QUIMFLUX</small></div></div></div></header><section id="content" class="content"></section></main></div><div id="modal" class="modal hidden"><div class="modal-card"><button class="close" id="close">×</button><div id="modal-content"></div></div></div><div id="toast" class="toast"></div>`;$('#nav').onclick=e=>{const b=e.target.closest('[data-view]');if(!b)return;state.view=b.dataset.view;document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===b));$('#page-title').textContent={overview:'Vista general',entries:'Entradas',exits:'Salidas',alerts:'Reposición',movements:'Movimientos'}[state.view];view();$('.sidebar').classList.remove('open')};$('#refresh').onclick=async()=>{await load();view();toast('Inventario actualizado')};$('#logout').onclick=()=>sb.auth.signOut();$('#mobile').onclick=()=>$('.sidebar').classList.toggle('open');$('#close').onclick=closeModal;view();}
function view(){if(state.view==='overview')overview();if(state.view==='entries')movement('ENTRY');if(state.view==='exits')movement('EXIT');if(state.view==='alerts')alerts();if(state.view==='movements')movements();}
function overview(){const total=state.items.length,units=state.items.reduce((a,i)=>a+Number(i.current_stock),0),low=state.items.filter(i=>i.stock_status==='LOW').length,crit=state.items.filter(i=>i.stock_status==='CRITICAL').length;$('#content').innerHTML=`<div class="cards"><div class="card"><div class="label">Artículos activos</div><div class="value">${total}</div><div class="sub">Catálogo actual</div></div><div class="card"><div class="label">Unidades en stock</div><div class="value">${fmt(units)}</div><div class="sub">Existencia total</div></div><div class="card"><div class="label">Stock bajo</div><div class="value warning">${low}</div><div class="sub">Por debajo del mínimo</div></div><div class="card"><div class="label">Reponer</div><div class="value danger">${crit}</div><div class="sub">Sin stock o crítico</div></div></div><div class="toolbar"><div class="search"><input id="q" placeholder="Buscar por código, nombre o descripción..."></div><select id="cat" class="control"><option value="">Todas las categorías</option>${state.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><select id="st" class="control"><option value="">Todos los estados</option><option value="SUFFICIENT">Suficiente</option><option value="LOW">Stock bajo</option><option value="CRITICAL">Reponer</option></select><button class="btn btn-primary" id="new">＋ Nuevo artículo</button></div><div class="panel"><div class="panel-head"><h2>Inventario general</h2><span class="sub" id="count"></span></div><div class="table-wrap"><table><thead><tr><th>Código</th><th>Categoría</th><th>Bien</th><th>Unidad</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody id="body"></tbody></table></div></div>`;const paint=()=>{const q=$('#q').value.toLowerCase(),cat=$('#cat').value,st=$('#st').value,rows=state.items.filter(i=>(!q||`${i.code} ${i.name} ${i.description||''}`.toLowerCase().includes(q))&&(!cat||i.category_id===cat)&&(!st||i.stock_status===st));$('#count').textContent=`${rows.length} artículo${rows.length===1?'':'s'}`;$('#body').innerHTML=rows.length?rows.map(i=>`<tr><td><b>${esc(i.code)}</b></td><td>${esc(i.category_name)}</td><td>${esc(i.name)}<div class="sub">${esc(i.description||'')}</div></td><td>${esc(i.unit)}</td><td><b>${fmt(i.current_stock)}</b></td><td>${fmt(i.minimum_stock)}</td><td><span class="badge ${cls(i.stock_status)}">${label(i.stock_status)}</span></td></tr>`).join(''):`<tr><td colspan="7"><div class="empty"><strong>No hay resultados</strong>Ajusta los filtros o crea un artículo nuevo.</div></td></tr>`};['q','cat','st'].forEach(id=>$('#'+id).oninput=$('#'+id).onchange=paint);paint();$('#new').onclick=newItem;}

// Generación de códigos del catálogo. Solo estas tres categorías son manuales.
const MANUAL_CODE_CATEGORIES=['COPELAS','CRISOLES','ESCORIFICADORES'];
function normalizeText(value){return String(value||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function getSelectedCategory(categoryId){return (state.categories||[]).find(c=>String(c.id)===String(categoryId));}
function isManualCodeCategory(categoryId){const c=getSelectedCategory(categoryId);const name=normalizeText(c?.name);return MANUAL_CODE_CATEGORIES.includes(name);}
function nextAutomaticCode(categoryId){
  const category=getSelectedCategory(categoryId);
  const prefix=normalizeText(category?.code);
  if(!prefix)return '';
  const safePrefix=prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('^'+safePrefix+'[-_/ ]?(\\d+)$','i');
  let max=-1,width=3;
  (state.items||[]).forEach(item=>{
    const itemCategory=normalizeText(item.category_code);
    if(itemCategory && itemCategory!==prefix)return;
    const code=String(item.code||'').trim().toUpperCase();
    const match=code.match(re);
    if(!match)return;
    const n=Number(match[1]);
    if(Number.isFinite(n)&&n>max){max=n;width=Math.max(3,match[1].length);}
  });
  return `${prefix}-${String(max+1).padStart(width,'0')}`;
}
function updateNewItemCode(form){
  if(!form)return;
  const category=form.querySelector('[name="category_id"]');
  const code=form.querySelector('[name="code"]');
  const label=code?.closest('.field')?.querySelector('label');
  if(!category||!code)return;
  if(isManualCodeCategory(category.value)){
    code.readOnly=false;
    code.removeAttribute('title');
    code.style.background='';
    code.style.cursor='';
    if(label)label.textContent='Código *';
    code.value='';
    return;
  }
  code.readOnly=true;
  code.title='Código generado automáticamente según la categoría';
  code.style.background='#f3f4f6';
  code.style.cursor='not-allowed';
  if(label)label.innerHTML='Código * <span style="font-size:11px;font-weight:500;opacity:.7">(automático)</span>';
  code.value=nextAutomaticCode(category.value);
}
function newItem(){
  $('#modal-content').innerHTML=`<h2>Nuevo artículo</h2><p class="modal-sub">Define el código, categoría y stock mínimo.</p><form id="item-form"><div class="form-grid"><div class="field"><label>Código *</label><input class="form-control" name="code" placeholder="MAT-001" required></div><div class="field"><label>Categoría *</label><select class="form-control" name="category_id" required>${state.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Nombre *</label><input class="form-control" name="name" required></div><div class="field"><label>Unidad</label><input class="form-control" name="unit" value="UND"></div><div class="field"><label>Stock inicial</label><input class="form-control" name="initial" type="number" min="0" step="0.001" value="0"></div><div class="field"><label>Stock mínimo</label><input class="form-control" name="minimum" type="number" min="0" step="0.001" value="0"></div><div class="field full"><label>Descripción</label><textarea class="form-control" name="description" rows="3"></textarea></div></div><div class="form-actions"><button type="button" class="btn btn-secondary" id="cancel">Cancelar</button><button class="btn btn-primary">Guardar artículo</button></div></form>`;
  openModal();
  $('#cancel').onclick=closeModal;
  const form=$('#item-form');
  const category=form.querySelector('[name="category_id"]');
  category.addEventListener('change',()=>updateNewItemCode(form));
  updateNewItemCode(form);
  form.onsubmit=createItem;
}
async function createItem(e){e.preventDefault();const f=new FormData(e.target),initial=Number(f.get('initial')||0);const {data,error}=await sb.from('items').insert({code:f.get('code').trim().toUpperCase(),category_id:f.get('category_id'),name:f.get('name').trim(),description:f.get('description')||null,unit:(f.get('unit')||'UND').trim().toUpperCase(),current_stock:0,minimum_stock:Number(f.get('minimum')||0)}).select().single();if(error){toast(error.message,true);return;}if(initial>0){const {error:me}=await sb.from('movements').insert({item_id:data.id,movement_type:'ENTRY',quantity:initial,notes:'Stock inicial'});if(me){toast(me.message,true);return;}}closeModal();await load();view();toast('Artículo creado correctamente');}
function movement(type){const entry=type==='ENTRY';$('#content').innerHTML=`<div class="panel"><div class="panel-head"><div><h2>${entry?'Registrar entrada':'Registrar salida'}</h2><div class="sub">${entry?'La cantidad ingresada se suma automáticamente.':'La cantidad se descuenta y no puede superar el stock disponible.'}</div></div></div><form id="movement-form"><div class="form-grid"><div class="field full"><label>Artículo *</label><select class="form-control" name="item_id" required><option value="">Selecciona un artículo...</option>${state.items.map(i=>`<option value="${esc(i.id)}">${esc(i.code)} — ${esc(i.name)} | stock ${fmt(i.current_stock)} ${esc(i.unit)}</option>`).join('')}</select></div><div class="field"><label>Cantidad *</label><input class="form-control" name="quantity" type="number" min="0.001" step="0.001" required></div><div class="field"><label>Fecha y hora (Lima)</label><input class="form-control" name="date" type="datetime-local" value="${limaNowInput()}"></div>${entry?'<div class="field"><label>Proveedor</label><input class="form-control" name="supplier"></div><div class="field"><label>Documento</label><input class="form-control" name="document"></div>':'<div class="field"><label>Destino</label><input class="form-control" name="destination"></div><div class="field"><label>Responsable</label><input class="form-control" name="responsible"></div>'}<div class="field full"><label>Observación</label><textarea class="form-control" name="notes" rows="3"></textarea></div></div><div class="form-actions"><button type="reset" class="btn btn-secondary">Limpiar</button><button class="btn btn-primary">${entry?'Registrar entrada':'Registrar salida'}</button></div></form></div>`;$('#movement-form').onsubmit=e=>saveMovement(e,type);}
async function saveMovement(e,type){e.preventDefault();const f=new FormData(e.target),item=state.items.find(i=>i.id===f.get('item_id')),qty=Number(f.get('quantity'));if(!item)return;if(type==='EXIT'&&qty>Number(item.current_stock)){toast(`Stock insuficiente. Disponible: ${fmt(item.current_stock)} ${item.unit}`,true);return;}const p={item_id:item.id,movement_type:type,quantity:qty,movement_date:limaInputToISO(f.get('date')),notes:f.get('notes')||null};if(type==='ENTRY'){p.supplier=f.get('supplier')||null;p.document_number=f.get('document')||null}else{p.destination=f.get('destination')||null;p.responsible=f.get('responsible')||null}const {error}=await sb.from('movements').insert(p);if(error){toast(error.message,true);return;}await load();view();toast(type==='ENTRY'?'Entrada registrada':'Salida registrada');}
function alerts(){const rows=state.items.filter(i=>i.stock_status!=='SUFFICIENT');$('#content').innerHTML=`<div class="panel"><div class="panel-head"><div><h2>Centro de reposición</h2><div class="sub">Artículos que necesitan atención.</div></div><span class="badge ${rows.length?'critical':'ok'}">${rows.length} pendientes</span></div><div class="alert-list">${rows.length?rows.map(i=>`<div class="alert-row ${i.stock_status==='CRITICAL'?'critical-row':'low-row'}"><div><b>${esc(i.code)} — ${esc(i.name)}</b><div class="alert-meta">${esc(i.category_name)} · Stock ${fmt(i.current_stock)} ${esc(i.unit)} · Mínimo ${fmt(i.minimum_stock)}</div></div><span class="badge ${cls(i.stock_status)}">${label(i.stock_status)}</span></div>`).join(''):`<div class="empty"><strong>Sin pendientes</strong>Todo el inventario está por encima del mínimo.</div>`}</div></div>`;}
function movements(){const rows=state.movements;$('#content').innerHTML=`<div class="panel"><div class="panel-head"><div><h2>Historial de movimientos</h2><div class="sub">Últimos movimientos registrados.</div></div></div><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Código</th><th>Bien</th><th>Cantidad</th><th>Detalle</th><th>Acciones</th></tr></thead><tbody>${rows.length?rows.map(m=>`<tr><td>${esc(limaDisplay(m.movement_date))}</td><td><span class="badge ${m.movement_type==='ENTRY'?'ok':'low'}">${m.movement_type==='ENTRY'?'Entrada':'Salida'}</span></td><td><b>${esc(m.items?.code||'')}</b></td><td>${esc(m.items?.name||'')}</td><td>${fmt(m.quantity)}</td><td>${esc(m.supplier||m.destination||m.document_number||m.responsible||m.notes||'—')}</td><td></td></tr>`).join(''):`<tr><td colspan="7"><div class="empty"><strong>Sin movimientos</strong>Aún no hay entradas o salidas registradas.</div></td></tr>`}</tbody></table></div></div>`;}
function openModal(){$('#modal').classList.remove('hidden');}
function closeModal(){$('#modal').classList.add('hidden');$('#modal-content').innerHTML='';}
function toast(msg,error=false){const t=$('#toast');if(!t)return;t.textContent=msg;t.className=`toast ${error?'error':''}`;clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.className='toast',3500);}
init();
