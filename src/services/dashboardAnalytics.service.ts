import { supabase } from "../lib/supabase";

export interface DashboardPlan { id_plan:number; nombre_plan:string; precio_plan?:number|null; }
export interface DashboardReserva {
  id_reserva:number; fecha_solicitud?:string|null; fecha_aprobacion?:string|null; telefono_cliente?:string|null;
  id_plan?:number|null; cantidad_personas?:number|null; aprobado?:boolean|null; precio_unitario?:number|null;
  valor_total?:number|null; valor_abonado?:number|null; valor_saldo_pagado?:number|null;
  metodo_pago_abono?:string|null; metodo_pago_saldo?:string|null; plan?:DashboardPlan|null;
}
export interface DashboardCliente { telefono:string; atencion_humana?:boolean|null; etapaconversacion?:string|null; }
export interface DashboardParticipante { id_participante:number; id_reserva?:number|null; }
export interface DashboardAnalyticsData { reservas:DashboardReserva[]; planes:DashboardPlan[]; clientes:DashboardCliente[]; participantes:DashboardParticipante[]; }

type PagoRow = { id_reserva:number; tipo_pago:"abono"|"saldo"; monto:number; medio_pago:string };

function client(){ if(!supabase) throw new Error("Supabase no está configurado"); return supabase; }
function dashboardPaymentMethod(value: unknown) {
  const method=String(value??"").trim().toLowerCase();
  if(!method) return null;
  // La vista ejecutiva agrupa los medios reales en dos familias de caja.
  // Cualquier medio configurado que contenga "efectivo" (p. ej. efectivo oficina
  // o efectivo taquilla) pertenece a Efectivo. Los demás medios son electrónicos.
  if(method.includes("efectivo")) return "efectivo";
  return "transferencia";
}

export async function getDashboardAnalytics():Promise<DashboardAnalyticsData>{
  const db=client();
  const [reservasResult,planesResult,clientesResult,participantesResult,pagosResult]=await Promise.all([
    db.from("reserva").select(`id_reserva,fecha_solicitud,fecha_aprobacion,telefono_cliente,id_plan,cantidad_personas,aprobado,precio_unitario,valor_total,valor_abonado,valor_saldo_pagado,metodo_pago_abono,metodo_pago_saldo,plan (id_plan,nombre_plan,precio_plan)`).order("id_reserva",{ascending:false}),
    db.from("plan").select("id_plan, nombre_plan, precio_plan").order("id_plan",{ascending:true}),
    db.from("cliente").select("telefono, atencion_humana, etapaconversacion"),
    db.from("participante").select("id_participante, id_reserva"),
    db.from("reserva_pago").select("id_reserva,tipo_pago,monto,medio_pago"),
  ]);
  if(reservasResult.error) throw reservasResult.error;
  if(planesResult.error) throw planesResult.error;
  if(clientesResult.error) throw clientesResult.error;
  if(participantesResult.error) throw participantesResult.error;
  if(pagosResult.error) throw pagosResult.error;

  const pagos=((pagosResult.data??[]) as any[]).map(p=>({
    id_reserva:Number(p.id_reserva),
    tipo_pago:p.tipo_pago,
    monto:Number(p.monto||0),
    medio_pago:String(p.medio_pago||"")
  })) as PagoRow[];

  const pagosPorReserva=new Map<number,PagoRow[]>();
  for(const p of pagos){
    if(!pagosPorReserva.has(p.id_reserva)) pagosPorReserva.set(p.id_reserva,[]);
    pagosPorReserva.get(p.id_reserva)!.push(p);
  }

  const reservas=((reservasResult.data??[]) as any[]).map(r=>{
    const movimientos=pagosPorReserva.get(Number(r.id_reserva))??[];
    const saldoMovs=movimientos.filter(p=>p.tipo_pago==="saldo" && p.monto>0);
    const totalSaldoMovs=saldoMovs.reduce((s,p)=>s+p.monto,0);
    const categoriasSaldo=[...new Set(saldoMovs.map(p=>dashboardPaymentMethod(p.medio_pago)).filter(Boolean))];

    // Para pagos múltiples, reserva.metodo_pago_saldo queda NULL por diseño.
    // El dashboard reconstruye el medio desde reserva_pago. Si todos los movimientos
    // pertenecen a la misma familia, esa familia se usa para que caja y filtro funcionen.
    const metodoSaldo = categoriasSaldo.length===1
      ? categoriasSaldo[0]
      : dashboardPaymentMethod(r.metodo_pago_saldo);

    return {
      ...r,
      valor_saldo_pagado: totalSaldoMovs>0 ? totalSaldoMovs : Number(r.valor_saldo_pagado||0),
      metodo_pago_abono: dashboardPaymentMethod(r.metodo_pago_abono),
      metodo_pago_saldo: metodoSaldo,
    };
  }) as DashboardReserva[];

  return { reservas, planes:(planesResult.data??[]) as DashboardPlan[], clientes:(clientesResult.data??[]) as DashboardCliente[], participantes:(participantesResult.data??[]) as DashboardParticipante[] };
}
