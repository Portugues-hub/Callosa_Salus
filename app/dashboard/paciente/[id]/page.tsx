"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Paciente = {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string | null;
  fecha_nacimiento: string | null;
  direccion: string | null;
  seguro_medico: string | null;
  canal_preferido: string;
  tipo: "nuevo" | "recurrente";
};

type Cita = {
  id: string;
  fecha_hora: string;
  estado: "confirmada" | "pendiente" | "completada" | "cancelada" | "no_show";
  notas: string | null;
  servicio_id: string;
  servicios: { nombre: string } | null;
  profesionales: { nombre: string } | null;
};

type AlertaClinica = {
  id: string;
  tipo: string;
  descripcion: string;
  creado_en: string;
};

type Nota = {
  id: string;
  autor: string;
  contenido: string;
  creado_en: string;
};

type TabId = "datos" | "historial" | "clinico" | "notas";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = supabaseReady
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

const tabs: { id: TabId; label: string }[] = [
  { id: "datos", label: "DATOS" },
  { id: "historial", label: "HISTORIAL" },
  { id: "clinico", label: "CLÍNICO" },
  { id: "notas", label: "NOTAS" },
];

const estadoClass: Record<Cita["estado"], string> = {
  confirmada: "bg-blue-100 text-blue-700",
  pendiente: "bg-amber-100 text-amber-700",
  completada: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-rose-100 text-rose-700",
  no_show: "bg-zinc-200 text-zinc-700",
};

function initials(nombre?: string, apellidos?: string): string {
  return `${nombre?.[0] ?? ""}${apellidos?.[0] ?? ""}`.toUpperCase() || "NA";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "Sin dato";
  return new Date(value).toLocaleDateString("es-ES");
}

function alertClass(tipo: string): string {
  const lower = tipo.toLowerCase();
  if (lower.includes("alerg") || lower.includes("riesgo")) {
    return "border-rose-300 bg-rose-50 text-rose-800";
  }
  return "border-amber-300 bg-amber-50 text-amber-800";
}

export default function PacientePage() {
  const params = useParams<{ id: string }>();
  const pacienteId = params.id;

  const [activeTab, setActiveTab] = useState<TabId>("datos");
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [alertas, setAlertas] = useState<AlertaClinica[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevaNota, setNuevaNota] = useState({ autor: "Recepción", contenido: "" });
  const [savingNota, setSavingNota] = useState(false);

  async function loadPacienteData() {
    if (!supabase || !pacienteId) {
      setError(
        "No se pudo conectar a Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [pRes, cRes, aRes, nRes] = await Promise.all([
      supabase.from("pacientes").select("*").eq("id", pacienteId).single(),
      supabase
        .from("citas")
        .select(
          "id, fecha_hora, estado, notas, servicio_id, servicios(nombre), profesionales(nombre)"
        )
        .eq("paciente_id", pacienteId)
        .order("fecha_hora", { ascending: false }),
      supabase
        .from("alertas_clinicas")
        .select("id, tipo, descripcion, creado_en")
        .eq("paciente_id", pacienteId)
        .order("creado_en", { ascending: false }),
      supabase
        .from("notas_paciente")
        .select("id, autor, contenido, creado_en")
        .eq("paciente_id", pacienteId)
        .order("creado_en", { ascending: false }),
    ]);

    if (pRes.error || cRes.error || aRes.error || nRes.error) {
      setError(
        pRes.error?.message ??
          cRes.error?.message ??
          aRes.error?.message ??
          nRes.error?.message ??
          "No se pudo cargar la ficha."
      );
      setLoading(false);
      return;
    }

    setPaciente((pRes.data ?? null) as Paciente | null);
    setCitas((cRes.data ?? []) as Cita[]);
    setAlertas((aRes.data ?? []) as AlertaClinica[]);
    setNotas((nRes.data ?? []) as Nota[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadPacienteData();
  }, [pacienteId]);

  const metricas = useMemo(() => {
    const total = citas.length;
    const noShows = citas.filter((c) => c.estado === "no_show").length;
    const asistidas = citas.filter((c) => c.estado === "completada").length;
    const asistencia = total > 0 ? Math.round((asistidas / total) * 100) : 0;
    const proxima = [...citas]
      .filter((c) => new Date(c.fecha_hora) >= new Date())
      .sort((a, b) => +new Date(a.fecha_hora) - +new Date(b.fecha_hora))[0];

    return {
      total,
      noShows,
      asistencia,
      proxima: proxima ? formatDateTime(proxima.fecha_hora) : "Sin próxima cita",
    };
  }, [citas]);

  const ciclosServicios = useMemo(() => {
    const counter = new Map<string, number>();
    for (const c of citas) {
      counter.set(c.servicio_id, (counter.get(c.servicio_id) ?? 0) + 1);
    }
    return counter;
  }, [citas]);

  const motivoPrincipal = useMemo(() => {
    const latestAlert = alertas[0];
    if (latestAlert) return `${latestAlert.tipo}: ${latestAlert.descripcion}`;
    const latestCitaConNota = citas.find((c) => c.notas);
    return latestCitaConNota?.notas ?? "Sin motivo principal registrado";
  }, [alertas, citas]);

  const profesionalReferencia = useMemo(() => {
    const count = new Map<string, number>();
    for (const c of citas) {
      const name = c.profesionales?.nombre;
      if (!name) continue;
      count.set(name, (count.get(name) ?? 0) + 1);
    }
    let top = "Sin asignar";
    let max = 0;
    for (const [name, c] of count.entries()) {
      if (c > max) {
        top = name;
        max = c;
      }
    }
    return top;
  }, [citas]);

  async function handleNuevaNota(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !pacienteId || !nuevaNota.contenido.trim()) return;

    setSavingNota(true);
    setError(null);

    const { error: insertError } = await supabase.from("notas_paciente").insert({
      paciente_id: pacienteId,
      autor: nuevaNota.autor.trim() || "Recepción",
      contenido: nuevaNota.contenido.trim(),
    });

    if (insertError) {
      setError(`No se pudo guardar la nota: ${insertError.message}`);
      setSavingNota(false);
      return;
    }

    setNuevaNota((v) => ({ ...v, contenido: "" }));
    setSavingNota(false);
    await loadPacienteData();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-700">
                {initials(paciente?.nombre, paciente?.apellidos)}
              </div>
              <div>
                <p className="text-sm text-slate-500">Ficha paciente</p>
                <h1 className="text-2xl font-semibold">
                  {paciente ? `${paciente.nombre} ${paciente.apellidos}` : "Cargando..."}
                </h1>
                {paciente && (
                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      paciente.tipo === "nuevo"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {paciente.tipo}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={
                  paciente?.telefono
                    ? `https://wa.me/${paciente.telefono.replace(/\D/g, "")}`
                    : "#"
                }
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                WhatsApp
              </Link>
              <Link
                href={paciente?.telefono ? `tel:${paciente.telefono}` : "#"}
                className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Llamar
              </Link>
              <Link
                href={`/dashboard/paciente/${pacienteId}/editar`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Editar ficha
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                Volver
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-500">Total citas</p>
              <p className="text-2xl font-semibold">{metricas.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-500">% asistencia</p>
              <p className="text-2xl font-semibold">{metricas.asistencia}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-500">No-shows</p>
              <p className="text-2xl font-semibold">{metricas.noShows}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-500">Próxima cita</p>
              <p className="text-sm font-semibold">{metricas.proxima}</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <nav className="mb-5 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {loading && <p className="text-sm text-slate-500">Cargando ficha...</p>}
          {error && (
            <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {!loading && !error && activeTab === "datos" && paciente && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Nombre</p>
                <p className="font-medium">{paciente.nombre}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Apellidos</p>
                <p className="font-medium">{paciente.apellidos}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Teléfono</p>
                <p className="font-medium">{paciente.telefono || "Sin dato"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium">{paciente.email || "Sin dato"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Fecha nacimiento</p>
                <p className="font-medium">{formatDate(paciente.fecha_nacimiento)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Dirección</p>
                <p className="font-medium">{paciente.direccion || "Sin dato"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Seguro médico</p>
                <p className="font-medium">{paciente.seguro_medico || "Sin dato"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Canal preferido</p>
                <p className="font-medium">{paciente.canal_preferido || "Sin dato"}</p>
              </div>
            </div>
          )}

          {!loading && !error && activeTab === "historial" && (
            <div className="space-y-3">
              {citas.length === 0 && (
                <p className="text-sm text-slate-500">Sin historial de citas.</p>
              )}
              {citas.map((cita) => {
                const esCiclo = (ciclosServicios.get(cita.servicio_id) ?? 0) > 1;
                return (
                  <article
                    key={cita.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{formatDateTime(cita.fecha_hora)}</p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${estadoClass[cita.estado]}`}
                      >
                        {cita.estado.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      <span className="text-slate-500">Servicio:</span>{" "}
                      {cita.servicios?.nombre ?? "Sin servicio"}
                    </p>
                    <p className="text-sm">
                      <span className="text-slate-500">Profesional:</span>{" "}
                      {cita.profesionales?.nombre ?? "Sin asignar"}
                    </p>
                    {esCiclo && (
                      <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">
                        Parte de ciclo de sesiones
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {!loading && !error && activeTab === "clinico" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Motivo principal</p>
                <p className="mt-1 font-medium">{motivoPrincipal}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500">Profesional de referencia</p>
                <p className="mt-1 font-medium">{profesionalReferencia}</p>
              </div>
              <div className="space-y-2">
                {alertas.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Sin alertas clínicas registradas.
                  </p>
                )}
                {alertas.map((alerta) => (
                  <article
                    key={alerta.id}
                    className={`rounded-xl border p-4 ${alertClass(alerta.tipo)}`}
                  >
                    <p className="font-semibold">
                      {alerta.tipo} · {formatDate(alerta.creado_en)}
                    </p>
                    <p className="mt-1 text-sm">{alerta.descripcion}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && activeTab === "notas" && (
            <div className="space-y-4">
              <form
                onSubmit={handleNuevaNota}
                className="rounded-xl border border-slate-200 p-4"
              >
                <h3 className="mb-2 font-semibold">Añadir nota nueva</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
                  <input
                    value={nuevaNota.autor}
                    onChange={(e) =>
                      setNuevaNota((v) => ({ ...v, autor: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Autor"
                  />
                  <textarea
                    value={nuevaNota.contenido}
                    onChange={(e) =>
                      setNuevaNota((v) => ({ ...v, contenido: e.target.value }))
                    }
                    className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Escribe una nota para el equipo..."
                    required
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNota}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingNota ? "Guardando..." : "Guardar nota"}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {notas.length === 0 && (
                  <p className="text-sm text-slate-500">No hay notas todavía.</p>
                )}
                {notas.map((nota) => (
                  <article key={nota.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{nota.autor}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(nota.creado_en)}</p>
                    </div>
                    <p className="mt-2 text-sm">{nota.contenido}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
