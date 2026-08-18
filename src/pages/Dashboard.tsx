import { useEffect, useRef, useState } from "react";
import "../styles/dashboard.css";
import "../styles/global.css";
import "../styles/responsive-admin.css";
import "../styles/desktop-admin-tuning.css";
import "../styles/sidebar-admin.css";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { logout } from "../services/auth.service";
import { supabase } from "../lib/supabase";
import {
  CalendarDays,
  Package,
  Users,
  UserCheck,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const DEMO_SESSION_KEY = "forigua:demo_session";
const SIDEBAR_KEY = "checua:sidebar_collapsed";
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;

const NAV_LINKS = [
  { to: "/app", label: "Resumen", icon: <LayoutDashboard size={16} />, end: true },
  { to: "/app/reservas", label: "Reservas", icon: <CalendarDays size={16} /> },
  { to: "/app/control-operativo", label: "Control Operativo", icon: <ClipboardList size={16} /> },
  { to: "/app/planes", label: "Planes", icon: <Package size={16} /> },
  { to: "/app/clientes", label: "Clientes", icon: <Users size={16} /> },
  { to: "/app/participantes", label: "Participantes", icon: <UserCheck size={16} /> },
];

function Dashboard() {
  const [userLabel, setUserLabel] = useState<string>("admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "true");
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const cerrarSesion = async (porInactividad = false) => {
    await logout();
    localStorage.removeItem(DEMO_SESSION_KEY);
    navigate("/", { replace: true, state: porInactividad ? { motivo: "inactividad" } : undefined });
  };

  const handleLogout = () => cerrarSesion(false);

  useEffect(() => {
    const reiniciar = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => cerrarSesion(true), INACTIVITY_LIMIT_MS);
    };
    const eventos: (keyof DocumentEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    eventos.forEach((ev) => document.addEventListener(ev, reiniciar, { passive: true }));
    reiniciar();
    return () => {
      eventos.forEach((ev) => document.removeEventListener(ev, reiniciar));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const demoRaw = localStorage.getItem(DEMO_SESSION_KEY);
    if (demoRaw) {
      try {
        const parsed = JSON.parse(demoRaw) as { email?: string };
        setUserLabel(parsed.email?.trim() || "demo@forigua.local");
      } catch { setUserLabel("demo@forigua.local"); }
      return;
    }
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.trim();
      if (email) setUserLabel(email);
    });
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) => ["dash-nav-link", isActive ? "active" : ""].join(" ");
  const sidebarLinkClass = ({ isActive }: { isActive: boolean }) => ["sidebar-link", isActive ? "active" : ""].join(" ");

  return (
    <div className="dash-root">
      <div className="dash-shell">
        <aside className={`dash-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon"><img src="/icono.png" alt="Icono Checua" /></div>
            <div className="sidebar-brand-copy">
              <strong>Desierto de Checua</strong>
              <span>Administración</span>
            </div>
          </div>

          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
            title={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>

          <nav className="sidebar-nav">
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={sidebarLinkClass} title={sidebarCollapsed ? l.label : undefined}>
                {l.icon}
                <span className="sidebar-link-label">{l.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{userLabel[0]?.toUpperCase() ?? "A"}</div>
              <div className="sidebar-user-copy">
                <span>Administrador</span>
                <span>{userLabel}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="sidebar-logout" title="Cerrar sesión">
              <LogOut size={17} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>

        <div className="dash-content">
          <header className="dash-header">
            <div className="dash-header-inner">
              <div className="dash-brand">
                <div className="dash-brand-icon"><img src="/icono.png" alt="Icono Checua" /></div>
                <span className="dash-brand-name">Desierto de Checua</span>
              </div>
              <nav className="dash-nav-desktop">
                {NAV_LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.icon}{l.label}</NavLink>)}
              </nav>
              <div className="dash-header-actions">
                <button onClick={handleLogout} className="dash-logout-btn dash-logout-desktop" title="Cerrar sesión"><LogOut size={16} /><span className="dash-logout-label">Cerrar sesión</span></button>
                <button className="dash-hamburger" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button>
              </div>
            </div>
          </header>

          {menuOpen && <div className="drawer-backdrop" />}
          <div ref={drawerRef} className={`drawer ${menuOpen ? "drawer-open" : ""}`}>
            <div className="drawer-top"><button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button></div>
            <div className="drawer-user"><div className="drawer-avatar">{userLabel[0]?.toUpperCase() ?? "A"}</div><span className="drawer-email">{userLabel}</span></div>
            <nav className="drawer-nav">
              {NAV_LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.icon}{l.label}</NavLink>)}
            </nav>
            <button onClick={handleLogout} className="drawer-logout"><LogOut size={16} />Cerrar sesión</button>
          </div>

          <main className="dash-main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
