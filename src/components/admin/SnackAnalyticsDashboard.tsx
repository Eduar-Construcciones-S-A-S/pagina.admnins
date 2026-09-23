import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Package, RefreshCw, ShoppingCart, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { getSnackAdminDashboard, type SnackAdminDashboard } from "../../services/snack.service";
import "../../styles/snacks.css";

type Props = {
  fromDate?: string;
  toDate?: string;
};

const EMPTY: SnackAdminDashboard = {
  ventas: 0,
  ingresos: 0,
  unidades: 0,
  costo_vendido: 0,
  ganancia_bruta: 0,
  margen: 0,
  ticket_promedio: 0,
  lineas_sin_costo: 0,
  costos_estimados: 0,
  retiros_unidades: 0,
  costo_retiros: 0,
  productos_activos: 0,
  stock_unidades: 0,
  capital_invertido: 0,
  valor_potencial_venta: 0,
  ganancia_potencial: 0,
  productos_sin_costo: 0,
  top_productos: [],
  metodos_pago: [],
};

const money = (value: number) => `$${Math.round(Number(value || 0)).toLocaleString("es-CO")}`;
const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const methodLabel = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

export default function SnackAnalyticsDashboard({ fromDate = "", toDate = "" }: Props) {
  const [data, setData] = useState<SnackAdminDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setData(await getSnackAdminDashboard(fromDate || null, toDate || null));
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar la analítica de snacks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30_000);
    const refresh = () => void load(true);
    window.addEventListener("snack-sale-recorded", refresh);
    window.addEventListener("snack-cost-changed", refresh);
    window.addEventListener("snack-stock-changed", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("snack-sale-recorded", refresh);
      window.removeEventListener("snack-cost-changed", refresh);
      window.removeEventListener("snack-stock-changed", refresh);
    };
  }, [load]);

  const mostProfitable = useMemo(
    () => [...data.top_productos].sort((a, b) => b.ganancia - a.ganancia)[0] ?? null,
    [data.top_productos],
  );

  const periodLabel = fromDate || toDate
    ? `${fromDate || "inicio"} a ${toDate || "hoy"}`
    : "Todo el histórico";

  return (
    <section className="snack-card" style={{ marginBottom: 18 }}>
      <div className="snack-card-title">
        <div>
          <ShoppingCart size={19} />
          <div>
            <strong style={{ display: "block" }}>Analítica de snacks</strong>
            <small style={{ display: "block", marginTop: 3, color: "#64748b", fontWeight: 500 }}>
              Rentabilidad, rotación, merma e inventario · {periodLabel}
            </small>
          </div>
        </div>
        <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? "spin-icon" : ""} />
          {refreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && <div className="snack-alert error">{error}</div>}
      {loading ? (
        <div className="snack-empty">Cargando métricas de snacks…</div>
      ) : (
        <>
          {(data.lineas_sin_costo > 0 || data.productos_sin_costo > 0) && (
            <div className="snack-alert error" style={{ marginBottom: 12 }}>
              Hay {data.productos_sin_costo} producto(s) sin precio de compra y {data.lineas_sin_costo} línea(s) de venta sin costo histórico.
              La ganancia mostrada puede estar incompleta hasta configurar esos costos.
            </div>
          )}

          <div className="snack-kpis">
            <div><span>Ventas snacks</span><b>{money(data.ingresos)}</b><small>{data.ventas} ventas · {data.unidades} unidades</small></div>
            <div><span>Ganancia bruta</span><b>{money(data.ganancia_bruta)}</b><small>{money(data.costo_vendido)} costo vendido</small></div>
            <div><span>Margen</span><b>{pct(data.margen)}</b><small>{data.costos_estimados ? `${data.costos_estimados} costos históricos estimados` : "Costos históricos registrados"}</small></div>
            <div><span>Ticket promedio</span><b>{money(data.ticket_promedio)}</b><small>Por venta de snacks</small></div>
            <div><span>Capital invertido</span><b>{money(data.capital_invertido)}</b><small>{data.stock_unidades} unidades en inventario</small></div>
            <div><span>Ganancia potencial</span><b>{money(data.ganancia_potencial)}</b><small>{money(data.valor_potencial_venta)} venta potencial</small></div>
            <div className={data.costo_retiros > 0 ? "warning" : ""}><span>Merma por retiros</span><b>{money(data.costo_retiros)}</b><small>{data.retiros_unidades} unidades retiradas</small></div>
            <div><span>Productos activos</span><b>{data.productos_activos}</b><small>{data.productos_sin_costo} sin costo configurado</small></div>
          </div>

          <div className="snack-kpis" style={{ marginTop: 12 }}>
            <div>
              <span><Trophy size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Más vendido</span>
              <b style={{ fontSize: 17 }}>{data.top_productos[0]?.nombre_producto || "Sin ventas"}</b>
              <small>{data.top_productos[0] ? `${data.top_productos[0].unidades} unidades · ${money(data.top_productos[0].ingresos)}` : "Sin datos"}</small>
            </div>
            <div>
              <span><TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Más rentable</span>
              <b style={{ fontSize: 17 }}>{mostProfitable?.nombre_producto || "Sin ventas"}</b>
              <small>{mostProfitable ? `${money(mostProfitable.ganancia)} de ganancia · ${pct(mostProfitable.margen)} margen` : "Sin datos"}</small>
            </div>
            <div>
              <span><Package size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Inventario</span>
              <b style={{ fontSize: 17 }}>{data.stock_unidades} unidades</b>
              <small>{money(data.capital_invertido)} inmovilizado en stock</small>
            </div>
            <div>
              <span><TrendingDown size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Pérdida por retiros</span>
              <b style={{ fontSize: 17 }}>{money(data.costo_retiros)}</b>
              <small>Vencidos, dañados u otros retiros</small>
            </div>
          </div>

          <div className="snack-card" style={{ boxShadow: "none", marginTop: 14 }}>
            <div className="snack-card-title">
              <div><TrendingUp size={17} /><strong>Desempeño por snack</strong></div>
              <span>Ordenado por unidades vendidas</span>
            </div>
            <div className="snack-table-wrap">
              <table className="snack-table">
                <thead>
                  <tr><th>Snack</th><th>Unidades</th><th>Ingresos</th><th>Costo</th><th>Ganancia</th><th>Margen</th></tr>
                </thead>
                <tbody>
                  {data.top_productos.length === 0 ? (
                    <tr><td colSpan={6} className="snack-empty">Aún no hay ventas de snacks en este periodo.</td></tr>
                  ) : data.top_productos.slice(0, 10).map((item, index) => (
                    <tr key={item.id_producto ?? item.nombre_producto}>
                      <td><strong>#{index + 1} · {item.nombre_producto}</strong>{item.lineas_sin_costo > 0 && <small style={{ display: "block", color: "#b45309", marginTop: 3 }}>{item.lineas_sin_costo} línea(s) sin costo</small>}</td>
                      <td>{item.unidades}</td>
                      <td>{money(item.ingresos)}</td>
                      <td>{money(item.costo)}</td>
                      <td><strong>{money(item.ganancia)}</strong></td>
                      <td>{pct(item.margen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="snack-card" style={{ boxShadow: "none", marginTop: 14 }}>
            <div className="snack-card-title">
              <div><Banknote size={17} /><strong>Ventas por método de pago</strong></div>
              <span>{data.ventas} ventas</span>
            </div>
            <div className="snack-table-wrap">
              <table className="snack-table">
                <thead><tr><th>Método</th><th>Ventas</th><th>Recaudo</th><th>Participación</th></tr></thead>
                <tbody>
                  {data.metodos_pago.length === 0 ? (
                    <tr><td colSpan={4} className="snack-empty">Sin ventas registradas.</td></tr>
                  ) : data.metodos_pago.map((item) => (
                    <tr key={item.medio_pago}>
                      <td>{methodLabel(item.medio_pago)}</td>
                      <td>{item.ventas}</td>
                      <td><strong>{money(item.total)}</strong></td>
                      <td>{pct(data.ingresos ? item.total / data.ingresos * 100 : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
