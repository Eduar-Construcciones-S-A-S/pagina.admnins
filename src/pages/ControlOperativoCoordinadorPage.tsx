import { useEffect, useMemo, useState } from "react";
import { Filter, RefreshCw, Search, X } from "lucide-react";
import { getControlOperativo, type ControlOperativoRow } from "../services/controlOperativo.service";
import "../styles/control-operativo.css";
import "../styles/control-operativo-estados.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;
const dateOnly = (value: string) => String(value || "").slice(0, 10);
const hourOnly = (value: string) => String(value || "").slice(0, 5);
const todayBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

const estadoLabel = (value?: string | null) => {
  const key = String(value || "programada");
  const labels: Record<string, string> = {
    programada: "Programada",
    asistio: "Asistió",
    no_asistio: "No asistió",
    cancelada: "Cancelada",
    reprogramada: "Reprogramada",
  };
  return labels[key] || key.replaceAll("_", " ");
};

export default function ControlOperativoCoordinadorPage() {
  const [rows, setRows] = useState<ControlOperativoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [fecha, setFecha] = useState(todayBogota());
  const [estado, setEstado] = useState("");
  const [plan, setPlan] = useState("");

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

  const uniqueRows = useMemo(
    () => [...new Map(rows.map((row) => [row.id_reserva, row])).values()],
    [rows],
  );

  const plans = useMemo(
    () => [...new Set(uniqueRows.map((row) => row.plan).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es")),
    [uniqueRows],
  );

  const reservas = useMemo(() => {
    const q = search.trim().toLowerCase();

    return uniqueRows.filter((row) => {
      if (fecha && dateOnly(row.fecha) !== fecha) return false;
      if (estado && String(row.estado_operativo || "programada") !== estado) return false;
      if (plan && row.plan !== plan) return false;

      if (!q) return true;

      return [
        row.reserva_codigo,
        row.plan,
        row.nombre,
        row.contacto_cliente,
        row.documento,
        row.restaurante,
        row.estado_operativo,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [uniqueRows, search, fecha, estado, plan]);

  const personas = reservas.reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
  const pendiente = reservas
    .filter((row) => row.estado_operativo !== "cancelada")
    .reduce((sum, row) => sum + Number(row.saldo_pendiente || 0), 0);

  const clear = () => {
    setSearch("");
    setFecha("");
    setEstado("");
    setPlan("");
  };

  if (loading) {
    return <div className="op-loading">Cargando control operativo…</div>;
  }

  return (
    <div className="op-page">
      <div className="op-head">
        <div>
          <h1>Control Operativo</h1>
          <p>Consulta de reservas y operación para Coordinación. Esta vista es de solo lectura.</p>
        </div>

        <div className="op-head-actions">
          <button className="op-btn secondary" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} />
            Actualizar
          </button>
        </div>
      </div>

      {error && <div className="op-error">{error}</div>}

      <div className="op-filters op-filters-coordinator">
        <div className="op-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código, cliente, documento, plan…"
          />
        </div>

        <label>
          <span>Fecha reserva</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>

        <label>
          <span>Plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">Todos</option>
            {plans.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span>Estado operativo</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="programada">Programada</option>
            <option value="asistio">Asistió</option>
            <option value="no_asistio">No asistió</option>
            <option value="reprogramada">Reprogramada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>

        <button className="op-clear" onClick={clear}>
          <X size={14} />
          Limpiar
        </button>
      </div>

      <div className="op-summary">
        <span><Filter size={14} />{reservas.length} reservas</span>
        <span>Personas: <b>{personas}</b></span>
        <span>Saldo pendiente: <b>{money(pendiente)}</b></span>
        <span>Modo: <b>Solo lectura</b></span>
      </div>

      <div className="op-table-wrap">
        <table className="op-table op-table-coordinator">
          <thead>
            <tr>
              <th>Código</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Personas</th>
              <th>Cliente / encargado</th>
              <th>Restaurante</th>
              <th>Saldo</th>
            </tr>
          </thead>

          <tbody>
            {reservas.length === 0 ? (
              <tr>
                <td colSpan={9} className="op-coordinator-empty">
                  No hay reservas para los filtros seleccionados.
                </td>
              </tr>
            ) : reservas.map((row) => (
              <tr key={row.id_reserva} className={`status-row-${row.estado_operativo || "programada"}`}>
                <td><strong>{row.reserva_codigo}</strong></td>
                <td title={row.plan}>{row.plan || "—"}</td>
                <td>
                  <span className={`op-status-badge status-${row.estado_operativo || "programada"}`}>
                    {estadoLabel(row.estado_operativo)}
                  </span>
                </td>
                <td>{dateOnly(row.fecha) || "—"}</td>
                <td>{hourOnly(row.hora) || "—"}</td>
                <td>{row.cantidad ?? "—"}</td>
                <td title={row.nombre || row.contacto_cliente || "—"}>{row.nombre || row.contacto_cliente || "—"}</td>
                <td title={row.restaurante || "—"}>{row.restaurante || "—"}</td>
                <td className={Number(row.saldo_pendiente || 0) > 0 ? "pending-money" : "paid-money"}>
                  {money(Number(row.saldo_pendiente || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
