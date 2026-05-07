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
  pacientes: { nombre: string; apellidos: string } | null;
  servicios: { nombre: string } | null;
  profesionales: { nombre: string } | null;
};

type ResumenAlertas = {
  sinProfesional: number;
  sinConfirmar: number;
  noShows: number;
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
          pacientes(nombre, apellidos),
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
      setLoading(false);
    }

    void loadDashboard();
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
            <nav className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
              <button className="rounded-lg bg-white px-4 py-2 text-slate-900 shadow-sm">
                Agenda
              </button>
              <button className="rounded-lg px-4 py-2 text-slate-600 hover:text-slate-900">
                Alertas
              </button>
              <button className="rounded-lg px-4 py-2 text-slate-600 hover:text-slate-900">
                Estadísticas
              </button>
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
                        <Link
                          href={`/dashboard/paciente/${cita.paciente_id}`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                        >
                          Ver ficha
                        </Link>
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
