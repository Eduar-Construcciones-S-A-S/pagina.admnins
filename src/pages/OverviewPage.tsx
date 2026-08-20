import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Banknote, CalendarDays, CircleDollarSign, Clock3, Filter, Package, Percent, RefreshCw, Trophy, TrendingDown, TrendingUp, UserCheck, Users, WalletCards, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getDashboardAnalytics, type DashboardAnalyticsData, type DashboardPlan, type DashboardReserva } from "../services/dashboardAnalytics.service";
import "../styles/overview-crm.css";

const EMPTY_DATA: DashboardAnalyticsData = { reservas: [], planes: [], clientes: [], participantes: [] };
const money = (value: number) => `$${Math.round(value || 0).toLocaleString("es-CO")}`;
const pct = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
const dateKey = (value?: string | null) => value ? value.slice(0, 10) : "";
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

function planName(r: DashboardReserva, planes: DashboardPlan[]) {
  return r.plan?.nombre_plan || planes.find((p) => p.id_plan === r.id_plan)?.nombre_plan || `Plan #${r.id_plan ?? "—"}`;
}
function totalReserva(r: DashboardReserva, planes: DashboardPlan[]) {
  const total = Number(r.valor_total || 0);
  if (total > 0) return total;
  const cantidad = Math.max(1, Number(r.cantidad_personas || 1));
  const unitario = Number(r.precio_unitario || 0);
  if (unitario > 0) return unitario * cantidad;
  const precioPlan = Number(r.plan?.precio_plan || planes.find((p) => p.id_plan === r.id_plan)?.precio_plan || 0);
  return precioPlan * cantidad;
}
function cobradoReserva(r: DashboardReserva) { return Number(r.valor_abonado || 0) + Number(r.valor_saldo_pagado || 0); }
function growth(current: number, previous: number) { if (previous === 0) return current > 0 ? 100 : 0; return ((current - previous) / previous) * 100; }
function toInputDate(d: Date) { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate()+days); return d; }
function displayShortDate(value: string) { if (!value) return "—"; const [,m,d] = value.split("-"); return `${d}/${m}`; }
type Period = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "previousMonth" | "custom";
type StatusFilter = "all" | "approved" | "pending";

export default function OverviewPage() {
  const [data, setData] = useState<DashboardAnalyticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true); setError(null);
    try { const result = await getDashboardAnalytics(); setData(result); setLastUpdated(new Date()); }
    catch (e: any) { console.error("[CRM Dashboard]", e); setError(e?.message || "No fue posible cargar el resumen comercial."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); const timer = window.setInterval(() => load(true), 30_000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => {
    const client = supabase; if (!client) return;
    const channel = client.channel("crm-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reserva" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "plan" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "cliente" }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "participante" }, () => load(true)).subscribe();
    return () => { client.removeChannel(channel); };
  }, [load]);

  const resolvedRange = useMemo(() => {
    const now = new Date(); const today = toInputDate(now);
    if (period === "all") return { from: "", to: "" };
    if (period === "today") return { from: today, to: today };
    if (period === "yesterday") { const y = toInputDate(addDays(now,-1)); return { from:y, to:y }; }
    if (period === "7d") return { from: toInputDate(addDays(now,-6)), to: today };
    if (period === "30d") return { from: toInputDate(addDays(now,-29)), to: today };
    if (period === "month") return { from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    if (period === "previousMonth") return { from: toInputDate(new Date(now.getFullYear(), now.getMonth()-1, 1)), to: toInputDate(new Date(now.getFullYear(), now.getMonth(), 0)) };
    return { from: fromDate, to: toDate };
  }, [period, fromDate, toDate]);

  const filteredReservas = useMemo(() => data.reservas.filter((r) => {
    if (statusFilter === "approved" && r.aprobado !== true) return false;
    if (statusFilter === "pending" && r.aprobado === true) return false;
    if (planFilter && String(r.id_plan ?? "") !== planFilter) return false;
    if (paymentFilter) { const a=normalize(r.metodo_pago_abono); const s=normalize(r.metodo_pago_saldo); if (a !== paymentFilter && s !== paymentFilter) return false; }
    const referenceDate = dateKey(r.aprobado === true ? (r.fecha_aprobacion || r.fecha_solicitud) : r.fecha_solicitud);
    if (resolvedRange.from && (!referenceDate || referenceDate < resolvedRange.from)) return false;
    if (resolvedRange.to && (!referenceDate || referenceDate > resolvedRange.to)) return false;
    return true;
  }), [data.reservas, statusFilter, planFilter, paymentFilter, resolvedRange]);

  const metrics = useMemo(() => {
    const planes = data.planes;
    const aprobadas = filteredReservas.filter(r => r.aprobado === true);
    const pendientes = filteredReservas.filter(r => r.aprobado !== true);
    const ventasTotal = aprobadas.reduce((s,r) => s + totalReserva(r,planes), 0);
    const totalCobrado = aprobadas.reduce((s,r) => s + cobradoReserva(r), 0);
    const cartera = Math.max(0, ventasTotal-totalCobrado);
    const ticketPromedio = aprobadas.length ? ventasTotal/aprobadas.length : 0;
    const conversion = filteredReservas.length ? aprobadas.length/filteredReservas.length*100 : 0;
    const ocupacionVendida = aprobadas.reduce((s,r) => s + Number(r.cantidad_personas || 0), 0);
    const planMap = new Map<number,{id:number;nombre:string;reservas:number;personas:number;ingresos:number}>();
    for (const p of planes) planMap.set(p.id_plan,{id:p.id_plan,nombre:p.nombre_plan,reservas:0,personas:0,ingresos:0});
    for (const r of aprobadas) { if (!r.id_plan) continue; const item=planMap.get(r.id_plan)||{id:r.id_plan,nombre:planName(r,planes),reservas:0,personas:0,ingresos:0}; item.reservas+=1; item.personas+=Number(r.cantidad_personas||0); item.ingresos+=totalReserva(r,planes); planMap.set(r.id_plan,item); }
    const ranking=[...planMap.values()].map(p=>({...p,ticket:p.reservas?p.ingresos/p.reservas:0,participacion:ventasTotal?p.ingresos/ventasTotal*100:0})).sort((a,b)=>b.ingresos-a.ingresos||b.reservas-a.reservas);
    const mejorPlan=ranking.find(p=>p.reservas>0)||null;
    const efectivo=aprobadas.reduce((s,r)=>s+(normalize(r.metodo_pago_abono)==="efectivo"?Number(r.valor_abonado||0):0)+(normalize(r.metodo_pago_saldo)==="efectivo"?Number(r.valor_saldo_pagado||0):0),0);
    const transferencia=aprobadas.reduce((s,r)=>s+(normalize(r.metodo_pago_abono)==="transferencia"?Number(r.valor_abonado||0):0)+(normalize(r.metodo_pago_saldo)==="transferencia"?Number(r.valor_saldo_pagado||0):0),0);
    const dayMap=new Map<string,{key:string;ventas:number;personas:number;ingresos:number}>();
    for (const r of aprobadas) { const key=dateKey(r.fecha_aprobacion||r.fecha_solicitud); if(!key) continue; const item=dayMap.get(key)||{key,ventas:0,personas:0,ingresos:0}; item.ventas+=1; item.personas+=Number(r.cantidad_personas||0); item.ingresos+=totalReserva(r,planes); dayMap.set(key,item); }
    const daily=[...dayMap.values()].sort((a,b)=>a.key.localeCompare(b.key)).slice(-14);
    const now=new Date(); const thisFrom=toInputDate(new Date(now.getFullYear(),now.getMonth(),1)); const thisTo=toInputDate(now); const prevFrom=toInputDate(new Date(now.getFullYear(),now.getMonth()-1,1)); const prevTo=toInputDate(new Date(now.getFullYear(),now.getMonth(),0));
    const allApproved=data.reservas.filter(r=>r.aprobado===true);
    const thisMonthRevenue=allApproved.filter(r=>{const d=dateKey(r.fecha_aprobacion);return d>=thisFrom&&d<=thisTo;}).reduce((s,r)=>s+totalReserva(r,planes),0);
    const prevMonthRevenue=allApproved.filter(r=>{const d=dateKey(r.fecha_aprobacion);return d>=prevFrom&&d<=prevTo;}).reduce((s,r)=>s+totalReserva(r,planes),0);
    return { aprobadas:aprobadas.length, pendientes:pendientes.length, ventasTotal,totalCobrado,cartera,ticketPromedio,conversion,ocupacionVendida,ranking,mejorPlan,efectivo,transferencia,daily,revenueGrowth:growth(thisMonthRevenue,prevMonthRevenue),thisMonthRevenue,prevMonthRevenue };
  }, [filteredReservas, data.planes, data.reservas]);

  const maxDaily=Math.max(1,...metrics.daily.map(d=>d.ingresos)); const maxPlan=Math.max(1,...metrics.ranking.map(p=>p.ingresos));
  const filtersActive=period!=="month"||!!planFilter||statusFilter!=="all"||!!paymentFilter;
  const clearFilters=()=>{setPeriod("month");setFromDate("");setToDate("");setPlanFilter("");setStatusFilter("all");setPaymentFilter("");};

  if (loading) return <div className="crm-loading"><div className="spinner" /><span>Cargando analítica comercial…</span></div>;
  return <div className="crm-dashboard">
    <div className="crm-header"><div><span className="crm-eyebrow">Inteligencia comercial</span><h1>Resumen ejecutivo</h1><p>Ventas, recaudo, cartera y desempeño real de los planes.</p></div><div className="crm-live"><span className="crm-live-dot"/><span>{refreshing?"Actualizando…":"Datos en vivo"}</span>{lastUpdated&&<small>{lastUpdated.toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</small>}<button onClick={()=>load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing?"spin-icon":""}/></button></div></div>
    {error&&<div className="crm-error">{error}</div>}
    <section className="crm-filter-card"><div className="crm-filter-title"><Filter size={17}/><div><strong>Filtros comerciales</strong><span>Analiza ventas por día, rango, plan, estado y forma de pago.</span></div></div><div className="crm-filter-grid">
      <label><span>Periodo</span><select value={period} onChange={e=>setPeriod(e.target.value as Period)}><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="month">Este mes</option><option value="previousMonth">Mes anterior</option><option value="custom">Personalizado</option><option value="all">Todo el histórico</option></select></label>
      {period==="custom"&&<><label><span>Desde</span><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label><span>Hasta</span><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label></>}
      <label><span>Plan</span><select value={planFilter} onChange={e=>setPlanFilter(e.target.value)}><option value="">Todos los planes</option>{data.planes.map(p=><option key={p.id_plan} value={p.id_plan}>{p.nombre_plan}</option>)}</select></label>
      <label><span>Estado</span><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as StatusFilter)}><option value="all">Todas</option><option value="approved">Aprobadas</option><option value="pending">Pendientes</option></select></label>
      <label><span>Medio de pago</span><select value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}><option value="">Todos</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></label>
      <button className="crm-filter-clear" onClick={clearFilters} disabled={!filtersActive}><X size={14}/> Limpiar</button>
    </div><div className="crm-filter-result">Mostrando <b>{filteredReservas.length}</b> reservas · rango {resolvedRange.from||"inicio"} a {resolvedRange.to||"hoy"}</div></section>
    <div className="crm-kpis"><Kpi icon={<CircleDollarSign size={20}/>} label="Ventas aprobadas" value={money(metrics.ventasTotal)} helper={`${metrics.aprobadas} reservas`} tone="gold"/><Kpi icon={<Banknote size={20}/>} label="Total recaudado" value={money(metrics.totalCobrado)} helper={metrics.ventasTotal?`${pct(metrics.totalCobrado/metrics.ventasTotal*100)} recaudado`:"Sin ventas"} tone="green"/><Kpi icon={<WalletCards size={20}/>} label="Cartera pendiente" value={money(metrics.cartera)} helper="Saldo por cobrar" tone="red"/><Kpi icon={<Percent size={20}/>} label="Conversión" value={pct(metrics.conversion)} helper={`${metrics.aprobadas} aprobadas · ${metrics.pendientes} pendientes`} tone="blue"/><Kpi icon={<TrendingUp size={20}/>} label="Ticket promedio" value={money(metrics.ticketPromedio)} helper="Por reserva aprobada" tone="violet"/><Kpi icon={<UserCheck size={20}/>} label="Personas vendidas" value={metrics.ocupacionVendida.toLocaleString("es-CO")} helper="Según filtro actual" tone="teal"/></div>
    <div className="crm-decision-strip"><div className="crm-decision-main"><div className={`crm-growth-icon ${metrics.revenueGrowth>=0?"positive":"negative"}`}>{metrics.revenueGrowth>=0?<TrendingUp size={22}/>:<TrendingDown size={22}/>}</div><div><span>Ventas del mes</span><strong>{money(metrics.thisMonthRevenue)}</strong><small className={metrics.revenueGrowth>=0?"positive-text":"negative-text"}>{metrics.revenueGrowth>=0?"+":""}{pct(metrics.revenueGrowth)} vs. mes anterior ({money(metrics.prevMonthRevenue)})</small></div></div><div className="crm-decision-item"><Trophy size={18}/><div><span>Plan líder filtrado</span><strong>{metrics.mejorPlan?.nombre||"Sin ventas"}</strong><small>{metrics.mejorPlan?`${money(metrics.mejorPlan.ingresos)} · ${metrics.mejorPlan.reservas} reservas`:"Sin resultados"}</small></div></div><div className="crm-decision-item"><Users size={18}/><div><span>Clientes</span><strong>{data.clientes.length}</strong><small>{data.clientes.filter(c=>c.atencion_humana).length} requieren atención</small></div></div><div className="crm-decision-item"><Clock3 size={18}/><div><span>Pendientes filtradas</span><strong>{metrics.pendientes}</strong><small>Reservas por convertir</small></div></div></div>
    <div className="crm-grid crm-grid-main"><section className="crm-card crm-monthly-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Ventas por día</span><h2>Ingresos diarios</h2><p>Últimos 14 días con ventas dentro del filtro seleccionado.</p></div><CalendarDays size={20}/></div>{!metrics.daily.length?<div className="crm-empty">No hay ventas aprobadas en este periodo.</div>:<div className="crm-chart crm-daily-chart">{metrics.daily.map(d=><div className="crm-month" key={d.key}><div className="crm-month-value">{money(d.ingresos)}</div><div className="crm-bar-track"><div className="crm-bar" style={{height:`${Math.max(8,d.ingresos/maxDaily*100)}%`}}/></div><strong>{displayShortDate(d.key)}</strong><span>{d.ventas} vtas · {d.personas} pers.</span></div>)}</div>}</section><section className="crm-card crm-cash-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Caja</span><h2>Recaudo y cartera</h2><p>Valores del filtro actual.</p></div><Banknote size={20}/></div><div className="crm-cash-total"><span>Recaudado</span><strong>{money(metrics.totalCobrado)}</strong><small>de {money(metrics.ventasTotal)} vendidos</small></div><div className="crm-progress"><div style={{width:`${metrics.ventasTotal?Math.min(100,metrics.totalCobrado/metrics.ventasTotal*100):0}%`}}/></div><div className="crm-cash-grid"><div><span>Efectivo</span><strong>{money(metrics.efectivo)}</strong></div><div><span>Transferencia</span><strong>{money(metrics.transferencia)}</strong></div><div className="pending"><span>Pendiente</span><strong>{money(metrics.cartera)}</strong></div></div></section></div>
    <section className="crm-card crm-ranking-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Portafolio</span><h2>Rentabilidad y demanda por plan</h2><p>Comparación según los filtros aplicados.</p></div><Package size={20}/></div>{!metrics.ranking.some(p=>p.reservas>0)?<div className="crm-empty">No hay ventas por plan en este periodo.</div>:<div className="crm-ranking-table"><div className="crm-ranking-row header"><span>Plan</span><span>Reservas</span><span>Personas</span><span>Ingresos</span><span>Ticket</span><span>Participación</span></div>{metrics.ranking.filter(p=>p.reservas>0).map((p,index)=><div className="crm-ranking-row" key={p.id}><div className="crm-plan-name"><span className={`crm-rank ${index<3?`top-${index+1}`:""}`}>{index+1}</span><div><strong>{p.nombre}</strong><div className="crm-mini-track"><div style={{width:`${p.ingresos/maxPlan*100}%`}}/></div></div></div><strong>{p.reservas}</strong><strong>{p.personas}</strong><strong>{money(p.ingresos)}</strong><span>{money(p.ticket)}</span><span>{pct(p.participacion)}</span></div>)}</div>}</section>
    <div className="crm-grid crm-grid-bottom"><section className="crm-card crm-funnel-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Conversión</span><h2>Embudo filtrado</h2></div><Percent size={20}/></div><div className="crm-funnel"><div><span>Reservas recibidas</span><strong>{filteredReservas.length}</strong><div className="crm-funnel-bar"><i style={{width:"100%"}}/></div></div><div><span>Aprobadas</span><strong>{metrics.aprobadas}</strong><div className="crm-funnel-bar"><i style={{width:`${filteredReservas.length?metrics.aprobadas/filteredReservas.length*100:0}%`}}/></div></div><div><span>Pendientes</span><strong>{metrics.pendientes}</strong><div className="crm-funnel-bar pending"><i style={{width:`${filteredReservas.length?metrics.pendientes/filteredReservas.length*100:0}%`}}/></div></div></div></section><section className="crm-card crm-actions-card"><div className="crm-card-head"><div><span className="crm-card-kicker">Acción</span><h2>Prioridades comerciales</h2></div><ArrowRight size={20}/></div><NavLink to="/app/reservas"><div><Clock3 size={17}/><span><strong>{metrics.pendientes} reservas pendientes</strong><small>Revisar solicitudes</small></span></div><ArrowRight size={17}/></NavLink><NavLink to="/app/control-operativo"><div><WalletCards size={17}/><span><strong>{money(metrics.cartera)} por cobrar</strong><small>Gestionar saldos</small></span></div><ArrowRight size={17}/></NavLink><NavLink to="/app/planes"><div><Trophy size={17}/><span><strong>{metrics.mejorPlan?.nombre||"Planes"}</strong><small>Revisar portafolio</small></span></div><ArrowRight size={17}/></NavLink></section></div>
  </div>;
}

function Kpi({ icon, label, value, helper, tone }: { icon: React.ReactNode; label: string; value: string; helper: string; tone: string }) {
  return <div className={`crm-kpi crm-kpi-${tone}`}><div className="crm-kpi-top"><div className="crm-kpi-icon">{icon}</div><span>{label}</span></div><strong>{value}</strong><small>{helper}</small></div>;
}
