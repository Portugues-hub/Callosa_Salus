"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type EstadoCita =
  | "confirmada"
  | "pendiente"
  | "completada"
  | "cancelada"
  | "no_show";

type CitaHoy = {
  id: string;
  paciente_id: string;
  servicio_id: string;
  profesional_id: string | null;
  fecha_hora: string;
  estado: EstadoCita;
  pacientes: { nombre: string; apellidos: string; telefono: string } | null;
  servicios: { nombre: string } | null;
  profesionales: { nombre: string } | null;
};

type ResumenAlertas = {
  sinProfesional: number;
  sinConfirmar: number;
  noShows: number;
};

type NotificacionTipo = "nueva_cita" | "mensaje" | "cancelacion";

type NotificacionRow = {
  id: string;
  tipo: NotificacionTipo;
  cita_id: string | null;
  paciente_id: string | null;
  leida: boolean;
  creado_en: string;
};

type CitaNotif = {
  id: string;
  fecha_hora: string;
  notas: string | null;
  pacientes: { nombre: string; apellidos: string; telefono: string } | null;
  servicios: { nombre: string } | null;
};

type PacienteNotif = {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
};

type NotificacionUI = NotificacionRow & {
  pacienteNombre: string;
  servicioNombre: string;
  horaCita: string;
  tieneMensaje: boolean;
  mensajePaciente: string;
  telefonoPaciente: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = supabaseReady
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

const estadoClass: Record<EstadoCita, string> = {
  confirmada: "bg-blue-100 text-blue-700",
  pendiente: "bg-amber-100 text-amber-700",
  completada: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-rose-100 text-rose-700",
  no_show: "bg-zinc-200 text-zinc-700",
};

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(nombre?: string, apellidos?: string): string {
  const n = nombre?.trim().charAt(0) ?? "";
  const a = apellidos?.trim().charAt(0) ?? "";
  return `${n}${a}`.toUpperCase() || "NA";
}

function startEndOfToday() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function normalizeWhatsappPhone(phone?: string | null): string {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0034")) return digits.slice(2);
  if (digits.startsWith("34")) return digits;
  return `34${digits}`;
}

function buildWhatsappMessage(cita: CitaHoy): string {
  const nombre = cita.pacientes?.nombre ?? "paciente";
  const servicio = cita.servicios?.nombre ?? "servicio";
  const date = new Date(cita.fecha_hora);
  const fecha = date.toLocaleDateString("es-ES");
  const hora = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `Hola ${nombre}, hemos recibido tu cita de ${servicio} el ${fecha} a las ${hora}. En respuesta a tu consulta: `;
}

function formatHourDate(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [citas, setCitas] = useState<CitaHoy[]>([]);
  const [alertas, setAlertas] = useState<ResumenAlertas>({
    sinProfesional: 0,
    sinConfirmar: 0,
    noShows: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingCitaId, setCancellingCitaId] = useState<string | null>(null);
  const [notificaciones, setNotificaciones] = useState<NotificacionUI[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  async function loadNotificaciones() {
    if (!supabase) return;
    const { data: notifRows, error: notifError } = await supabase
      .from("notificaciones")
      .select("id, tipo, cita_id, paciente_id, leida, creado_en")
      .order("creado_en", { ascending: false })
      .limit(20);

    if (notifError) return;

    const rows = (notifRows ?? []) as NotificacionRow[];
    const citaIds = rows.map((n) => n.cita_id).filter(Boolean) as string[];
    const pacienteIds = rows.map((n) => n.paciente_id).filter(Boolean) as string[];
    let citasNotif: CitaNotif[] = [];
    let pacientesNotif: PacienteNotif[] = [];
    if (citaIds.length > 0) {
      const { data: citaRows } = await supabase
        .from("citas")
        .select("id, fecha_hora, notas, pacientes(nombre, apellidos), servicios(nombre)")
        .in("id", citaIds);
      citasNotif = (citaRows ?? []) as unknown as CitaNotif[];
    }
    if (pacienteIds.length > 0) {
      const { data: pacienteRows } = await supabase
        .from("pacientes")
        .select("id, nombre, apellidos, telefono")
        .in("id", pacienteIds);
      pacientesNotif = (pacienteRows ?? []) as PacienteNotif[];
    }
    const citaMap = new Map<string, CitaNotif>(citasNotif.map((c) => [c.id, c]));
    const pacienteMap = new Map<string, PacienteNotif>(pacientesNotif.map((p) => [p.id, p]));
    const uiRows: NotificacionUI[] = rows.map((n) => {
      const cita = n.cita_id ? citaMap.get(n.cita_id) : undefined;
      const paciente = n.paciente_id ? pacienteMap.get(n.paciente_id) : undefined;
      return {
        ...n,
        pacienteNombre: paciente
          ? `${paciente.nombre} ${paciente.apellidos}`.trim()
          : cita?.pacientes
            ? `${cita.pacientes.nombre} ${cita.pacientes.apellidos}`.trim()
            : "Paciente",
        servicioNombre: cita?.servicios?.nombre ?? "Servicio",
        horaCita: cita ? formatHourDate(cita.fecha_hora) : "--:--",
        tieneMensaje: Boolean(cita?.notas?.trim()),
        mensajePaciente: cita?.notas?.trim() ?? "",
        telefonoPaciente: paciente?.telefono ?? "",
      };
    });
    setNotificaciones(uiRows);
  }

  useEffect(() => {
    async function loadDashboard() {
      if (!supabase) {
        setError(
          "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY)."
        );
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const { start, end } = startEndOfToday();

      const { data, error: citasError } = await supabase
        .from("citas")
        .select(
          `
          id,
          paciente_id,
          servicio_id,
          profesional_id,
          fecha_hora,
          estado,
          pacientes(nombre, apellidos, telefono),
          servicios(nombre),
          profesionales(nombre)
        `
        )
        .gte("fecha_hora", start.toISOString())
        .lte("fecha_hora", end.toISOString())
        .order("fecha_hora", { ascending: true });

      if (citasError) {
        setError(`No se pudieron cargar las citas: ${citasError.message}`);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as CitaHoy[];
      setCitas(rows);
      setAlertas({
        sinProfesional: rows.filter((c) => !c.profesional_id).length,
        sinConfirmar: rows.filter((c) => c.estado === "pendiente").length,
        noShows: rows.filter((c) => c.estado === "no_show").length,
      });
      await loadNotificaciones();
      setLoading(false);
    }

    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("dashboard-notificaciones")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones" },
        () => {
          void loadNotificaciones();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const metricas = useMemo(() => {
    const total = citas.length;
    const completadas = citas.filter((c) => c.estado === "completada").length;
    const noShow = citas.filter((c) => c.estado === "no_show").length;
    const proxima = citas.find((c) => new Date(c.fecha_hora) >= new Date());

    return {
      total,
      completadas,
      noShow,
      proxima: proxima ? `${formatHora(proxima.fecha_hora)} · ${proxima.pacientes?.nombre ?? "Sin nombre"}` : "Sin citas pendientes",
    };
  }, [citas]);

  async function handleLogout() {
    document.cookie = "cs_access_token=; path=/; max-age=0; samesite=lax";
    router.push("/login");
    router.refresh();
  }

  async function handleCancelarCita(cita: CitaHoy) {
    if (!supabase) return;
    setCancellingCitaId(cita.id);
    setError(null);

    const { error: cancelError } = await supabase
      .from("citas")
      .update({ estado: "cancelada" })
      .eq("id", cita.id);

    if (cancelError) {
      setError(`No se pudo cancelar la cita: ${cancelError.message}`);
      setCancellingCitaId(null);
      return;
    }

    setCitas((prev) => prev.map((c) => (c.id === cita.id ? { ...c, estado: "cancelada" } : c)));
    setCancellingCitaId(null);
  }

  function handleOpenWhatsapp(cita: CitaHoy) {
    const phone = normalizeWhatsappPhone(cita.pacientes?.telefono);
    if (!phone) return;
    const message = encodeURIComponent(buildWhatsappMessage(cita));
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  async function handleMarkAllRead() {
    if (!supabase) return;
    setMarkingRead(true);
    const { error: updateError } = await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("leida", false);
    if (!updateError) {
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    }
    setMarkingRead(false);
  }

  function handleReplyWhatsapp(notificacion: NotificacionUI) {
    const phone = normalizeWhatsappPhone(notificacion.telefonoPaciente);
    if (!phone || !notificacion.mensajePaciente) return;
    const message = encodeURIComponent(
      `Hola ${notificacion.pacienteNombre}, hemos recibido tu mensaje: "${notificacion.mensajePaciente}". `
    );
    const url = `https://wa.me/${phone}?text=${message}`;
    window.open(url, "_blank");
  }

  const unreadCount = useMemo(
    () => notificaciones.filter((n) => !n.leida).length,
    [notificaciones]
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Panel recepcionista</h1>
            <p className="text-sm text-slate-600">
              Gestión diaria de citas y alertas de CallosaSalud.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((v) => !v)}
                className="relative rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
                aria-label="Notificaciones"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 z-20 mt-2 w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">Notificaciones recientes</p>
                    <button
                      onClick={() => void handleMarkAllRead()}
                      disabled={markingRead}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
                    >
                      {markingRead ? "Marcando..." : "Marcar todas como leídas"}
                    </button>
                  </div>
                  <div className="max-h-96 space-y-2 overflow-auto">
                    {notificaciones.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        No hay notificaciones.
                      </p>
                    ) : (
                      notificaciones.map((n) => (
                        <article
                          key={n.id}
                          className={`rounded-lg border px-3 py-2 text-xs ${
                            n.leida ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"
                          }`}
                        >
                          <p className="font-semibold">
                            {n.pacienteNombre} · {n.servicioNombre}
                          </p>
                          <p className="text-slate-600">Hora cita: {n.horaCita}</p>
                          {n.tieneMensaje && (
                            <>
                              <p className="font-semibold text-slate-900">
                                Paciente dejó mensaje en la cita
                              </p>
                              <p className="italic text-slate-700">"{n.mensajePaciente}"</p>
                              <button
                                onClick={() => handleReplyWhatsapp(n)}
                                className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-50"
                              >
                                <span>💬</span>
                                <span>Responder</span>
                              </button>
                            </>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <nav className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
              <button className="rounded-lg bg-white px-4 py-2 text-slate-900 shadow-sm">
                Agenda
              </button>
              <button className="rounded-lg px-4 py-2 text-slate-600 hover:text-slate-900">
                Alertas
              </button>
              <Link
                href="/dashboard/estadisticas"
                className="rounded-lg px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                Estadísticas
              </Link>
            </nav>
            <Link
              href="/dashboard/agenda"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Agenda semanal
            </Link>
            <button
              onClick={() => void handleLogout()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {!supabaseReady && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
            en `.env.local` para cargar datos reales.
          </section>
        )}

        {error && (
          <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800">
            {error}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Total citas hoy</p>
            <p className="mt-2 text-3xl font-semibold">{metricas.total}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Citas completadas</p>
            <p className="mt-2 text-3xl font-semibold">{metricas.completadas}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">No presentados</p>
            <p className="mt-2 text-3xl font-semibold">{metricas.noShow}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Próxima cita</p>
            <p className="mt-2 text-base font-semibold">{metricas.proxima}</p>
          </article>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Citas de hoy</h2>
            {loading && <span className="text-sm text-slate-500">Cargando...</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Hora</th>
                  <th className="px-3 py-2 font-medium">Paciente</th>
                  <th className="px-3 py-2 font-medium">Servicio</th>
                  <th className="px-3 py-2 font-medium">Profesional</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {citas.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      No hay citas para hoy.
                    </td>
                  </tr>
                ) : (
                  citas.map((cita) => (
                    <tr key={cita.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-medium">
                        {formatHora(cita.fecha_hora)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700">
                            {getInitials(cita.pacientes?.nombre, cita.pacientes?.apellidos)}
                          </div>
                          <span>
                            {cita.pacientes?.nombre} {cita.pacientes?.apellidos}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">{cita.servicios?.nombre ?? "Sin servicio"}</td>
                      <td className="px-3 py-3">
                        {cita.profesionales?.nombre ?? "Sin asignar"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${estadoClass[cita.estado]}`}
                        >
                          {cita.estado.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/dashboard/paciente/${cita.paciente_id}`}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                          >
                            Ver ficha
                          </Link>
                          {cita.pacientes?.telefono && (
                            <button
                              onClick={() => handleOpenWhatsapp(cita)}
                              className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              WhatsApp
                            </button>
                          )}
                          {cita.estado !== "cancelada" && (
                            <button
                              onClick={() => void handleCancelarCita(cita)}
                              disabled={cancellingCitaId === cita.id}
                              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                            >
                              {cancellingCitaId === cita.id ? "Cancelando..." : "Cancelar"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold">Alertas visibles</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Citas sin profesional asignado</p>
              <p className="mt-2 text-2xl font-semibold">{alertas.sinProfesional}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Pacientes que no han confirmado</p>
              <p className="mt-2 text-2xl font-semibold">{alertas.sinConfirmar}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">No-shows del día</p>
              <p className="mt-2 text-2xl font-semibold">{alertas.noShows}</p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
