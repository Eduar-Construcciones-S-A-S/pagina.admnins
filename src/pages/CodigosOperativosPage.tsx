import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { getPlanes } from "../services/api.service";
import { getRestaurantesActivos } from "../services/restaurante.service";
import {
  createCodigoOperativo,
  deleteCodigoOperativo,
  getCodigosOperativos,
  updateCodigoOperativo,
  type CodigoOperativo,
} from "../services/codigoOperativo.service";
import "../styles/codigos-operativos.css";

type Plan = { id_plan: number; nombre_plan: string };
type FormState = {
  codigo_ch: string;
  descripcion: string;
  id_plan: number | "";
  incluye_almuerzo: boolean;
  restaurante: string;
  prioridad: number;
  activo: boolean;
};

const emptyForm = (): FormState => ({
  codigo_ch: "CH",
  descripcion: "",
  id_plan: "",
  incluye_almuerzo: false,
  restaurante: "",
  prioridad: 10,
  activo: true,
});

export default function CodigosOperativosPage() {
  const [codigos, setCodigos] = useState<CodigoOperativo[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [restaurantes, setRestaurantes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CodigoOperativo | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [c, p, r] = await Promise.all([getCodigosOperativos(), getPlanes(), getRestaurantesActivos()]);
      setCodigos(c); setPlanes(p as Plan[]); setRestaurantes(r);
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar los códigos operativos.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return codigos;
    return codigos.filter((c) => [c.codigo_ch, c.descripcion, c.plan?.nombre_plan, c.restaurante].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [codigos, search]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setError(null); };
  const openEdit = (c: CodigoOperativo) => {
    setEditing(c);
    setForm({ codigo_ch: c.codigo_ch, descripcion: c.descripcion, id_plan: c.id_plan ?? "", incluye_almuerzo: !!c.incluye_almuerzo, restaurante: c.restaurante ?? "", prioridad: c.prioridad, activo: c.activo });
    setError(null);
  };

  const save = async () => {
    const code = form.codigo_ch.trim().toUpperCase();
    if (!/^CH\d{3}$/.test(code)) { setError("El código debe tener formato CH000, por ejemplo CH034."); return; }
    if (!form.descripcion.trim()) { setError("Escribe la descripción del código."); return; }
    if (form.incluye_almuerzo && !form.restaurante && !confirm("Este CH incluye almuerzo pero no tiene restaurante específico. Se usará como variante general para ese plan. ¿Continuar?")) return;
    setSaving(true); setError(null);
    try {
      const payload = { codigo_ch: code, descripcion: form.descripcion, id_plan: form.id_plan === "" ? null : Number(form.id_plan), incluye_almuerzo: form.incluye_almuerzo, restaurante: form.incluye_almuerzo ? form.restaurante || null : null, prioridad: form.prioridad, activo: form.activo };
      if (editing) await updateCodigoOperativo(editing.id_codigo_operativo, payload);
      else await createCodigoOperativo(payload);
      setEditing(null); setForm(emptyForm()); await load();
    } catch (e: any) { setError(e?.message || "No fue posible guardar el código."); }
    finally { setSaving(false); }
  };

  const remove = async (c: CodigoOperativo) => {
    if (!confirm(`¿Eliminar ${c.codigo_ch}? Si ya está vinculado a reservas es mejor desactivarlo en lugar de borrarlo.`)) return;
    try { await deleteCodigoOperativo(c.id_codigo_operativo); await load(); }
    catch (e: any) { setError(e?.message || "No fue posible eliminar el código. Puedes desactivarlo."); }
  };

  return <div className="co-page">
    <div className="co-head"><div><span>Configuración administrativa</span><h1>Códigos operativos</h1><p>Vincula cada CH con su plan y, cuando aplique, con almuerzo y restaurante.</p></div><button onClick={load}><RefreshCw size={16}/> Actualizar</button></div>
    {error && <div className="co-error">{error}</div>}

    <section className="co-editor">
      <div className="co-editor-title"><div><strong>{editing ? `Editar ${editing.codigo_ch}` : "Nuevo código CH"}</strong><small>El consecutivo completo se genera automáticamente al aprobar la reserva.</small></div>{editing && <button className="co-icon" onClick={openNew}><X size={16}/></button>}</div>
      <div className="co-form">
        <label><span>Código CH</span><input value={form.codigo_ch} maxLength={5} onChange={(e) => setForm({...form, codigo_ch:e.target.value.toUpperCase()})} placeholder="CH034"/></label>
        <label className="wide"><span>Descripción</span><input value={form.descripcion} onChange={(e) => setForm({...form, descripcion:e.target.value})} placeholder="Nombre operativo"/></label>
        <label><span>Plan vinculado</span><select value={form.id_plan} onChange={(e) => setForm({...form,id_plan:e.target.value ? Number(e.target.value) : ""})}><option value="">Sin vincular</option>{planes.map((p) => <option key={p.id_plan} value={p.id_plan}>{p.nombre_plan}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={form.incluye_almuerzo} onChange={(e) => setForm({...form,incluye_almuerzo:e.target.checked,restaurante:e.target.checked?form.restaurante:""})}/><span>Incluye almuerzo</span></label>
        <label><span>Restaurante</span><select disabled={!form.incluye_almuerzo} value={form.restaurante} onChange={(e) => setForm({...form,restaurante:e.target.value})}><option value="">General / sin restaurante específico</option>{restaurantes.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <label><span>Prioridad</span><input inputMode="numeric" value={form.prioridad} onChange={(e) => setForm({...form,prioridad:Number(e.target.value.replace(/\D/g,""))||0})}/></label>
        <label className="check"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({...form,activo:e.target.checked})}/><span>Activo</span></label>
        <button className="co-save" onClick={save} disabled={saving}>{editing?<Save size={16}/>:<Plus size={16}/>} {saving?"Guardando…":editing?"Guardar cambios":"Crear código"}</button>
      </div>
    </section>

    <section className="co-list">
      <div className="co-list-head"><div><strong>Códigos registrados</strong><small>{codigos.length} configurados · {codigos.filter(c=>c.activo).length} activos</small></div><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar CH, plan, restaurante…"/></div>
      <div className="co-table-wrap"><table><thead><tr><th>CH</th><th>Descripción</th><th>Plan</th><th>Almuerzo</th><th>Restaurante</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{loading?<tr><td colSpan={7}>Cargando…</td></tr>:filtered.map((c)=><tr key={c.id_codigo_operativo}><td><b>{c.codigo_ch}</b></td><td>{c.descripcion}</td><td>{c.plan?.nombre_plan || <span className="co-warning">Sin vincular</span>}</td><td>{c.incluye_almuerzo?"Sí":"No"}</td><td>{c.restaurante||"—"}</td><td><span className={c.activo?"co-on":"co-off"}>{c.activo?"Activo":"Inactivo"}</span></td><td><div className="co-actions"><button onClick={()=>openEdit(c)}><Pencil size={15}/></button><button onClick={()=>remove(c)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
