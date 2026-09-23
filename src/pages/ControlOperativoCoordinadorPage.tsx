import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { getControlOperativo, type ControlOperativoRow } from "../services/controlOperativo.service";
import "../styles/control-operativo.css";
import "../styles/control-operativo-estados.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;
const dateOnly = (value: string) => String(value || "").slice(0, 10);
const hourOnly = (value: string) => String(value || "").slice(0, 5);
const todayBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

export default function ControlOperativoCoordinadorPage() {
  const [rows, setRows] = useState<ControlOperativoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [fecha, setFecha] = useState(todayBogota());

  const load = async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setRows(await getControlOperativo());
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar el control operativo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const reservas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const unique = [...new Map(rows.map((row) => [row.id_reserva, row])).values()];
    return unique.filter((row) => {
      if (fecha && dateOnly(row.fecha) !== fecha) return false;
      if (!q) return true;
      return [
        row.reserva_codigo,
        row.plan,
        row.nombre,
        row.contacto_cliente,
        row.restaurante,
        row.estado_operativo,
      ].join(" ").toLowerCase().includes(q);
    });
  }, [rows, search, fecha]);

  const personas = reservas.reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
  const pendiente = reservas.reduce((sum, row) => sum + Number(row.saldo_pendiente || 0), 0);

  return (
    <div className="op-page">
      <div className="op-page-head">
        <div>
          <h1>Control Operativo</h1>
          <p>Vista de consulta para coordinación. Los cambios operativos permanecen a cargo de Administración y Atención.</p>
        </div>
        <button className="op-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="op-page-error">{error}</div>}

      <div className="op-summary-grid">
        <div><span>Reservas</span><strong>{reservas.length}</strong></div>
        <div><span>Personas</span><strong>{personas}</strong></div>
        <div><span>Saldo pendiente</span><strong>{money(pendiente)}</strong></div>
      </div>

      <div className="op-filter-bar">
        <label>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <div className="op-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar reserva, plan, cliente…" /></div>
      </div>

      <div className="op-table-wrap">
        <table className="op-table">
          <thead>
            <tr>
              <th>Reserva</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Plan</th>
              <th>Personas</th>
              <th>Cliente / encargado</th>
              <th>Restaurante</th>
              <th>Estado</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}>Cargando control operativo…</td></tr>
            ) : reservas.length === 0 ? (
              <tr><td colSpan={9}>No hay reservas para los filtros seleccionados.</td></tr>
            ) : reservas.map((row) => (
              <tr key={row.id_reserva}>
                <td><strong>{row.reserva_codigo}</strong></td>
                <td>{dateOnly(row.fecha) || "—"}</td>
                <td>{hourOnly(row.hora) || "—"}</td>
                <td>{row.plan || "—"}</td>
                <td>{row.cantidad ?? "—"}</td>
                <td>{row.nombre || "—"}</td>
                <td>{row.restaurante || "—"}</td>
                <td><span className={`op-status-badge status-${row.estado_operativo}`}>{row.estado_operativo || "programada"}</span></td>
                <td className={row.saldo_pendiente > 0 ? "pending-money" : "paid-money"}>{money(row.saldo_pendiente)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
