import { useEffect, useMemo, useRef, useState } from "react";
import { createPlan, deletePlan, getPlanes, updatePlan } from "../../services/api.service";
import { getCodigosOperativos, type CodigoOperativo } from "../../services/codigoOperativo.service";
import { getPlanTarifas, replacePlanTarifas, type PlanTarifa } from "../../services/planTarifa.service";
import PlanImage from "../common/PlanImage";
import "../../styles/planes.css";
import "../../styles/planes-tarifas.css";
import { supabase } from "../../lib/supabase";
import { Plus, Pencil, Trash2, Eye, Package, Search, X, ChevronLeft, ChevronRight, RefreshCw, MoreVertical, Upload, Calendar, Clock, Trash, Users, BadgeDollarSign } from "lucide-react";

interface PlanFecha { id_fecha?: number; id_plan?: number; fecha: string; }
interface PlanHora { id_hora?: number; id_plan?: number; hora: string; }
interface Plan {
  id_plan: number;
  nombre_plan: string;
  codigo_plan?: string | null;
  precio_plan?: number | null;
  descripcion_basica?: string | null;
  descripcion_detallada?: string | null;
  imagen_url?: string | null;
  numero_plan?: number | null;
  tipo_fecha: "cualquier_dia" | "fechas_especificas";
  tipo_hora: "sin_hora" | "hora_fija" | "varias_horas";
  plan_fechas?: PlanFecha[];
  plan_horas?: PlanHora[];
}

type PlanForm = Omit<Plan, "id_plan" | "codigo_plan">;
type TarifaForm = { semana1: number | null; semana23: number | null; semana4: number | null; finSemana: number | null };

const emptyPlan: PlanForm = { nombre_plan:"", precio_plan:null, descripcion_basica:null, descripcion_detallada:null, imagen_url:null, numero_plan:null, tipo_fecha:"cualquier_dia", tipo_hora:"sin_hora", plan_fechas:[], plan_horas:[] };
const emptyTarifas: TarifaForm = { semana1:null, semana23:null, semana4:null, finSemana:null };
const PAGE_SIZE_OPTIONS=[10,25,50];
const fmtPrecio=(v?:number|null)=>v==null?null:"$"+Number(v).toLocaleString("es-CO");
const numOrNull=(v:string)=>v===""?null:Number(v.replace(/[^0-9]/g,""));

export default function PlanesAdmin(){
  const [planes,setPlanes]=useState<Plan[]>([]);
  const [codigos,setCodigos]=useState<CodigoOperativo[]>([]);
  const [tarifas,setTarifas]=useState<PlanTarifa[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [pageSize,setPageSize]=useState(10);
  const [page,setPage]=useState(1);
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<Plan|null>(null);
  const [formData,setFormData]=useState<PlanForm>(emptyPlan);
  const [tarifaForm,setTarifaForm]=useState<TarifaForm>(emptyTarifas);
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [viewing,setViewing]=useState<Plan|null>(null);
  const [openMenu,setOpenMenu]=useState<number|null>(null);
  const fileInputRef=useRef<HTMLInputElement>(null);
  const menuRef=useRef<HTMLDivElement|null>(null);

  const fetchData=async()=>{
    try{
      const[p,c,t]=await Promise.all([getPlanes(),getCodigosOperativos(),getPlanTarifas()]);
      setPlanes(p as Plan[]); setCodigos(c); setTarifas(t);
    }catch(e){console.error(e)}finally{setLoading(false)}
  };
  useEffect(()=>{fetchData()},[]);
  useEffect(()=>{if(!supabase)return;const channel=supabase.channel("planes-admin").on("postgres_changes",{event:"*",schema:"public",table:"plan"},fetchData).on("postgres_changes",{event:"*",schema:"public",table:"plan_tarifa"},fetchData).on("postgres_changes",{event:"*",schema:"public",table:"codigo_operativo"},fetchData).subscribe();return()=>{supabase?.removeChannel(channel)}},[]);
  useEffect(()=>{if(openMenu==null)return;const handler=(e:MouseEvent)=>{if(menuRef.current&&!menuRef.current.contains(e.target as Node))setOpenMenu(null)};document.addEventListener("mousedown",handler);return()=>document.removeEventListener("mousedown",handler)},[openMenu]);

  const codigosPorPlan=useMemo(()=>{const map=new Map<number,CodigoOperativo[]>();for(const c of codigos){if(c.id_plan==null)continue;if(!map.has(c.id_plan))map.set(c.id_plan,[]);map.get(c.id_plan)!.push(c)}for(const[,list]of map)list.sort((a,b)=>a.codigo_ch.localeCompare(b.codigo_ch));return map},[codigos]);
  const tarifasPorPlan=useMemo(()=>{const map=new Map<number,PlanTarifa[]>();for(const t of tarifas){if(!map.has(t.id_plan))map.set(t.id_plan,[]);map.get(t.id_plan)!.push(t)}return map},[tarifas]);
  const codesFor=(id:number)=>codigosPorPlan.get(id)??[];
  const tariffsFor=(id:number)=>tarifasPorPlan.get(id)??[];
  const codeLabel=(c:CodigoOperativo)=>c.incluye_almuerzo?`${c.codigo_ch} · almuerzo${c.restaurante?` ${c.restaurante}`:""}`:`${c.codigo_ch} · sin almuerzo`;
  const tarifaBy=(id:number,tipo:string,min:number,max:number|null)=>tariffsFor(id).find(t=>t.tipo_dia===tipo&&t.personas_min===min&&(t.personas_max??null)===max)?.precio_persona??null;

  const openCreate=()=>{setEditing(null);setFormData(emptyPlan);setTarifaForm(emptyTarifas);setShowForm(true)};
  const openEdit=(plan:Plan)=>{
    setOpenMenu(null);setEditing(plan);
    setFormData({nombre_plan:plan.nombre_plan,precio_plan:plan.precio_plan??null,descripcion_basica:plan.descripcion_basica??null,descripcion_detallada:plan.descripcion_detallada??null,imagen_url:plan.imagen_url??null,numero_plan:plan.numero_plan??null,tipo_fecha:plan.tipo_fecha||"cualquier_dia",tipo_hora:plan.tipo_hora||"sin_hora",plan_fechas:plan.plan_fechas||[],plan_horas:plan.plan_horas||[]});
    const fallback=plan.precio_plan??null;
    setTarifaForm({semana1:tarifaBy(plan.id_plan,"semana",1,1)??fallback,semana23:tarifaBy(plan.id_plan,"semana",2,3)??fallback,semana4:tarifaBy(plan.id_plan,"semana",4,null)??fallback,finSemana:tarifaBy(plan.id_plan,"fin_semana",1,null)??fallback});
    setShowForm(true);
  };
  const openView=(plan:Plan)=>{setOpenMenu(null);setViewing(plan)};

  const handleFileUpload=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file||!supabase)return;setUploading(true);try{const ext=file.name.split(".").pop();const name=`${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`;const{error}=await supabase.storage.from("planes").upload(name,file,{cacheControl:"3600",upsert:false});if(error)throw error;const{data}=supabase.storage.from("planes").getPublicUrl(name);setFormData(p=>({...p,imagen_url:data.publicUrl}))}catch(e){console.error(e);alert("No se pudo subir la imagen.")}finally{setUploading(false)}};

  const validateTarifas=()=>{
    if(formData.tipo_fecha!=="cualquier_dia")return true;
    if([tarifaForm.semana1,tarifaForm.semana23,tarifaForm.semana4,tarifaForm.finSemana].some(v=>v==null||Number(v)<=0)){
      alert("Para un plan de cualquier día debes registrar los 4 precios: entre semana para 1 persona, 2–3 personas, 4 o más, y precio normal de fin de semana.");return false;
    }
    return true;
  };

  const handleSave=async()=>{
    if(!formData.nombre_plan.trim()){alert("El nombre del plan es obligatorio.");return}
    if(!validateTarifas())return;
    if(formData.tipo_fecha==="fechas_especificas"&&(!formData.plan_fechas||!formData.plan_fechas.length)){alert("Debe agregar al menos una fecha para el tipo de fecha específica.");return}
    if(formData.tipo_hora==="hora_fija"&&(!formData.plan_horas||formData.plan_horas.length!==1)){alert("Debe agregar exactamente una hora para el tipo de hora fija.");return}
    if(formData.tipo_hora==="varias_horas"&&(!formData.plan_horas||!formData.plan_horas.length)){alert("Debe agregar al menos una hora para el tipo de varias horas.");return}
    setSaving(true);
    try{
      const precioBase=formData.tipo_fecha==="cualquier_dia"?tarifaForm.finSemana:formData.precio_plan;
      const payload={...formData,precio_plan:precioBase,plan_fechas:formData.tipo_fecha==="fechas_especificas"?formData.plan_fechas:[],plan_horas:formData.tipo_hora!=="sin_hora"?formData.plan_horas:[]};
      const plan=editing?await updatePlan(editing.id_plan,payload):await createPlan(payload);
      if(formData.tipo_fecha==="cualquier_dia"){
        await replacePlanTarifas(plan.id_plan,[
          {personas_min:1,personas_max:1,precio_persona:Number(tarifaForm.semana1),tipo_dia:"semana",activo:true},
          {personas_min:2,personas_max:3,precio_persona:Number(tarifaForm.semana23),tipo_dia:"semana",activo:true},
          {personas_min:4,personas_max:null,precio_persona:Number(tarifaForm.semana4),tipo_dia:"semana",activo:true},
          {personas_min:1,personas_max:null,precio_persona:Number(tarifaForm.finSemana),tipo_dia:"fin_semana",activo:true},
        ]);
      }else await replacePlanTarifas(plan.id_plan,[]);
      setShowForm(false);await fetchData();
    }catch(e:any){console.error(e);alert(e?.message||"Ocurrió un error al guardar el plan.")}finally{setSaving(false)}
  };

  const handleDelete=async(plan:Plan)=>{setOpenMenu(null);if(!confirm(`¿Eliminar "${plan.nombre_plan}"?`))return;try{await deletePlan(plan.id_plan);await fetchData()}catch(e){console.error(e);alert("No se pudo eliminar el plan. Puede estar relacionado con reservas o códigos operativos.")}};
  const filtered=planes.filter(p=>{const q=search.toLowerCase().trim();const ch=codesFor(p.id_plan).map(c=>`${c.codigo_ch} ${c.descripcion} ${c.restaurante??""}`).join(" ").toLowerCase();return p.nombre_plan.toLowerCase().includes(q)||String(p.id_plan).includes(q)||String(p.numero_plan??"").includes(q)||(p.descripcion_basica??"").toLowerCase().includes(q)||ch.includes(q)});
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const paginated=filtered.slice((page-1)*pageSize,page*pageSize);
  const planesConCodigo=planes.filter(p=>codesFor(p.id_plan).some(c=>c.activo)).length;
  const codigosVinculados=codigos.filter(c=>c.id_plan!=null).length;
  const handleClear=()=>{setSearch("");setPage(1)};

  const Codes=({plan,compact=false}:{plan:Plan;compact?:boolean})=>{const list=codesFor(plan.id_plan);if(!list.length)return <span className="rv-null">Sin CH vinculado</span>;return <div style={{display:"flex",gap:5,flexWrap:"wrap",maxWidth:compact?260:360}}>{list.map(c=><span key={c.id_codigo_operativo} className={`badge ${c.activo?"badge-blue":"badge-gray"}`} title={codeLabel(c)}>{c.codigo_ch}{c.incluye_almuerzo?" 🍽️":""}</span>)}</div>};
  const PriceSummary=({plan}:{plan:Plan})=>{const ts=tariffsFor(plan.id_plan);if(plan.tipo_fecha!=="cualquier_dia"||!ts.length)return <span>{fmtPrecio(plan.precio_plan)??"—"}</span>;const p1=tarifaBy(plan.id_plan,"semana",1,1),p23=tarifaBy(plan.id_plan,"semana",2,3),p4=tarifaBy(plan.id_plan,"semana",4,null),fw=tarifaBy(plan.id_plan,"fin_semana",1,null);return <div className="plan-price-summary"><strong>Finde {fmtPrecio(fw)}</strong><small>L–V: 1p {fmtPrecio(p1)} · 2–3p {fmtPrecio(p23)} · 4+p {fmtPrecio(p4)}</small></div>};
  const ActionButtons=({plan}:{plan:Plan})=><div className="action-buttons"><button className="action-btn action-ver" onClick={()=>openView(plan)}><Eye size={15}/> Ver</button><button className="action-btn action-editar" onClick={()=>openEdit(plan)}><Pencil size={15}/> Editar</button><button className="action-btn action-eliminar" onClick={()=>handleDelete(plan)}><Trash2 size={15}/> Eliminar</button></div>;
  const ActionMenu=({plan}:{plan:Plan})=><div className="plan-card-menu" ref={openMenu===plan.id_plan?menuRef:undefined}><button className="plan-menu-trigger" onClick={()=>setOpenMenu(openMenu===plan.id_plan?null:plan.id_plan)}><MoreVertical size={18}/></button>{openMenu===plan.id_plan&&<div className="plan-menu-dropdown"><button onClick={()=>openView(plan)}><Eye size={15}/> Ver</button><button onClick={()=>openEdit(plan)}><Pencil size={15}/> Editar</button><button className="plan-menu-danger" onClick={()=>handleDelete(plan)}><Trash2 size={15}/> Eliminar</button></div>}</div>;

  return <div className="planes-page">
    <div className="planes-header"><div><h1 className="planes-title">Planes</h1><p className="planes-subtitle">Gestión de planes, tarifas por cantidad, precios y disponibilidad. Los CH se administran en Códigos operativos.</p></div><button className="btn-nuevo-plan" onClick={openCreate}><Plus size={16}/> Nuevo plan</button></div>
    <div className="planes-kpis"><div className="kpi-card line-blue"><div className="kpi-icon" style={{background:"#dbeafe",color:"#1e40af"}}><Package size={24}/></div><div className="kpi-info"><h3>{planes.length}</h3><p>Total planes</p></div></div><div className="kpi-card line-green"><div className="kpi-icon" style={{background:"#ecfdf5",color:"#0f766e"}}><Package size={24}/></div><div className="kpi-info"><h3>{planesConCodigo}</h3><p>Planes con CH · {codigosVinculados} códigos vinculados</p></div></div></div>
    <div className="planes-filter-bar"><div className="planes-search-wrap"><Search size={18} className="planes-search-icon"/><input className="planes-search-input" placeholder="Buscar por CH, nombre o descripción..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></div><div className="planes-filter-divider"/><button className="planes-clear-btn" onClick={handleClear}><X size={14}/> Limpiar</button><div className="planes-filter-divider"/><span className="planes-rows-label">Filas:</span><select className="planes-rows-select" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}>{PAGE_SIZE_OPTIONS.map(n=><option key={n} value={n}>{n}</option>)}</select><button onClick={fetchData} className="btn-refresh"><RefreshCw size={18}/></button></div>
    <div className="planes-table-wrap planes-desktop-only"><table className="planes-table"><thead><tr><th>N° PLAN</th><th>CÓDIGOS CH</th><th>PLAN</th><th>PRECIOS</th><th>FECHA</th><th>HORA</th><th>ACCIONES</th></tr></thead><tbody>{loading?<tr><td colSpan={7} style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Cargando...</td></tr>:paginated.length===0?<tr><td colSpan={7} style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Sin resultados</td></tr>:paginated.map(plan=><tr key={plan.id_plan}><td>{plan.numero_plan??<span className="rv-null">—</span>}</td><td><Codes plan={plan}/></td><td><div className="plan-name-cell"><PlanImage src={plan.imagen_url} alt={plan.nombre_plan} className="plan-thumb"/><div><div className="plan-name">{plan.nombre_plan}</div><div className="plan-desc-short">{plan.descripcion_basica??""}</div></div></div></td><td className="precio-cell"><PriceSummary plan={plan}/></td><td><div className="disp-badge-cell">{plan.tipo_fecha==="cualquier_dia"?<span className="badge badge-gray">Cualquier día</span>:<span className="badge badge-yellow">Fechas esp. ({plan.plan_fechas?.length||0})</span>}</div></td><td><div className="disp-badge-cell">{plan.tipo_hora==="sin_hora"?<span className="badge badge-gray">Sin hora</span>:plan.tipo_hora==="hora_fija"?<span className="badge badge-blue">Hora fija</span>:<span className="badge badge-teal">Varias ({plan.plan_horas?.length||0})</span>}</div></td><td><ActionButtons plan={plan}/></td></tr>)}</tbody></table><div className="planes-pagination"><span className="planes-pag-info">Mostrando {filtered.length===0?0:(page-1)*pageSize+1}–{Math.min(page*pageSize,filtered.length)} de {filtered.length}</span><div className="planes-pag-controls"><button className="planes-pag-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={15}/> Anterior</button><span className="planes-pag-current">Página {page} / {totalPages}</span><button className="planes-pag-btn" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Siguiente <ChevronRight size={15}/></button></div></div></div>
    <div className="planes-cards planes-mobile-only">{loading?<div className="plan-card-empty">Cargando...</div>:paginated.length===0?<div className="plan-card-empty">Sin resultados</div>:paginated.map(plan=><div className="plan-card" key={plan.id_plan}><div className="plan-card-top">{plan.imagen_url?<img src={plan.imagen_url} alt={plan.nombre_plan} className="plan-card-thumb"/>:<div className="plan-card-thumb-ph"><Package size={20}/></div>}<div className="plan-card-headtext"><span className="plan-card-id">#{plan.id_plan}</span><span className="plan-card-name">{plan.nombre_plan}</span><Codes plan={plan} compact/></div><ActionMenu plan={plan}/></div>{plan.descripcion_basica&&<p className="plan-card-desc">{plan.descripcion_basica}</p>}<div className="plan-card-meta"><div className="plan-card-meta-item"><span className="plan-card-meta-label">Precios</span><span className="plan-card-meta-value precio-cell"><PriceSummary plan={plan}/></span></div></div></div>)}</div>

    {viewing&&<div className="modal-overlay"><div className="modal-card"><div className="modal-header"><h2>Detalle del plan</h2><button className="modal-close" onClick={()=>setViewing(null)}><X size={20}/></button></div><div className="modal-body"><PlanImage src={viewing.imagen_url} alt={viewing.nombre_plan} className="modal-img"/><div className="modal-field"><label>Códigos operativos CH</label><div>{codesFor(viewing.id_plan).length?codesFor(viewing.id_plan).map(c=><div key={c.id_codigo_operativo} style={{marginBottom:5}}><strong>{c.codigo_ch}</strong> — {codeLabel(c)}</div>):"Sin CH vinculado"}</div></div><div className="modal-field"><label>Nombre</label><span>{viewing.nombre_plan}</span></div><div className="modal-field"><label>Tarifas</label><PriceSummary plan={viewing}/></div><div className="modal-field"><label>Descripción básica</label><span>{viewing.descripcion_basica||"—"}</span></div><div className="modal-field"><label>Descripción detallada</label><span>{viewing.descripcion_detallada||"—"}</span></div></div></div></div>}

    {showForm&&<div className="modal-overlay"><div className="modal-card plan-edit-modal"><div className="modal-header"><h2>{editing?"Editar plan":"Nuevo plan"}</h2><button className="modal-close" onClick={()=>!saving&&setShowForm(false)} disabled={saving}><X size={20}/></button></div><div className="modal-body"><div className="plan-info-note">Los códigos CH se vinculan desde <strong>Códigos operativos</strong>. Aquí configuras el plan, su disponibilidad y sus tarifas.</div><div className="form-group"><label>Descripción básica</label><textarea value={formData.descripcion_basica??""} onChange={e=>setFormData({...formData,descripcion_basica:e.target.value||null})} rows={3}/></div><div className="form-group"><label>Descripción detallada</label><textarea value={formData.descripcion_detallada??""} onChange={e=>setFormData({...formData,descripcion_detallada:e.target.value||null})} rows={4}/></div><div className="form-group"><label>Nombre *</label><input value={formData.nombre_plan} onChange={e=>setFormData({...formData,nombre_plan:e.target.value})}/></div><div className="form-row"><div className="form-group"><label>N° de plan</label><input type="number" value={formData.numero_plan??""} onChange={e=>setFormData({...formData,numero_plan:e.target.value?Number(e.target.value):null})}/></div>{formData.tipo_fecha!=="cualquier_dia"&&<div className="form-group"><label>Precio por persona (COP)</label><input inputMode="numeric" value={formData.precio_plan??""} onChange={e=>setFormData({...formData,precio_plan:numOrNull(e.target.value)})}/></div>}</div>

      <div className="form-section"><h3 className="section-title">Disponibilidad de fecha</h3><div className="radio-group"><label className="radio-label"><input type="radio" name="tipo_fecha" checked={formData.tipo_fecha==="cualquier_dia"} onChange={()=>setFormData({...formData,tipo_fecha:"cualquier_dia",plan_fechas:[]})}/><span>Cualquier día</span></label><label className="radio-label"><input type="radio" name="tipo_fecha" checked={formData.tipo_fecha==="fechas_especificas"} onChange={()=>setFormData({...formData,tipo_fecha:"fechas_especificas"})}/><span>Fechas específicas</span></label></div>{formData.tipo_fecha==="fechas_especificas"&&<div className="dynamic-list">{formData.plan_fechas?.map((f,idx)=><div key={idx} className="dynamic-item"><Calendar size={16} className="item-icon"/><input type="date" value={f.fecha} onChange={e=>{const n=[...(formData.plan_fechas||[])];n[idx].fecha=e.target.value;setFormData({...formData,plan_fechas:n})}}/><button type="button" className="btn-remove-item" onClick={()=>setFormData({...formData,plan_fechas:formData.plan_fechas?.filter((_,i)=>i!==idx)})}><Trash size={14}/></button></div>)}<button type="button" className="btn-add-item" onClick={()=>setFormData({...formData,plan_fechas:[...(formData.plan_fechas||[]),{fecha:""}]})}><Plus size={14}/> Agregar fecha</button></div>}</div>

      {formData.tipo_fecha==="cualquier_dia"&&<section className="tarifa-builder"><div className="tarifa-builder-head"><div className="tarifa-builder-icon"><BadgeDollarSign size={20}/></div><div><strong>Tarifas automáticas por cantidad</strong><small>Entre semana el precio cambia según cuántas personas van. Sábado y domingo usan el precio normal por persona.</small></div></div><div className="tarifa-grid"><label><span><Users size={14}/> Lunes a viernes · 1 persona</span><div className="money-input"><b>$</b><input inputMode="numeric" value={tarifaForm.semana1??""} onChange={e=>setTarifaForm({...tarifaForm,semana1:numOrNull(e.target.value)})} placeholder="Ej. 80000"/></div></label><label><span><Users size={14}/> Lunes a viernes · 2 o 3</span><div className="money-input"><b>$</b><input inputMode="numeric" value={tarifaForm.semana23??""} onChange={e=>setTarifaForm({...tarifaForm,semana23:numOrNull(e.target.value)})} placeholder="Precio por persona"/></div></label><label><span><Users size={14}/> Lunes a viernes · 4 o más</span><div className="money-input"><b>$</b><input inputMode="numeric" value={tarifaForm.semana4??""} onChange={e=>setTarifaForm({...tarifaForm,semana4:numOrNull(e.target.value)})} placeholder="Precio por persona"/></div></label><label className="weekend-price"><span><Calendar size={14}/> Sábado y domingo · precio normal</span><div className="money-input"><b>$</b><input inputMode="numeric" value={tarifaForm.finSemana??""} onChange={e=>setTarifaForm({...tarifaForm,finSemana:numOrNull(e.target.value)})} placeholder="Precio por persona"/></div></label></div><div className="tarifa-example">El sistema guardará este último valor también como <strong>precio base del plan</strong> para mantener compatibilidad con reservas y reportes existentes.</div></section>}

      <div className="form-section"><h3 className="section-title">Disponibilidad de hora</h3><div className="radio-group"><label className="radio-label"><input type="radio" name="tipo_hora" checked={formData.tipo_hora==="sin_hora"} onChange={()=>setFormData({...formData,tipo_hora:"sin_hora",plan_horas:[]})}/><span>Sin hora</span></label><label className="radio-label"><input type="radio" name="tipo_hora" checked={formData.tipo_hora==="hora_fija"} onChange={()=>setFormData({...formData,tipo_hora:"hora_fija",plan_horas:formData.plan_horas?.length?[formData.plan_horas[0]]:[{hora:""}]})}/><span>Hora fija</span></label><label className="radio-label"><input type="radio" name="tipo_hora" checked={formData.tipo_hora==="varias_horas"} onChange={()=>setFormData({...formData,tipo_hora:"varias_horas"})}/><span>Varias horas</span></label></div>{formData.tipo_hora!=="sin_hora"&&<div className="dynamic-list">{formData.plan_horas?.map((h,idx)=><div key={idx} className="dynamic-item"><Clock size={16} className="item-icon"/><input type="time" value={h.hora} onChange={e=>{const n=[...(formData.plan_horas||[])];n[idx].hora=e.target.value;setFormData({...formData,plan_horas:n})}}/>{formData.tipo_hora==="varias_horas"&&<button type="button" className="btn-remove-item" onClick={()=>setFormData({...formData,plan_horas:formData.plan_horas?.filter((_,i)=>i!==idx)})}><Trash size={14}/></button>}</div>)}{formData.tipo_hora==="varias_horas"&&<button type="button" className="btn-add-item" onClick={()=>setFormData({...formData,plan_horas:[...(formData.plan_horas||[]),{hora:""}]})}><Plus size={14}/> Agregar hora</button>}</div>}</div>
      <div className="form-group"><label>Imagen del plan</label><div className="image-upload-container">{formData.imagen_url?<div className="image-preview-wrap"><PlanImage src={formData.imagen_url} alt="Preview" className="image-preview"/><button type="button" className="btn-remove-image" onClick={()=>setFormData({...formData,imagen_url:null})}><X size={14}/></button></div>:<button type="button" className="btn-upload-placeholder" onClick={()=>fileInputRef.current?.click()} disabled={uploading}>{uploading?<RefreshCw size={24} className="spin"/>:<><Upload size={24}/><span>Subir imagen</span></>}</button>}<input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" style={{display:"none"}}/></div></div><div className="form-group"><label>O ingresar URL de imagen manualmente</label><input value={formData.imagen_url??""} onChange={e=>setFormData({...formData,imagen_url:e.target.value||null})}/></div></div><div className="modal-footer"><button className="btn-cancelar" onClick={()=>!saving&&setShowForm(false)} disabled={saving}>Cancelar</button><button className="btn-guardar" onClick={handleSave} disabled={saving}>{saving?"Guardando...":editing?"Guardar cambios":"Crear plan"}</button></div></div></div>}
  </div>;
}
