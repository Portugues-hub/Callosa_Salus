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

type ViewMode = "week" | "month";

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

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getCalendarStartMonday(monthDate: Date): Date {
  const first = startOfMonth(monthDate);
  const day = first.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(first, diff);
}

function getCalendarEndSunday(monthDate: Date): Date {
  const last = endOfMonth(monthDate);
  const day = last.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const end = addDays(last, diff);
  end.setHours(23, 59, 59, 999);
  return end;
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
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday());
  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedMonthDay, setSelectedMonthDay] = useState<Date | null>(null);
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
  const monthWeeks = useMemo(() => {
    const start = getCalendarStartMonday(monthCursor);
    const end = getCalendarEndSunday(monthCursor);
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [monthCursor]);
  const monthLabel = useMemo(
    () => monthCursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
    [monthCursor]
  );

  async function loadAgendaData(rangeStart: Date, rangeEnd: Date) {
    if (!supabase) {
      setError(
        "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY)."
      );
      setLoading(false);
      return;
    }

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
        .gte("fecha_hora", rangeStart.toISOString())
        .lte("fecha_hora", rangeEnd.toISOString())
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
    const saved = window.localStorage.getItem("agenda:viewMode");
    if (saved === "week" || saved === "month") {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("agenda:viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "month") return;
    if (!selectedMonthDay || selectedMonthDay.getMonth() !== monthCursor.getMonth()) {
      setSelectedMonthDay(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1));
    }
  }, [viewMode, monthCursor, selectedMonthDay]);

  useEffect(() => {
    if (viewMode === "week") {
      const start = new Date(weekStart);
      start.setHours(0, 0, 0, 0);
      const end = addDays(weekStart, 4);
      end.setHours(23, 59, 59, 999);
      void loadAgendaData(start, end);
      return;
    }

    const start = getCalendarStartMonday(monthCursor);
    start.setHours(0, 0, 0, 0);
    const end = getCalendarEndSunday(monthCursor);
    void loadAgendaData(start, end);
  }, [weekStart, monthCursor, viewMode]);

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

  const citasPorDiaMes = useMemo(() => {
    const map = new Map<string, CitaSemana[]>();
    for (const cita of citas) {
      const d = new Date(cita.fecha_hora);
      const key = d.toISOString().slice(0, 10);
      const current = map.get(key) ?? [];
      current.push(cita);
      map.set(key, current);
    }
    for (const [key, arr] of map.entries()) {
      arr.sort(
        (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
      );
      map.set(key, arr);
    }
    return map;
  }, [citas]);

  const selectedMonthDayAppointments = useMemo(() => {
    if (!selectedMonthDay) return [];
    return citasPorDiaMes.get(selectedMonthDay.toISOString().slice(0, 10)) ?? [];
  }, [selectedMonthDay, citasPorDiaMes]);

  const filteredProfesionales = useMemo(() => {
    if (!form.servicioId) return profesionales;
    const servicio = servicios.find((s) => s.id === form.servicioId);
    if (!servicio) return profesionales;
    return profesionales.filter((p) => p.id === servicio.profesional_id);
  }, [form.servicioId, profesionales, servicios]);

  function openSlot(dayIndex: number, slot: string) {
    openSlotForDate(weekDays[dayIndex], slot);
  }

  function openSlotForDate(baseDate: Date, slot: string) {
    const [hours, minutes] = slot.split(":").map(Number);
    const date = new Date(baseDate);
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
    if (viewMode === "week") {
      const start = new Date(weekStart);
      start.setHours(0, 0, 0, 0);
      const end = addDays(weekStart, 4);
      end.setHours(23, 59, 59, 999);
      await loadAgendaData(start, end);
      return;
    }

    const start = getCalendarStartMonday(monthCursor);
    start.setHours(0, 0, 0, 0);
    const end = getCalendarEndSunday(monthCursor);
    await loadAgendaData(start, end);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">
                {viewMode === "week" ? "Agenda semanal" : "Agenda mensual"}
              </h1>
              <p className="text-sm text-slate-600">
                {viewMode === "week"
                  ? "Vista de lunes a viernes, de 09:00 a 19:00."
                  : "Calendario mensual con detalle diario de citas y huecos."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
                <button
                  onClick={() => setViewMode("week")}
                  className={`rounded-md px-3 py-1.5 ${
                    viewMode === "week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setViewMode("month")}
                  className={`rounded-md px-3 py-1.5 ${
                    viewMode === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Mes
                </button>
              </div>
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                Volver al dashboard
              </Link>
              {viewMode === "week" ? (
                <>
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
                </>
              ) : (
                <>
                  <button
                    onClick={() =>
                      setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    ← Mes anterior
                  </button>
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium capitalize text-slate-700">
                    {monthLabel}
                  </span>
                  <button
                    onClick={() =>
                      setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    Mes siguiente →
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {error && (
          <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800">
            {error}
          </section>
        )}

        {viewMode === "week" ? (
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
        ) : (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-600">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((name) => (
                  <div key={name} className="px-2 py-3">
                    {name}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthWeeks.flat().map((day) => {
                  const key = day.toISOString().slice(0, 10);
                  const citasDia = citasPorDiaMes.get(key) ?? [];
                  const inCurrentMonth = day.getMonth() === monthCursor.getMonth();
                  const isSelected = selectedMonthDay?.toISOString().slice(0, 10) === key;
                  const dotColor =
                    citasDia.length >= 5
                      ? "bg-rose-500"
                      : citasDia.length >= 3
                        ? "bg-amber-500"
                        : "bg-emerald-500";

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedMonthDay(day)}
                      className={`min-h-24 border-b border-r border-slate-100 p-2 text-left transition hover:bg-slate-50 ${
                        isSelected ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-medium ${
                            inCurrentMonth ? "text-slate-800" : "text-slate-400"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {citasDia.length > 0 && (
                          <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {citasDia.length} {citasDia.length === 1 ? "cita" : "citas"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-semibold">Detalle del día</h3>
              {selectedMonthDay ? (
                <>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedMonthDay.toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                    })}
                  </p>
                  <div className="mt-4 space-y-2">
                    {slots.map((slot) => {
                      const cita = selectedMonthDayAppointments.find((c) => {
                        const d = new Date(c.fecha_hora);
                        const hour = String(d.getHours()).padStart(2, "0");
                        const minutes = d.getMinutes() >= 30 ? "30" : "00";
                        return `${hour}:${minutes}` === slot;
                      });
                      return cita ? (
                        <div
                          key={slot}
                          className={`rounded-lg border px-3 py-2 text-xs ${hashColor(
                            cita.servicio_id
                          )}`}
                        >
                          <p className="font-semibold">
                            {slot} · {cita.servicios?.nombre ?? "Servicio"}
                          </p>
                          <p>
                            {cita.pacientes?.nombre} {cita.pacientes?.apellidos}
                          </p>
                        </div>
                      ) : (
                        <button
                          key={slot}
                          onClick={() => openSlotForDate(selectedMonthDay, slot)}
                          className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <span>{slot}</span>
                          <span className="font-semibold text-slate-400">+</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Haz clic en un día del calendario para ver sus citas y huecos.
                </p>
              )}
            </aside>
          </section>
        )}

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
