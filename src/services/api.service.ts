import { supabase } from "../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

/* ─── PLANES ─────────────────────────────────────────────── */

export async function getPlanes() {
  const { data, error } = await getClient().from("plan").select(`*, plan_fechas (*), plan_horas (*)`).order("id_plan", { ascending: true });
  if (error) throw error; return data ?? [];
}
export async function createPlan(payload:any){const{plan_fechas,plan_horas,...planData}=payload;const{data:plan,error:planError}=await getClient().from("plan").insert(planData).select().single();if(planError)throw planError;if(plan_fechas?.length){const{error}=await getClient().from("plan_fechas").insert(plan_fechas.map((f:any)=>({fecha:f.fecha,id_plan:plan.id_plan})));if(error)throw error}if(plan_horas?.length){const{error}=await getClient().from("plan_horas").insert(plan_horas.map((h:any)=>({hora:h.hora,id_plan:plan.id_plan})));if(error)throw error}return plan}
export async function updatePlan(id:number,payload:any){const{plan_fechas,plan_horas,...planData}=payload;const{data:plan,error:planError}=await getClient().from("plan").update(planData).eq("id_plan",id).select().single();if(planError)throw planError;const{error:df}=await getClient().from("plan_fechas").delete().eq("id_plan",id);if(df)throw df;if(plan_fechas?.length){const{error}=await getClient().from("plan_fechas").insert(plan_fechas.map((f:any)=>({fecha:f.fecha,id_plan:id})));if(error)throw error}const{error:dh}=await getClient().from("plan_horas").delete().eq("id_plan",id);if(dh)throw dh;if(plan_horas?.length){const{error}=await getClient().from("plan_horas").insert(plan_horas.map((h:any)=>({hora:h.hora,id_plan:id})));if(error)throw error}return plan}
export async function deletePlan(id:number){const{error}=await getClient().from("plan").delete().eq("id_plan",id);if(error)throw error}

/* ─── CLIENTES ───────────────────────────────────────────── */
export async function getClientes(){const{data,error}=await getClient().from("cliente").select("telefono, atencion_humana, etapaconversacion, id_plan").order("telefono",{ascending:true});if(error)throw error;return data??[]}
export async function createCliente(payload:any){const{data,error}=await getClient().from("cliente").insert(payload).select().single();if(error)throw error;return data}
export async function updateCliente(telefono:string,payload:any){const{data,error}=await getClient().from("cliente").update(payload).eq("telefono",telefono).select().single();if(error)throw error;return data}
export async function deleteCliente(telefono:string){const{error}=await getClient().from("cliente").delete().eq("telefono",telefono);if(error)throw error}

/* ─── RESERVAS ───────────────────────────────────────────── */
export async function getReservas() {
  const { data, error } = await getClient().from("reserva").select(`
    id_reserva, codigo_reserva, fecha_solicitud, fecha_aprobacion, telefono_cliente,
    id_plan, id_fecha, id_hora, cantidad_personas, aprobado,
    plan (id_plan, nombre_plan, precio_plan),
    plan_fechas (id_fecha, fecha),
    plan_horas (id_hora, hora)
  `).order("id_reserva", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r:any)=>({
    ...r,
    nombre_plan:r.plan?.nombre_plan??null,
    fecha_reserva:r.plan_fechas?.fecha??null,
    hora_reserva:r.plan_horas?.hora??null,
  }));
}
export async function createReserva(payload:any){const{data,error}=await getClient().from("reserva").insert(payload).select().single();if(error)throw error;return data}
export async function updateReserva(id:number,payload:any){const{data,error}=await getClient().from("reserva").update(payload).eq("id_reserva",id).select();if(error)throw error;if(!data||data.length===0)throw new Error("El UPDATE no afectó ninguna fila. Posible política RLS de UPDATE faltante en la tabla 'reserva', o el id no existe.");return data[0]}
export async function deleteReserva(id:number){const{error}=await getClient().from("reserva").delete().eq("id_reserva",id);if(error)throw error}

/* ─── PARTICIPANTES ──────────────────────────────────────── */
export async function getParticipantes(){const{data,error}=await getClient().from("participante").select(`*, reserva (id_reserva,codigo_reserva,id_plan,aprobado,plan(id_plan,nombre_plan))`).order("id_participante",{ascending:false});if(error)throw error;return(data??[]).map((p:any)=>({...p,id_plan:p.reserva?.id_plan??null,codigo_reserva:p.reserva?.codigo_reserva??null,nombre_plan:p.reserva?.plan?.nombre_plan??null}))}
export async function getParticipantesPorReserva(id_reserva:number){const{data,error}=await getClient().from("participante").select("*").eq("id_reserva",id_reserva).order("id_participante",{ascending:true});if(error)throw error;return data??[]}
export async function createParticipante(payload:any){const{data,error}=await getClient().from("participante").insert(payload).select().single();if(error)throw error;return data}
export async function updateParticipante(id:number,payload:any){const{data,error}=await getClient().from("participante").update(payload).eq("id_participante",id).select().single();if(error)throw error;return data}
export async function deleteParticipante(id:number){const{error}=await getClient().from("participante").delete().eq("id_participante",id);if(error)throw error}
