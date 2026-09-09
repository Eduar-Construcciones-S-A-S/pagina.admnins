import { useEffect } from "react";
import { getMenusActivosPorRestaurante } from "../../services/restauranteMenu.service";
import "../../styles/control-operativo-meals.css";

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

function findFieldLabel(text: string): HTMLLabelElement | null {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>(".op-edit-grid label"));
  const needle = normalize(text);
  return labels.find((label) => normalize(label.textContent).startsWith(needle)) ?? null;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function ControlOperativoMealSelector() {
  useEffect(() => {
    let disposed = false;
    let restaurantCleanup: (() => void) | null = null;
    let requestToken = 0;

    const enhance = async () => {
      if (disposed) return;

      const mealLabel = findFieldLabel("Tipo almuerzo");
      const restaurantLabel = findFieldLabel("Restaurante");
      const input = mealLabel?.querySelector<HTMLInputElement>("input");
      const restaurantSelect = restaurantLabel?.querySelector<HTMLSelectElement>("select");

      if (!mealLabel || !input || !restaurantSelect) return;

      const existing = mealLabel.querySelector<HTMLSelectElement>("select[data-restaurant-meal-selector='true']");
      const restaurant = restaurantSelect.value.trim();
      const includesLunchLabel = findFieldLabel("Incluye almuerzo");
      const includesLunchSelect = includesLunchLabel?.querySelector<HTMLSelectElement>("select");
      const lunchEnabled = !includesLunchSelect || normalize(includesLunchSelect.value) === "si" || normalize(includesLunchSelect.value) === "sí";

      if (!restaurant || !lunchEnabled) {
        if (existing) existing.remove();
        input.hidden = false;
        input.disabled = !lunchEnabled;
        input.placeholder = lunchEnabled ? "Selecciona primero un restaurante" : "No aplica";
        return;
      }

      const token = ++requestToken;
      const menus = await getMenusActivosPorRestaurante(restaurant);
      if (disposed || token !== requestToken) return;

      if (!menus.length) {
        if (existing) existing.remove();
        input.hidden = false;
        input.disabled = false;
        input.placeholder = `Sin menú configurado para ${restaurant}`;
        return;
      }

      const select = existing ?? document.createElement("select");
      select.dataset.restaurantMealSelector = "true";
      select.className = "op-restaurant-meal-select";
      select.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Seleccionar tipo de almuerzo";
      select.appendChild(placeholder);

      menus.forEach((menu) => {
        const option = document.createElement("option");
        option.value = menu.nombre_plato;
        option.textContent = menu.nombre_plato;
        if (menu.descripcion) option.title = menu.descripcion;
        select.appendChild(option);
      });

      const currentValue = input.value.trim();
      if (currentValue && menus.some((menu) => normalize(menu.nombre_plato) === normalize(currentValue))) {
        const exact = menus.find((menu) => normalize(menu.nombre_plato) === normalize(currentValue));
        select.value = exact?.nombre_plato ?? "";
      } else {
        select.value = "";
      }

      select.onchange = () => setReactInputValue(input, select.value);

      if (!existing) mealLabel.appendChild(select);
      input.hidden = true;
      input.disabled = false;

      if (!restaurantSelect.dataset.mealListenerAttached) {
        const onRestaurantChange = () => {
          setReactInputValue(input, "");
          void enhance();
        };
        restaurantSelect.addEventListener("change", onRestaurantChange);
        restaurantSelect.dataset.mealListenerAttached = "true";
        restaurantCleanup = () => {
          restaurantSelect.removeEventListener("change", onRestaurantChange);
          delete restaurantSelect.dataset.mealListenerAttached;
        };
      }

      if (includesLunchSelect && !includesLunchSelect.dataset.mealListenerAttached) {
        const onLunchChange = () => {
          if (normalize(includesLunchSelect.value) !== "si" && normalize(includesLunchSelect.value) !== "sí") {
            setReactInputValue(input, "");
          }
          void enhance();
        };
        includesLunchSelect.addEventListener("change", onLunchChange);
        includesLunchSelect.dataset.mealListenerAttached = "true";
      }
    };

    const observer = new MutationObserver(() => {
      void enhance();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    void enhance();

    return () => {
      disposed = true;
      observer.disconnect();
      restaurantCleanup?.();
    };
  }, []);

  return null;
}
