import { useEffect } from "react";
import * as XLSX from "xlsx";
import {
  getControlOperativo,
  getDevolucionesControlOperativo,
  getPagosControlOperativo,
  type ControlOperativoRow,
  type ReservaDevolucion,
  type ReservaPago,
} from "../../services/controlOperativo.service";

const fecha = (value?: string | null) => {
  const raw = String(value ?? "").slice(0, 10);
  if (!raw) return "";
  const [year, month, day] = raw.split("-");
  return year && month && day ? `${day}/${month}/${year}` : raw;
};

const hora = (value?: string | null) => String(value ?? "").slice(0, 5);
const texto = (value: unknown) => String(value ?? "").trim();

const estadoLabel = (value: string) => ({
  programada: "Programada",
  asistio: "Asistió",
  no_asistio: "No asistió",
  reprogramada: "Reprogramada",
  cancelada: "Cancelada",
}[value] ?? value);

function agruparPorReserva(rows: ControlOperativoRow[]) {
  const map = new Map<number, ControlOperativoRow[]>();
  for (const row of rows) {
    const current = map.get(row.id_reserva) ?? [];
    current.push(row);
    map.set(row.id_reserva, current);
  }
  return [...map.values()];
}

function pagosPorReserva(pagos: ReservaPago[]) {
  const map = new Map<number, ReservaPago[]>();
  for (const pago of pagos) {
    const current = map.get(pago.id_reserva) ?? [];
    current.push(pago);
    map.set(pago.id_reserva, current);
  }
  return map;
}

function devolucionesPorReserva(devoluciones: ReservaDevolucion[]) {
  const map = new Map<number, ReservaDevolucion[]>();
  for (const devolucion of devoluciones) {
    const current = map.get(devolucion.id_reserva) ?? [];
    current.push(devolucion);
    map.set(devolucion.id_reserva, current);
  }
  return map;
}

async function exportarControlOperativoExcel() {
  const [rows, pagos, devoluciones] = await Promise.all([
    getControlOperativo(),
    getPagosControlOperativo(),
    getDevolucionesControlOperativo(),
  ]);

  const grupos = agruparPorReserva(rows);
  const pagosMap = pagosPorReserva(pagos);
  const devolucionesMap = devolucionesPorReserva(devoluciones);

  const headers = [
    "Código",
    "Estado operativo",
    "Motivo estado",
    "Plan",
    "Fecha reserva",
    "Hora",
    "Cantidad personas",
    "Participantes",
    "Edades",
    "Nacionalidades",
    "Tipos documento",
    "Documentos",
    "Contactos participantes",
    "Contacto cliente",
    "Mina",
    "Refrigerio",
    "Restaurante",
    "Incluye almuerzo",
    "Tipos de almuerzo",
    "Valor total",
    "Abono",
    "Medio abono",
    "Pago saldo",
    "Medio saldo",
    "Total recaudado",
    "Devuelto",
    "Neto caja",
    "Saldo pendiente",
    "Observación",
  ];

  const data = grupos.map((grupo) => {
    const principal = grupo[0];
    const pagosReserva = pagosMap.get(principal.id_reserva) ?? [];
    const devolucionesReserva = devolucionesMap.get(principal.id_reserva) ?? [];
    const recaudado = pagosReserva.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
    const devuelto = devolucionesReserva.reduce((sum, item) => sum + Number(item.monto || 0), 0);

    const join = (selector: (row: ControlOperativoRow) => unknown) =>
      grupo.map(selector).map(texto).filter(Boolean).join(" | ");

    const mediosSaldo = pagosReserva
      .filter((pago) => pago.tipo_pago === "saldo")
      .map((pago) => pago.medio_pago)
      .filter(Boolean);

    return [
      principal.reserva_codigo,
      estadoLabel(principal.estado_operativo),
      principal.motivo_estado_operativo,
      principal.plan,
      fecha(principal.fecha),
      hora(principal.hora),
      Number(principal.cantidad || grupo.length || 0),
      join((row) => row.nombre),
      join((row) => row.edad),
      join((row) => row.nacionalidad),
      join((row) => row.tipo_documento),
      join((row) => row.documento),
      join((row) => row.contacto),
      principal.contacto_cliente,
      principal.mina ? "Sí" : "No",
      principal.refrigerio ? "Sí" : "No",
      principal.restaurante || "",
      principal.incluye_almuerzo ? "Sí" : "No",
      join((row) => row.almuerzo),
      Number(principal.total || 0),
      Number(principal.abono || 0),
      principal.medio_abono || "",
      Number(principal.pago_saldo || 0),
      [...new Set(mediosSaldo)].join(" | ") || principal.medio_saldo || "",
      recaudado,
      devuelto,
      Math.max(0, recaudado - devuelto),
      Number(principal.saldo_pendiente || 0),
      principal.observacion || "",
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  worksheet["!autofilter"] = { ref: `A1:AC${Math.max(1, data.length + 1)}` };
  worksheet["!cols"] = [
    18, 18, 28, 42, 15, 10, 15, 38, 18, 28, 28, 30, 32, 20, 10, 12, 20, 18, 30,
    16, 16, 20, 16, 24, 18, 16, 16, 18, 40,
  ].map((wch) => ({ wch }));

  // Mantener los valores monetarios como números reales para poder sumar y filtrar en Excel.
  const moneyColumns = new Set([19, 20, 22, 24, 25, 26, 27]);
  for (let row = 1; row <= data.length; row += 1) {
    for (const col of moneyColumns) {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[ref]) worksheet[ref].z = "$#,##0";
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reservas");

  const pagosSheet = XLSX.utils.json_to_sheet(pagos.map((pago) => ({
    Reserva: rows.find((row) => row.id_reserva === pago.id_reserva)?.reserva_codigo ?? `#${pago.id_reserva}`,
    Tipo: pago.tipo_pago === "saldo" ? "Saldo" : "Abono",
    Valor: Number(pago.monto || 0),
    "Medio de pago": pago.medio_pago,
    "Fecha de pago": pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "",
    Observación: pago.observacion ?? "",
  })));
  pagosSheet["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(workbook, pagosSheet, "Pagos");

  const devolucionesSheet = XLSX.utils.json_to_sheet(devoluciones.map((item) => ({
    Reserva: rows.find((row) => row.id_reserva === item.id_reserva)?.reserva_codigo ?? `#${item.id_reserva}`,
    Valor: Number(item.monto || 0),
    Medio: item.medio_pago,
    Tipo: item.tipo_devolucion,
    Motivo: item.motivo ?? "",
    Observación: item.observacion ?? "",
    Fecha: item.fecha_devolucion ? new Date(item.fecha_devolucion).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "",
  })));
  devolucionesSheet["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 30 }, { wch: 36 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, devolucionesSheet, "Devoluciones");

  const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  XLSX.writeFile(workbook, `Control_Operativo_Todas_Las_Reservas_${stamp}.xlsx`, { compression: true });
}

export default function ControlOperativoExcelExport() {
  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      if (!window.location.pathname.includes("/app/control-operativo")) return;
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button || !/exportar/i.test(button.textContent ?? "")) return;

      // Intercepta el antiguo window.print() para convertir el mismo botón en exportación Excel.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const original = button.innerHTML;
      button.disabled = true;
      button.textContent = "Generando Excel…";
      try {
        await exportarControlOperativoExcel();
      } catch (error) {
        console.error("No fue posible exportar el control operativo a Excel:", error);
        window.alert("No fue posible generar el archivo Excel. Intenta nuevamente.");
      } finally {
        button.disabled = false;
        button.innerHTML = original;
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
