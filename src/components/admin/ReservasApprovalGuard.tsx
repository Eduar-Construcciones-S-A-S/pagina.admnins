import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, X } from "lucide-react";
import ReservasAdmin from "./ReservasAdmin";
import { getReservas, updateReserva } from "../../services/api.service";

type ReservaLite = {
  id_reserva: number;
  fecha_solicitud?: string | null;
  telefono_cliente: string;
  id_plan: number;
  aprobado?: boolean | null;
};

const METODOS_PAGO = [
  "Efectivo",
  "Transferencia bancaria",
  "Bancolombia",
  "Nequi",
  "Daviplata",
  "Tarjeta",
];

function fmt(dateStr?: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function parseMoney(value: string) {
  const normalized = value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.]/g, "");
  return Number(normalized || 0);
}

export default function ReservasApprovalGuard() {
  const [reservas, setReservas] = useState<ReservaLite[]>([]);
  const [selected, setSelected] = useState<ReservaLite | null>(null);
  const [valorAbonado, setValorAbonado] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReservas()
      .then((data) => setReservas(Array.isArray(data) ? data : []))
      .catch((e) => console.error("No se pudieron precargar las reservas para aprobación", e));
  }, []);

  const reservaMap = useMemo(() => reservas, [reservas]);

  const identifyReservation = (button: HTMLElement): ReservaLite | null => {
    const row = button.closest("tr");
    if (!row) return null;

    const phoneText = row.querySelector(".rv-phone")?.textContent ?? "";
    const phone = onlyDigits(phoneText);
    const planText = row.querySelector(".rv-plan-id")?.textContent ?? "";
    const planId = Number(planText.replace(/\D/g, ""));
    const requestDateText = row.querySelector("td:first-child")?.textContent?.trim() ?? "";

    const candidates = reservaMap.filter((r) =>
      onlyDigits(r.telefono_cliente) === phone && Number(r.id_plan) === planId && !r.aprobado
    );

    if (candidates.length === 1) return candidates[0];

    return candidates.find((r) => fmt(r.fecha_solicitud) === requestDateText) ?? candidates[0] ?? null;
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest("button.rv-switch") as HTMLElement | null;
    if (!button) return;

    const isApproved = button.getAttribute("aria-checked") === "true";
    if (isApproved) return;

    event.preventDefault();
    event.stopPropagation();

    const reserva = identifyReservation(button);
    if (!reserva) {
      alert("No se pudo identificar la reserva para aprobar. Actualiza la página e inténtalo nuevamente.");
      return;
    }

    setSelected(reserva);
    setValorAbonado("");
    setMetodoPago("");
    setError(null);
  };

  const closeModal = () => {
    if (saving) return;
    setSelected(null);
    setValorAbonado("");
    setMetodoPago("");
    setError(null);
  };

  const aprobarReserva = async () => {
    if (!selected) return;

    const valor = parseMoney(valorAbonado);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Ingresa un valor abonado mayor a $0.");
      return;
    }
    if (!metodoPago) {
      setError("Selecciona el método de pago del abono.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateReserva(selected.id_reserva, {
        aprobado: true,
        fecha_aprobacion: new Date().toISOString(),
        valor_abonado: valor,
        metodo_pago_abono: metodoPago,
      });

      setSelected(null);
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "No se pudo aprobar la reserva.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClickCapture={handleClickCapture}>
        <ReservasAdmin />
      </div>

      {selected && (
        <div className="rv-overlay" onClick={closeModal}>
          <div className="rv-modal rv-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="rv-modal-header">
              <div>
                <h2>Aprobar reserva #{selected.id_reserva}</h2>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                  Registra el abono recibido antes de confirmar la aprobación.
                </p>
              </div>
              <button className="rv-modal-close" onClick={closeModal} disabled={saving} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="rv-modal-body">
              <div style={{ display: "grid", gap: 16 }}>
                <div className="rv-form-group">
                  <label>Valor abonado *</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontWeight: 600 }}>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={valorAbonado}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setValorAbonado(digits ? Number(digits).toLocaleString("es-CO") : "");
                        if (error) setError(null);
                      }}
                      placeholder="0"
                      style={{ paddingLeft: 28 }}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="rv-form-group">
                  <label>Método de pago del abono *</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => {
                      setMetodoPago(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={saving}
                  >
                    <option value="">Seleccionar método de pago</option>
                    {METODOS_PAGO.map((metodo) => (
                      <option key={metodo} value={metodo}>{metodo}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", fontSize: 13, lineHeight: 1.45 }}>
                  <CreditCard size={17} style={{ flex: "0 0 auto", marginTop: 1 }} />
                  <span>Al confirmar se guardarán el valor abonado, el método de pago y la fecha exacta de aprobación.</span>
                </div>

                {error && (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fff1f2", color: "#be123c", fontSize: 13 }}>
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="rv-modal-footer">
              <button className="rv-btn-cancel" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button className="rv-btn-save" onClick={aprobarReserva} disabled={saving}>
                <CheckCircle2 size={16} /> {saving ? "Aprobando..." : "Confirmar aprobación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
