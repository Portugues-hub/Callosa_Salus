"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Servicio = {
  id: string;
  nombre: string;
  duracion_min: number;
  profesional_id: string;
  activo: boolean;
};

type Cita = {
  id: string;
  fecha_hora: string;
  duracion_min: number;
  estado: "confirmada" | "pendiente" | "completada" | "cancelada" | "no_show";
};

type Slot = {
  date: Date;
  label: string;
};

type Step = 1 | 2 | 3 | 4 | 5;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitFullName(fullName: string): { nombre: string; apellidos: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombre: parts[0] ?? "", apellidos: "" };
  return {
    nombre: parts[0],
    apellidos: parts.slice(1).join(" "),
  };
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function buildDaySlots(selectedDay: Date, durationMin: number, citas: Cita[]): Slot[] {
  const slots: Slot[] = [];
  const now = new Date();

  const dayStart = new Date(selectedDay);
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date(selectedDay);
  dayEnd.setHours(19, 0, 0, 0);

  for (
    let cursor = new Date(dayStart);
    cursor <= new Date(dayEnd.getTime() - durationMin * 60000);
    cursor = new Date(cursor.getTime() + 30 * 60000)
  ) {
    const slotEnd = new Date(cursor.getTime() + durationMin * 60000);
    const isPast = cursor < now;
    if (isPast) continue;

    const occupied = citas.some((cita) => {
      if (cita.estado === "cancelada") return false;
      const citaStart = new Date(cita.fecha_hora);
      const citaEnd = new Date(citaStart.getTime() + (cita.duracion_min || 30) * 60000);
      return overlaps(cursor, slotEnd, citaStart, citaEnd);
    });

    if (!occupied) {
      slots.push({ date: cursor, label: formatHour(cursor) });
    }
  }

  return slots;
}

export default function WidgetPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [services, setServices] = useState<Servicio[]>([]);
  const [selectedService, setSelectedService] = useState<Servicio | null>(null);

  const [monthDate] = useState(new Date());
  const [citasMes, setCitasMes] = useState<Cita[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    async function loadServices() {
      if (!supabase) {
        setError(
          "No hay conexión con Supabase. Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: servicesError } = await supabase
        .from("servicios")
        .select("id, nombre, duracion_min, profesional_id, activo")
        .eq("activo", true)
        .order("nombre");

      if (servicesError) {
        setError(`No se pudieron cargar servicios: ${servicesError.message}`);
      } else {
        setServices((data ?? []) as Servicio[]);
      }

      setLoading(false);
    }

    void loadServices();
  }, []);

  async function loadMonthAppointments(service: Servicio) {
    if (!supabase) return;

    const start = monthStart(monthDate);
    const end = monthEnd(monthDate);

    const { data, error: citasError } = await supabase
      .from("citas")
      .select("id, fecha_hora, duracion_min, estado")
      .eq("profesional_id", service.profesional_id)
      .gte("fecha_hora", start.toISOString())
      .lte("fecha_hora", end.toISOString());

    if (citasError) {
      setError(`No se pudieron cargar citas del mes: ${citasError.message}`);
      return;
    }

    setCitasMes((data ?? []) as Cita[]);
  }

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    if (!selectedService) return map;

    const start = monthStart(monthDate);
    const end = monthEnd(monthDate);

    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
      const slots = buildDaySlots(d, selectedService.duracion_min, citasMes);
      if (slots.length > 0) map.set(dayKey(d), slots);
    }
    return map;
  }, [selectedService, monthDate, citasMes]);

  const daySlots = useMemo(() => {
    if (!selectedDay) return [];
    return slotsByDay.get(dayKey(selectedDay)) ?? [];
  }, [selectedDay, slotsByDay]);

  const calendarDays = useMemo(() => {
    const first = monthStart(monthDate);
    const last = monthEnd(monthDate);
    const startWeekday = (first.getDay() + 6) % 7;
    const totalDays = last.getDate();

    const list: Array<Date | null> = [];
    for (let i = 0; i < startWeekday; i += 1) list.push(null);
    for (let d = 1; d <= totalDays; d += 1) {
      list.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
    }
    return list;
  }, [monthDate]);

  async function handleSelectService(service: Servicio) {
    setSelectedService(service);
    setSelectedDay(null);
    setSelectedSlot(null);
    setError(null);
    setLoading(true);
    await loadMonthAppointments(service);
    setLoading(false);
    setStep(2);
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !selectedService || !selectedSlot) return;
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      setError("Completa nombre, teléfono y email.");
      return;
    }

    setSaving(true);
    setError(null);

    const normalizedPhone = phone.replace(/\s+/g, " ").trim();
    const { data: existingPatients, error: patientSearchError } = await supabase
      .from("pacientes")
      .select("id")
      .eq("telefono", normalizedPhone)
      .limit(1);

    if (patientSearchError) {
      setError(`Error buscando paciente: ${patientSearchError.message}`);
      setSaving(false);
      return;
    }

    let pacienteId = existingPatients?.[0]?.id as string | undefined;
    if (!pacienteId) {
      const names = splitFullName(fullName);
      const { data: newPatient, error: patientInsertError } = await supabase
        .from("pacientes")
        .insert({
          nombre: names.nombre || "Paciente",
          apellidos: names.apellidos || "Sin apellidos",
          telefono: normalizedPhone,
          email: email.trim(),
          canal_preferido: "whatsapp",
          tipo: "nuevo",
        })
        .select("id")
        .single();

      if (patientInsertError || !newPatient) {
        setError(patientInsertError?.message ?? "No se pudo crear el paciente.");
        setSaving(false);
        return;
      }
      pacienteId = newPatient.id;
    }

    const { data: cita, error: citaInsertError } = await supabase
      .from("citas")
      .insert({
        paciente_id: pacienteId,
        servicio_id: selectedService.id,
        profesional_id: selectedService.profesional_id,
        fecha_hora: selectedSlot.date.toISOString(),
        duracion_min: selectedService.duracion_min,
        estado: "pendiente",
        canal: "web",
        notas: "Reserva desde widget embebido",
      })
      .select("id")
      .single();

    if (citaInsertError || !cita) {
      setError(citaInsertError?.message ?? "No se pudo registrar la cita.");
      setSaving(false);
      return;
    }

    await fetch("/api/notificaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirmacion",
        citaId: cita.id,
      }),
    }).catch(() => {
      // No bloquea la reserva si falla WhatsApp.
    });

    setSuccessId(cita.id);
    setSaving(false);
    setStep(5);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Reserva tu cita</h1>
          <p className="text-sm text-slate-600">
            CallosaSalud · Reserva online en pocos pasos.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={`rounded-full px-2.5 py-1 ${
                  step === n
                    ? "bg-slate-900 text-white"
                    : step > n
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                Paso {n}
              </span>
            ))}
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {step === 1 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Servicio</h2>
            {loading ? (
              <p className="text-sm text-slate-500">Cargando servicios...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => void handleSelectService(service)}
                    className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    <p className="font-medium">{service.nombre}</p>
                    <p className="text-sm text-slate-600">{service.duracion_min} min</p>
                  </button>
                ))}
                {!services.length && (
                  <p className="text-sm text-slate-500">No hay servicios disponibles.</p>
                )}
              </div>
            )}
          </section>
        )}

        {step === 2 && selectedService && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">2. Fecha</h2>
            <p className="mb-4 text-sm text-slate-600">
              Selecciona un día con huecos disponibles en{" "}
              {monthDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}.
            </p>

            <div className="mb-2 grid grid-cols-7 gap-2">
              {weekdayLabels.map((w) => (
                <div key={w} className="text-center text-xs font-medium text-slate-500">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const key = dayKey(day);
                const available = (slotsByDay.get(key)?.length ?? 0) > 0;
                const selected = selectedDay && dayKey(selectedDay) === key;

                return (
                  <button
                    key={key}
                    disabled={!available}
                    onClick={() => {
                      setSelectedDay(day);
                      setSelectedSlot(null);
                      setStep(3);
                    }}
                    className={`h-10 rounded-lg text-sm ${
                      !available
                        ? "cursor-not-allowed bg-slate-100 text-slate-300"
                        : selected
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                ← Cambiar servicio
              </button>
            </div>
          </section>
        )}

        {step === 3 && selectedService && selectedDay && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">3. Hora</h2>
            <p className="mb-4 text-sm text-slate-600">
              {formatDateEs(selectedDay)} · {selectedService.nombre}
            </p>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {daySlots.map((slot) => (
                <button
                  key={slot.date.toISOString()}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep(4);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-slate-400 hover:bg-slate-50"
                >
                  {slot.label}
                </button>
              ))}
              {!daySlots.length && (
                <p className="col-span-full text-sm text-slate-500">
                  No hay huecos disponibles este día.
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                ← Cambiar fecha
              </button>
            </div>
          </section>
        )}

        {step === 4 && selectedService && selectedDay && selectedSlot && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">4. Confirmación</h2>
            <form onSubmit={handleConfirm} className="space-y-3">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Nombre completo"
                required
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Teléfono"
                required
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Email"
                required
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p>
                  <span className="text-slate-500">Servicio:</span> {selectedService.nombre}
                </p>
                <p>
                  <span className="text-slate-500">Duración:</span>{" "}
                  {selectedService.duracion_min} min
                </p>
                <p>
                  <span className="text-slate-500">Fecha:</span> {formatDateEs(selectedDay)}
                </p>
                <p>
                  <span className="text-slate-500">Hora:</span> {selectedSlot.label}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                >
                  ← Cambiar hora
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Reservando..." : "Reservar cita"}
                </button>
              </div>
            </form>
          </section>
        )}

        {step === 5 && selectedService && selectedDay && selectedSlot && (
          <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800">
            <h2 className="text-lg font-semibold">Reserva confirmada</h2>
            <p className="mt-1 text-sm">
              Tu solicitud se ha registrado correctamente con estado pendiente.
            </p>
            <div className="mt-3 text-sm">
              <p>
                <span className="font-medium">Servicio:</span> {selectedService.nombre}
              </p>
              <p>
                <span className="font-medium">Fecha y hora:</span> {formatDateEs(selectedDay)} ·{" "}
                {selectedSlot.label}
              </p>
              <p>
                <span className="font-medium">Paciente:</span> {fullName}
              </p>
              <p>
                <span className="font-medium">Referencia:</span> {successId}
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
