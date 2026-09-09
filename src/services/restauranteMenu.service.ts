import { supabase } from "../lib/supabase";

export type RestauranteMenuItem = {
  id_menu: number;
  restaurante: string;
  nombre_plato: string;
  descripcion?: string | null;
  activo: boolean;
  orden: number;
};

function client() {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}

export async function getMenusActivosPorRestaurante(restaurante: string): Promise<RestauranteMenuItem[]> {
  const nombre = String(restaurante || "").trim();
  if (!nombre) return [];

  const { data, error } = await client()
    .from("restaurante_menu")
    .select("id_menu, restaurante, nombre_plato, descripcion, activo, orden")
    .eq("activo", true)
    .ilike("restaurante", nombre)
    .order("orden", { ascending: true })
    .order("nombre_plato", { ascending: true });

  if (error) {
    // Mientras la tabla/configuración no exista, el Control Operativo conserva
    // el campo actual sin romper la edición de reservas.
    console.warn("No fue posible cargar restaurante_menu:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id_menu: Number(row.id_menu),
    restaurante: String(row.restaurante ?? ""),
    nombre_plato: String(row.nombre_plato ?? ""),
    descripcion: row.descripcion == null ? null : String(row.descripcion),
    activo: Boolean(row.activo),
    orden: Number(row.orden ?? 0),
  }));
}
