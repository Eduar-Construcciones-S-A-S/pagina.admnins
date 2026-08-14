import { supabase } from "../lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type ControlOperativoRow = {
  id_reserva: number;
  id_participante: number | null;
  reserva_codigo: string;
  id_plan: number | null;
  plan: string;
  fecha: string;
  hora: string;
  aprobado: boolean | null;
  nombre: string;
  edad: number | null;
  nacionalidad: string;
  tipo_documento: string;
  documento: string;
  contacto: string;
  cantidad: number | null;
  mina: boolean | null;
  refrigerio: boolean | null;
  restaurante: boolean | null;
  almuerzo: string;
  total: number;
  abono: number;
  medio_abono: string;
  pago_saldo: number;
  medio_saldo: string;
  saldo_pendiente: number;
  observacion: string;
};

const text = (value: unknown) => (value == null ? "" : String(value));
const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function getControlOperativo(): Promise<ControlOperativoRow[]> {
  const [reservasRes, participantesRes, planesRes, fechasRes, horasRes] = await Promise.all([
    client().from("reserva").select("*").eq("aprobado", true).order("id_reserva", { ascending: false }),
    client().from("participante").select("*").order("id_participante", { ascending: true }),
    client().from("plan").select("*"),
    client().from("plan_fechas").select("*"),
    client().from("plan_horas").select("*"),
  ]);

  const errors = [reservasRes.error, participantesRes.error, planesRes.error, fechasRes.error, horasRes.error].filter(Boolean);
  if (errors.length) throw errors[0];

  const reservas = reservasRes.data ?? [];
  const participantes = participantesRes.data ?? [];
  const planes = planesRes.data ?? [];
  const fechas = fechasRes.data ?? [];
  const horas = horasRes.data ?? [];

  const planMap = new Map(planes.map((p: any) => [Number(p.id_plan), p]));
  const fechaMap = new Map(fechas.map((f: any) => [Number(f.id_fecha), f]));
  const horaMap = new Map(horas.map((h: any) => [Number(h.id_hora), h]));
  const participantesPorReserva = new Map<number, any[]>();

  for (const p of participantes as any[]) {
    const id = Number(p.id_reserva);
    if (!participantesPorReserva.has(id)) participantesPorReserva.set(id, []);
    participantesPorReserva.get(id)!.push(p);
  }

  const rows: ControlOperativoRow[] = [];

  for (const r of reservas as any[]) {
    const plan = planMap.get(Number(r.id_plan));
    const fecha = fechaMap.get(Number(r.id_fecha));
    const hora = horaMap.get(Number(r.id_hora));
    const personas = participantesPorReserva.get(Number(r.id_reserva)) ?? [null];
    const total = num(r.valor_total ?? (num(r.precio_unitario) * num(r.cantidad_personas)));
    const abono = num(r.valor_abonado);
    const pagoSaldo = num(r.valor_saldo_pagado);
    const saldo = Math.max(0, total - abono - pagoSaldo);

    for (const p of personas) {
      rows.push({
        id_reserva: Number(r.id_reserva),
        id_participante: p ? Number(p.id_participante) : null,
        reserva_codigo: text(r.codigo_reserva || r.codigo || r.id_reserva),
        id_plan: r.id_plan == null ? null : Number(r.id_plan),
        plan: text(plan?.nombre_plan),
        fecha: text(fecha?.fecha),
        hora: text(hora?.hora),
        aprobado: r.aprobado ?? null,
        nombre: text(p?.nombre),
        edad: p?.edad == null ? null : Number(p.edad),
        nacionalidad: text(p?.nacionalidad),
        tipo_documento: text(p?.tipo_documento),
        documento: text(p?.numero_documento),
        contacto: text(p?.telefono_participante || p?.telefono_cliente || r.telefono_cliente),
        cantidad: r.cantidad_personas == null ? null : Number(r.cantidad_personas),
        mina: r.mina ?? null,
        refrigerio: r.refrigerio ?? null,
        restaurante: r.restaurante ?? null,
        almuerzo: text(r.tipo_almuerzo),
        total,
        abono,
        medio_abono: text(r.metodo_pago_abono),
        pago_saldo: pagoSaldo,
        medio_saldo: text(r.metodo_pago_saldo),
        saldo_pendiente: saldo,
        observacion: text(r.observacion),
      });
    }
  }

  return rows;
}

export async function updateControlReserva(idReserva: number, payload: Record<string, unknown>) {
  const { data, error } = await client()
    .from("reserva")
    .update(payload)
    .eq("id_reserva", idReserva)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateControlParticipante(idParticipante: number, payload: Record<string, unknown>) {
  const { data, error } = await client()
    .from("participante")
    .update(payload)
    .eq("id_participante", idParticipante)
    .select()
    .single();
  if (error) throw error;
  return data;
}
