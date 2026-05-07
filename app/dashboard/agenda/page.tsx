"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type EstadoCita =
  | "confirmada"
  | "pendiente"
  | "completada"
  | "cancelada"
  | "no_show";

type CitaSemana = {
  id: string;
  paciente_id: string;
  servicio_id: string;
  profesional_id: string;
  fecha_hora: string;
  duracion_min: number;
  estado: EstadoCita;
  canal: "web" | "presencial" | "telefono";
  notas: string | null;
  pacientes: { nombre: string; apellidos: string; telefono: string } | null;
  servicios: { nombre: string } | null;
  profesionales: { nombre: string } | null;
};

type Servicio = {
  id: string;
  nombre: string;
  duracion_min: number;
  profesional_id: string;
  activo: boolean;
};

type Profesional = {
  id: string;
  nombre: string;
  especialidad: string;
  activo: boolean;
};

type Paciente = {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = supabaseReady
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const slotHeight = 52;

function getMonday(base = new Date()): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildSlots(): string[] {
  const out: string[] = [];
  for (let h = 9; h < 19; h += 1) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}

function toLocalInputValue(date: Date): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function hashColor(input: string): string {
  const palettes = [
    "bg-blue-100 border-blue-300 text-blue-800",
    "bg-emerald-100 border-emerald-300 text-emerald-800",
    "bg-violet-100 border-violet-300 text-violet-800",
    "bg-amber-100 border-amber-300 text-amber-800",
    "bg-rose-100 border-rose-300 text-rose-800",
  ];
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash += input.charCodeAt(i);
  return palettes[Math.abs(hash) % palettes.length];
}

function getInitials(nombre?: string, apellidos?: string): string {
  return `${nombre?.[0] ?? ""}${apellidos?.[0] ?? ""}`.toUpperCase() || "NA";
}

export default function AgendaPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday());
  const [citas, setCitas] = useState<CitaSemana[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<string>("");
  const [search, setSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Paciente[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Paciente | null>(null);
  const [registerNewPatient, setRegisterNewPatient] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newPatient, setNewPatient] = useState({
    nombre: "",
    apellidos: "",
    telefono: "",
    email: "",
  });

  const [form, setForm] = useState({
    servicioId: "",
    profesionalId: "",
    duracion: 30,
    notas: "",
    whatsapp: true,
  });

  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const slots = useMemo(() => buildSlots(), []);

  async function loadWeekData() {
    if (!supabase) {
      setError(
        "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY)."
      );
      setLoading(false);
      return;
    }

    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = addDays(weekStart, 4);
    end.setHours(23, 59, 59, 999);

    setLoading(true);
    setError(null);

    const [citasRes, serviciosRes, profesionalesRes] = await Promise.all([
      supabase
        .from("citas")
        .select(
          `
          id,
          paciente_id,
          servicio_id,
          profesional_id,
          fecha_hora,
          duracion_min,
          estado,
          canal,
          notas,
          pacientes(nombre, apellidos, telefono),
          servicios(nombre),
          profesionales(nombre)
        `
        )
        .gte("fecha_hora", start.toISOString())
        .lte("fecha_hora", end.toISOString())
        .order("fecha_hora", { ascending: true }),
      supabase.from("servicios").select("*").eq("activo", true).order("nombre"),
      supabase
        .from("profesionales")
        .select("*")
        .eq("activo", true)
        .order("nombre"),
    ]);

    if (citasRes.error || serviciosRes.error || profesionalesRes.error) {
      setError(
        citasRes.error?.message ??
          serviciosRes.error?.message ??
          profesionalesRes.error?.message ??
          "No se pudieron cargar los datos."
      );
      setLoading(false);
      return;
    }

    setCitas((citasRes.data ?? []) as unknown as CitaSemana[]);
    setServicios((serviciosRes.data ?? []) as unknown as Servicio[]);
    setProfesionales((profesionalesRes.data ?? []) as unknown as Profesional[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadWeekData();
  }, [weekStart]);

  useEffect(() => {
    async function searchPatients() {
      if (!supabase || !isModalOpen) return;
      const term = search.trim();
      if (term.length < 2) {
        setPatientResults([]);
        return;
      }

      const { data, error: searchError } = await supabase
        .from("pacientes")
        .select("id, nombre, apellidos, telefono, email")
        .or(
          `nombre.ilike.%${term}%,apellidos.ilike.%${term}%,telefono.ilike.%${term}%`
        )
        .order("nombre")
        .limit(8);

      if (!searchError) setPatientResults((data ?? []) as Paciente[]);
    }

    const t = setTimeout(() => {
      void searchPatients();
    }, 250);

    return () => clearTimeout(t);
  }, [search, isModalOpen]);

  const citasByKey = useMemo(() => {
    const map = new Map<string, CitaSemana>();
    for (const cita of citas) {
      const d = new Date(cita.fecha_hora);
      const day = d.getDay();
      if (day === 0 || day === 6) continue;
      const dayIndex = day - 1;
      const hour = String(d.getHours()).padStart(2, "0");
      const minutes = d.getMinutes() >= 30 ? "30" : "00";
      const slot = `${hour}:${minutes}`;
      map.set(`${dayIndex}-${slot}`, cita);
    }
    return map;
  }, [citas]);

  const filteredProfesionales = useMemo(() => {
    if (!form.servicioId) return profesionales;
    const servicio = servicios.find((s) => s.id === form.servicioId);
    if (!servicio) return profesionales;
    return profesionales.filter((p) => p.id === servicio.profesional_id);
  }, [form.servicioId, profesionales, servicios]);

  function openSlot(dayIndex: number, slot: string) {
    const [hours, minutes] = slot.split(":").map(Number);
    const date = new Date(weekDays[dayIndex]);
    date.setHours(hours, minutes, 0, 0);

    setSelectedDateTime(toLocalInputValue(date));
    setSelectedPatient(null);
    setSearch("");
    setPatientResults([]);
    setRegisterNewPatient(false);
    setForm({
      servicioId: "",
      profesionalId: "",
      duracion: 30,
      notas: "",
      whatsapp: true,
    });
    setNewPatient({ nombre: "", apellidos: "", telefono: "", email: "" });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    if (!selectedDateTime || !form.servicioId || !form.profesionalId) return;

    setSaving(true);
    setError(null);

    let pacienteId = selectedPatient?.id ?? "";

    if (registerNewPatient) {
      if (!newPatient.nombre || !newPatient.apellidos || !newPatient.telefono) {
        setError("Para registrar paciente nuevo, nombre, apellidos y teléfono son obligatorios.");
        setSaving(false);
        return;
      }

      const { data: newPac, error: patientInsertError } = await supabase
        .from("pacientes")
        .insert({
          nombre: newPatient.nombre.trim(),
          apellidos: newPatient.apellidos.trim(),
          telefono: newPatient.telefono.trim(),
          email: newPatient.email.trim() || null,
          canal_preferido: "whatsapp",
          tipo: "nuevo",
        })
        .select("id")
        .single();

      if (patientInsertError || !newPac) {
        setError(patientInsertError?.message ?? "No se pudo crear el paciente.");
        setSaving(false);
        return;
      }

      pacienteId = newPac.id;
    } else if (!pacienteId) {
      setError("Selecciona un paciente o registra uno nuevo.");
      setSaving(false);
      return;
    }

    const { data: citaCreada, error: insertCitaError } = await supabase
      .from("citas")
      .insert({
        paciente_id: pacienteId,
        servicio_id: form.servicioId,
        profesional_id: form.profesionalId,
        fecha_hora: new Date(selectedDateTime).toISOString(),
        duracion_min: form.duracion,
        estado: "pendiente",
        canal: "web",
        notas: form.notas.trim() || null,
      })
      .select("id")
      .single();

    if (insertCitaError || !citaCreada) {
      setError(insertCitaError?.message ?? "No se pudo crear la cita.");
      setSaving(false);
      return;
    }

    if (form.whatsapp) {
      await fetch("/api/notificaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirmacion",
          citaId: citaCreada.id,
        }),
      }).catch(() => {
        // No bloquea el alta manual de cita si falla WhatsApp.
      });
    }

    setIsModalOpen(false);
    setSaving(false);
    await loadWeekData();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Agenda semanal</h1>
              <p className="text-sm text-slate-600">
                Vista de lunes a viernes, de 09:00 a 19:00.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                Volver al dashboard
              </Link>
              <button
                onClick={() => setWeekStart((d) => addDays(d, -7))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                ← Semana anterior
              </button>
              <button
                onClick={() => setWeekStart((d) => addDays(d, 7))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                Semana siguiente →
              </button>
            </div>
          </div>
        </header>

        {error && (
          <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800">
            {error}
          </section>
        )}

        <section className="overflow-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[88px_repeat(5,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 text-sm font-medium text-slate-700">
              <div className="px-3 py-3">Hora</div>
              {weekDays.map((day, i) => (
                <div key={i} className="border-l border-slate-200 px-3 py-3">
                  {dayNames[i]} <span className="text-slate-500">{formatDayHeader(day)}</span>
                </div>
              ))}
            </div>

            {slots.map((slot) => (
              <div
                key={slot}
                className="grid grid-cols-[88px_repeat(5,minmax(0,1fr))] border-b border-slate-100 last:border-b-0"
                style={{ minHeight: slotHeight }}
              >
                <div className="px-3 py-3 text-xs text-slate-500">{slot}</div>
                {weekDays.map((_, dayIndex) => {
                  const key = `${dayIndex}-${slot}`;
                  const cita = citasByKey.get(key);
                  return (
                    <div key={key} className="group border-l border-slate-100 p-1">
                      {cita ? (
                        <div
                          className={`h-full rounded-lg border p-2 text-xs ${hashColor(
                            cita.servicio_id
                          )}`}
                        >
                          <p className="font-semibold leading-tight">
                            {cita.servicios?.nombre ?? "Servicio"}
                          </p>
                          <p className="truncate">
                            {cita.pacientes?.nombre} {cita.pacientes?.apellidos}
                          </p>
                          <p className="truncate text-[11px] opacity-80">
                            {cita.profesionales?.nombre}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => openSlot(dayIndex, slot)}
                          className="flex h-full w-full items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                          title="Crear cita"
                        >
                          <span className="hidden text-lg font-semibold group-hover:inline">
                            +
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {loading && <p className="text-sm text-slate-500">Cargando agenda...</p>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nueva cita</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium">Fecha y hora</label>
                <input
                  type="datetime-local"
                  value={selectedDateTime}
                  onChange={(e) => setSelectedDateTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Buscar paciente (nombre o teléfono)
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ej: Lucía o 612..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                {!!patientResults.length && !registerNewPatient && (
                  <div className="mt-2 space-y-1 rounded-lg border border-slate-200 p-2">
                    {patientResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setSelectedPatient(p);
                          setRegisterNewPatient(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-slate-100 ${
                          selectedPatient?.id === p.id ? "bg-slate-100" : ""
                        }`}
                      >
                        <span>
                          {getInitials(p.nombre, p.apellidos)} · {p.nombre} {p.apellidos}
                        </span>
                        <span className="text-slate-500">{p.telefono}</span>
                      </button>
                    ))}
                  </div>
                )}

                <label className="mt-3 inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={registerNewPatient}
                    onChange={(e) => {
                      setRegisterNewPatient(e.target.checked);
                      if (e.target.checked) setSelectedPatient(null);
                    }}
                  />
                  Registrar paciente nuevo
                </label>
              </div>

              {registerNewPatient && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    placeholder="Nombre"
                    value={newPatient.nombre}
                    onChange={(e) =>
                      setNewPatient((p) => ({ ...p, nombre: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                  <input
                    placeholder="Apellidos"
                    value={newPatient.apellidos}
                    onChange={(e) =>
                      setNewPatient((p) => ({ ...p, apellidos: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                  <input
                    placeholder="Teléfono"
                    value={newPatient.telefono}
                    onChange={(e) =>
                      setNewPatient((p) => ({ ...p, telefono: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    required
                  />
                  <input
                    placeholder="Email (opcional)"
                    value={newPatient.email}
                    onChange={(e) =>
                      setNewPatient((p) => ({ ...p, email: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Servicio</label>
                  <select
                    value={form.servicioId}
                    onChange={(e) => {
                      const serviceId = e.target.value;
                      const service = servicios.find((s) => s.id === serviceId);
                      setForm((f) => ({
                        ...f,
                        servicioId: serviceId,
                        profesionalId: service?.profesional_id ?? "",
                        duracion: service?.duracion_min ?? f.duracion,
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    required
                  >
                    <option value="">Selecciona servicio</option>
                    {servicios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Profesional</label>
                  <select
                    value={form.profesionalId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, profesionalId: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    required
                  >
                    <option value="">Selecciona profesional</option>
                    {filteredProfesionales.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.especialidad})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Duración</label>
                  <select
                    value={form.duracion}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, duracion: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {[30, 45, 60, 90].map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Observaciones para recepción o profesional"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.whatsapp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp: e.target.checked }))
                  }
                />
                Enviar confirmación por WhatsApp
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar cita"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
