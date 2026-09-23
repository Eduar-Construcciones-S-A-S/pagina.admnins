import { supabase } from "../lib/supabase";
import { getCurrentRole } from "./role.service";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export type SnackProduct = {
  id_producto: number;
  numero_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SnackAdminProduct = SnackProduct & {
  precio_compra: number | null;
};

export type SnackAdminDashboardProduct = {
  id_producto: number | null;
  nombre_producto: string;
  unidades: number;
  ingresos: number;
  costo: number;
  ganancia: number;
  margen: number;
  lineas_sin_costo: number;
};

export type SnackAdminDashboard = {
  ventas: number;
  ingresos: number;
  unidades: number;
  costo_vendido: number;
  ganancia_bruta: number;
  margen: number;
  ticket_promedio: number;
  lineas_sin_costo: number;
  costos_estimados: number;
  retiros_unidades: number;
  costo_retiros: number;
  productos_activos: number;
  stock_unidades: number;
  capital_invertido: number;
  valor_potencial_venta: number;
  ganancia_potencial: number;
  productos_sin_costo: number;
  top_productos: SnackAdminDashboardProduct[];
  metodos_pago: Array<{ medio_pago: string; ventas: number; total: number }>;
};

export type SnackSaleItem = {
  id_detalle: number;
  id_venta: number;
  id_producto: number | null;
  numero_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export type SnackSale = {
  id_venta: number;
  fecha_venta: string;
  medio_pago: string;
  total: number;
  vendedor_user_id: string | null;
  vendedor_email: string;
  items: SnackSaleItem[];
};

export type SnackSaleInput = {
  id_producto: number;
  cantidad: number;
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function requireAdmin() {
  const current = await getCurrentRole();
  if (current?.role !== "administrador") {
    throw new Error("Solo un administrador puede modificar el inventario de snacks.");
  }
}

export async function getSnackProducts(includeInactive = false): Promise<SnackProduct[]> {
  let query = client()
    .from("snack_producto")
    .select("id_producto,numero_producto,nombre_producto,cantidad,precio,activo,created_at,updated_at")
    .order("numero_producto", { ascending: true });

  if (!includeInactive) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    id_producto: Number(row.id_producto),
    cantidad: num(row.cantidad),
    precio: num(row.precio),
    activo: row.activo !== false,
  })) as SnackProduct[];
}


export async function getSnackProductsAdmin(includeInactive = true): Promise<SnackAdminProduct[]> {
  await requireAdmin();

  let productQuery = client()
    .from("snack_producto")
    .select("id_producto,numero_producto,nombre_producto,cantidad,precio,activo,created_at,updated_at")
    .order("numero_producto", { ascending: true });

  if (!includeInactive) productQuery = productQuery.eq("activo", true);

  const [{ data: products, error: productError }, { data: costs, error: costError }] = await Promise.all([
    productQuery,
    client().from("snack_producto_costo").select("id_producto,precio_compra"),
  ]);

  if (productError) throw productError;
  if (costError) throw costError;

  const costMap = new Map<number, number>();
  for (const row of costs ?? []) {
    costMap.set(Number((row as any).id_producto), num((row as any).precio_compra));
  }

  return (products ?? []).map((row: any) => ({
    ...row,
    id_producto: Number(row.id_producto),
    cantidad: num(row.cantidad),
    precio: num(row.precio),
    activo: row.activo !== false,
    precio_compra: costMap.has(Number(row.id_producto)) ? costMap.get(Number(row.id_producto))! : null,
  })) as SnackAdminProduct[];
}

export async function saveSnackPurchasePrice(idProducto: number, precioCompra: number) {
  await requireAdmin();
  const price = num(precioCompra);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("El precio de compra debe ser igual o mayor a cero.");
  }

  const { data, error } = await client().rpc("admin_guardar_costo_snack", {
    p_id_producto: Number(idProducto),
    p_precio_compra: price,
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("snack-cost-changed"));
  return data;
}

export async function getSnackAdminDashboard(fromDate?: string | null, toDate?: string | null): Promise<SnackAdminDashboard> {
  await requireAdmin();

  const { data, error } = await client().rpc("admin_resumen_snacks", {
    p_desde: fromDate || null,
    p_hasta: toDate || null,
  });
  if (error) throw error;

  const raw: any = data ?? {};
  return {
    ventas: num(raw.ventas),
    ingresos: num(raw.ingresos),
    unidades: num(raw.unidades),
    costo_vendido: num(raw.costo_vendido),
    ganancia_bruta: num(raw.ganancia_bruta),
    margen: num(raw.margen),
    ticket_promedio: num(raw.ticket_promedio),
    lineas_sin_costo: num(raw.lineas_sin_costo),
    costos_estimados: num(raw.costos_estimados),
    retiros_unidades: num(raw.retiros_unidades),
    costo_retiros: num(raw.costo_retiros),
    productos_activos: num(raw.productos_activos),
    stock_unidades: num(raw.stock_unidades),
    capital_invertido: num(raw.capital_invertido),
    valor_potencial_venta: num(raw.valor_potencial_venta),
    ganancia_potencial: num(raw.ganancia_potencial),
    productos_sin_costo: num(raw.productos_sin_costo),
    top_productos: Array.isArray(raw.top_productos) ? raw.top_productos.map((row: any) => ({
      id_producto: row.id_producto == null ? null : Number(row.id_producto),
      nombre_producto: String(row.nombre_producto ?? ""),
      unidades: num(row.unidades),
      ingresos: num(row.ingresos),
      costo: num(row.costo),
      ganancia: num(row.ganancia),
      margen: num(row.margen),
      lineas_sin_costo: num(row.lineas_sin_costo),
    })) : [],
    metodos_pago: Array.isArray(raw.metodos_pago) ? raw.metodos_pago.map((row: any) => ({
      medio_pago: String(row.medio_pago ?? ""),
      ventas: num(row.ventas),
      total: num(row.total),
    })) : [],
  };
}

export async function createSnackProduct(payload: {
  numero_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio: number;
}) {
  await requireAdmin();
  const clean = {
    numero_producto: payload.numero_producto.trim().toUpperCase(),
    nombre_producto: payload.nombre_producto.trim(),
    cantidad: Math.max(0, Math.floor(num(payload.cantidad))),
    precio: Math.max(0, num(payload.precio)),
    activo: true,
  };
  if (!clean.numero_producto || !clean.nombre_producto) throw new Error("Número y nombre del producto son obligatorios.");
  if (clean.precio <= 0) throw new Error("El precio debe ser mayor a cero.");

  const { data, error } = await client().from("snack_producto").insert(clean).select().single();
  if (error) throw error;
  return data;
}

export async function updateSnackProduct(idProducto: number, payload: Partial<Pick<SnackProduct, "numero_producto" | "nombre_producto" | "cantidad" | "precio" | "activo">>) {
  await requireAdmin();
  const clean: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
  if (typeof payload.numero_producto === "string") clean.numero_producto = payload.numero_producto.trim().toUpperCase();
  if (typeof payload.nombre_producto === "string") clean.nombre_producto = payload.nombre_producto.trim();
  if (payload.cantidad != null) clean.cantidad = Math.max(0, Math.floor(num(payload.cantidad)));
  if (payload.precio != null) clean.precio = Math.max(0, num(payload.precio));

  const { data, error } = await client().from("snack_producto").update(clean).eq("id_producto", idProducto).select().single();
  if (error) throw error;
  return data;
}

export async function setSnackProductActive(idProducto: number, activo: boolean) {
  return updateSnackProduct(idProducto, { activo });
}

export async function withdrawSnackStock(idProducto: number, cantidad: number, motivo: string) {
  await requireAdmin();
  const cleanQuantity = Math.floor(num(cantidad));
  const cleanReason = motivo.trim();

  if (!Number.isInteger(cleanQuantity) || cleanQuantity <= 0) {
    throw new Error("La cantidad a retirar debe ser mayor a cero.");
  }
  if (!cleanReason) {
    throw new Error("Indica el motivo del retiro del inventario.");
  }

  const { data, error } = await client().rpc("retirar_stock_snack", {
    p_id_producto: Number(idProducto),
    p_cantidad: cleanQuantity,
    p_motivo: cleanReason,
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("snack-stock-changed"));
  return data;
}

function nextDate(fecha: string) {
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function getSnackSalesByDate(fecha: string): Promise<SnackSale[]> {
  const from = `${fecha}T00:00:00-05:00`;
  const to = `${nextDate(fecha)}T00:00:00-05:00`;

  const { data: salesData, error: salesError } = await client()
    .from("snack_venta")
    .select("id_venta,fecha_venta,medio_pago,total,vendedor_user_id,vendedor_email")
    .gte("fecha_venta", from)
    .lt("fecha_venta", to)
    .order("fecha_venta", { ascending: false });
  if (salesError) throw salesError;

  const sales = salesData ?? [];
  const ids = sales.map((row: any) => Number(row.id_venta));
  if (!ids.length) return [];

  const { data: detailData, error: detailError } = await client()
    .from("snack_venta_detalle")
    .select("id_detalle,id_venta,id_producto,numero_producto,nombre_producto,cantidad,precio_unitario,subtotal")
    .in("id_venta", ids)
    .order("id_detalle", { ascending: true });
  if (detailError) throw detailError;

  const grouped = new Map<number, SnackSaleItem[]>();
  for (const row of detailData ?? []) {
    const item: SnackSaleItem = {
      id_detalle: Number((row as any).id_detalle),
      id_venta: Number((row as any).id_venta),
      id_producto: (row as any).id_producto == null ? null : Number((row as any).id_producto),
      numero_producto: String((row as any).numero_producto ?? ""),
      nombre_producto: String((row as any).nombre_producto ?? ""),
      cantidad: num((row as any).cantidad),
      precio_unitario: num((row as any).precio_unitario),
      subtotal: num((row as any).subtotal),
    };
    const list = grouped.get(item.id_venta) ?? [];
    list.push(item);
    grouped.set(item.id_venta, list);
  }

  return sales.map((row: any) => ({
    id_venta: Number(row.id_venta),
    fecha_venta: String(row.fecha_venta),
    medio_pago: String(row.medio_pago ?? ""),
    total: num(row.total),
    vendedor_user_id: row.vendedor_user_id ? String(row.vendedor_user_id) : null,
    vendedor_email: String(row.vendedor_email ?? ""),
    items: grouped.get(Number(row.id_venta)) ?? [],
  }));
}

export async function registerSnackSale(items: SnackSaleInput[], medioPago: string) {
  const current = await getCurrentRole();
  if (!current) throw new Error("No fue posible identificar el usuario que registra la venta.");

  const cleanItems = items
    .map((item) => ({ id_producto: Number(item.id_producto), cantidad: Math.floor(num(item.cantidad)) }))
    .filter((item) => item.id_producto > 0 && item.cantidad > 0);

  if (!cleanItems.length) throw new Error("Agrega al menos un producto a la venta.");
  if (!medioPago.trim()) throw new Error("Selecciona el método de pago.");

  const { data, error } = await client().rpc("registrar_venta_snack", {
    p_items: cleanItems,
    p_medio_pago: medioPago.trim(),
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("snack-sale-recorded"));
  return data;
}
