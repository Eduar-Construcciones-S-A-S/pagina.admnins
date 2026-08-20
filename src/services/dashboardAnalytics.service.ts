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
export interface DashboardPago {
  id_pago?:number; id_reserva:number; tipo_pago:"abono"|"saldo"; monto:number; medio_pago:string; fecha_pago?:string|null;
}
export interface DashboardAnalyticsData {
  reservas:DashboardReserva[];
  planes:DashboardPlan[];
  clientes:DashboardCliente[];
  participantes:DashboardParticipante[];
  pagos:DashboardPago[];
  metodosPago:string[];
}

function client(){ if(!supabase) throw new Error("Supabase no está configurado"); return supabase; }
const cleanMethod=(value:unknown)=>String(value??"").trim().toLowerCase();

export async function getDashboardAnalytics():Promise<DashboardAnalyticsData>{
  const db=client();
  const [reservasResult,planesResult,clientesResult,participantesResult,pagosResult,metodosResult]=await Promise.all([
    db.from("reserva").select(`id_reserva,fecha_solicitud,fecha_aprobacion,telefono_cliente,id_plan,cantidad_personas,aprobado,precio_unitario,valor_total,valor_abonado,valor_saldo_pagado,metodo_pago_abono,metodo_pago_saldo,plan (id_plan,nombre_plan,precio_plan)`).order("id_reserva",{ascending:false}),
    db.from("plan").select("id_plan, nombre_plan, precio_plan").order("id_plan",{ascending:true}),
    db.from("cliente").select("telefono, atencion_humana, etapaconversacion"),
    db.from("participante").select("id_participante, id_reserva"),
    db.from("reserva_pago").select("id_pago,id_reserva,tipo_pago,monto,medio_pago,fecha_pago").order("fecha_pago",{ascending:false}),
    db.from("medio_pago_config").select("valor,activo").eq("activo",true).order("valor",{ascending:true}),
  ]);
  if(reservasResult.error) throw reservasResult.error;
  if(planesResult.error) throw planesResult.error;
  if(clientesResult.error) throw clientesResult.error;
  if(participantesResult.error) throw participantesResult.error;
  if(pagosResult.error) throw pagosResult.error;
  if(metodosResult.error) throw metodosResult.error;

  const reservas=((reservasResult.data??[]) as any[]).map(r=>({
    ...r,
    valor_total:Number(r.valor_total||0),
    valor_abonado:Number(r.valor_abonado||0),
    valor_saldo_pagado:Number(r.valor_saldo_pagado||0),
    metodo_pago_abono:cleanMethod(r.metodo_pago_abono)||null,
    metodo_pago_saldo:cleanMethod(r.metodo_pago_saldo)||null,
  })) as DashboardReserva[];

  const pagos=((pagosResult.data??[]) as any[]).map(p=>({
    id_pago:p.id_pago==null?undefined:Number(p.id_pago),
    id_reserva:Number(p.id_reserva),
    tipo_pago:p.tipo_pago,
    monto:Number(p.monto||0),
    medio_pago:cleanMethod(p.medio_pago),
    fecha_pago:p.fecha_pago??null,
  })).filter(p=>p.id_reserva>0&&p.monto>0&&p.medio_pago) as DashboardPago[];

  const configurados=((metodosResult.data??[]) as any[]).map(x=>cleanMethod(x.valor)).filter(Boolean);
  const usados=[
    ...reservas.flatMap(r=>[cleanMethod(r.metodo_pago_abono),cleanMethod(r.metodo_pago_saldo)]),
    ...pagos.map(p=>p.medio_pago),
  ].filter(Boolean);
  const metodosPago=[...new Set([...configurados,...usados])].sort((a,b)=>a.localeCompare(b,"es"));

  return {
    reservas,
    planes:(planesResult.data??[]) as DashboardPlan[],
    clientes:(clientesResult.data??[]) as DashboardCliente[],
    participantes:(participantesResult.data??[]) as DashboardParticipante[],
    pagos,
    metodosPago,
  };
}
