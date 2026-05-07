"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type PacienteEditable = {
  id: string;
  nombre: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  direccion: string | null;
  telefono: string;
  email: string | null;
  canal_preferido: "whatsapp" | "telefono" | "email";
  seguro_medico: string | null;
  tipo: "nuevo" | "recurrente";
  dni?: string | null;
  recordatorio_whatsapp?: boolean | null;
  recordatorio_email?: boolean | null;
  motivo_principal?: string | null;
  profesional_referencia?: string | null;
  observaciones_generales?: string | null;
};

type Profesional = {
  id: string;
  nombre: string;
};

type AlertaClinica = {
  id: string;
  tipo: string;
  descripcion: string;
  creado_en: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function initials(nombre?: string, apellidos?: string): string {
  return `${nombre?.[0] ?? ""}${apellidos?.[0] ?? ""}`.toUpperCase() || "NA";
}

function nowHourText(): string {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function EditarPacientePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pacienteId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [alertas, setAlertas] = useState<AlertaClinica[]>([]);
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);
  const [savingAlerta, setSavingAlerta] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    apellidos: "",
    fechaNacimiento: "",
    dni: "",
    direccion: "",
    telefono: "",
    email: "",
    canalPreferido: "whatsapp" as "whatsapp" | "telefono" | "email",
    seguroMedico: "",
    recordatorioWhatsapp: true,
    recordatorioEmail: false,
    motivoPrincipal: "",
    profesionalReferencia: "",
    tipoPaciente: "nuevo" as "nuevo" | "recurrente",
    observacionesGenerales: "",
  });

  const [nuevaAlerta, setNuevaAlerta] = useState({
    tipo: "alergia" as "alergia" | "medicación" | "intolerancia" | "observación",
    descripcion: "",
  });

  useEffect(() => {
    async function loadData() {
      if (!supabase || !pacienteId) {
        setError(
          "No se pudo conectar a Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [pacienteRes, alertasRes, profesionalesRes] = await Promise.all([
        supabase.from("pacientes").select("*").eq("id", pacienteId).single(),
        supabase
          .from("alertas_clinicas")
          .select("id, tipo, descripcion, creado_en")
          .eq("paciente_id", pacienteId)
          .order("creado_en", { ascending: false }),
        supabase.from("profesionales").select("id, nombre").eq("activo", true),
      ]);

      if (pacienteRes.error || alertasRes.error || profesionalesRes.error) {
        setError(
          pacienteRes.error?.message ??
            alertasRes.error?.message ??
            profesionalesRes.error?.message ??
            "No se pudieron cargar los datos de edición."
        );
        setLoading(false);
        return;
      }

      const p = (pacienteRes.data ?? null) as PacienteEditable | null;
      if (!p) {
        setError("Paciente no encontrado.");
        setLoading(false);
        return;
      }

      setForm({
        nombre: p.nombre ?? "",
        apellidos: p.apellidos ?? "",
        fechaNacimiento: toDateInput(p.fecha_nacimiento),
        dni: p.dni ?? "",
        direccion: p.direccion ?? "",
        telefono: p.telefono ?? "",
        email: p.email ?? "",
        canalPreferido: p.canal_preferido ?? "whatsapp",
        seguroMedico: p.seguro_medico ?? "",
        recordatorioWhatsapp: p.recordatorio_whatsapp ?? true,
        recordatorioEmail: p.recordatorio_email ?? false,
        motivoPrincipal: p.motivo_principal ?? "",
        profesionalReferencia: p.profesional_referencia ?? "",
        tipoPaciente: p.tipo ?? "nuevo",
        observacionesGenerales: p.observaciones_generales ?? "",
      });

      setAlertas((alertasRes.data ?? []) as AlertaClinica[]);
      setProfesionales((profesionalesRes.data ?? []) as Profesional[]);
      setLoading(false);
    }

    void loadData();
  }, [pacienteId]);

  const fullName = useMemo(
    () => `${form.nombre} ${form.apellidos}`.trim() || "Paciente",
    [form.nombre, form.apellidos]
  );

  async function handleAddAlerta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !pacienteId || !nuevaAlerta.descripcion.trim()) return;

    setSavingAlerta(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("alertas_clinicas")
      .insert({
        paciente_id: pacienteId,
        tipo: nuevaAlerta.tipo,
        descripcion: nuevaAlerta.descripcion.trim(),
      })
      .select("id, tipo, descripcion, creado_en")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "No se pudo añadir la alerta.");
      setSavingAlerta(false);
      return;
    }

    setAlertas((prev) => [data as AlertaClinica, ...prev]);
    setNuevaAlerta({ tipo: "alergia", descripcion: "" });
    setSavingAlerta(false);
  }

  async function handleDeleteAlerta(alertaId: string) {
    if (!supabase) return;
    setDeletingAlertId(alertaId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("alertas_clinicas")
      .delete()
      .eq("id", alertaId);

    if (deleteError) {
      setError(`No se pudo eliminar la alerta: ${deleteError.message}`);
      setDeletingAlertId(null);
      return;
    }

    setAlertas((prev) => prev.filter((a) => a.id !== alertaId));
    setDeletingAlertId(null);
  }

  async function handleGuardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !pacienteId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      nombre: form.nombre.trim(),
      apellidos: form.apellidos.trim(),
      fecha_nacimiento: form.fechaNacimiento || null,
      dni: form.dni.trim() || null,
      direccion: form.direccion.trim() || null,
      telefono: form.telefono.trim(),
      email: form.email.trim() || null,
      canal_preferido: form.canalPreferido,
      seguro_medico: form.seguroMedico.trim() || null,
      recordatorio_whatsapp: form.recordatorioWhatsapp,
      recordatorio_email: form.recordatorioEmail,
      motivo_principal: form.motivoPrincipal.trim() || null,
      profesional_referencia: form.profesionalReferencia || null,
      tipo: form.tipoPaciente,
      observaciones_generales: form.observacionesGenerales.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("pacientes")
      .update(payload)
      .eq("id", pacienteId);

    if (updateError) {
      setError(`No se pudo guardar: ${updateError.message}`);
      setSaving(false);
      return;
    }

    const message = `Cambios guardados correctamente a las ${nowHourText()}.`;
    setSuccess(message);
    setSaving(false);

    setTimeout(() => {
      router.push(`/dashboard/paciente/${pacienteId}`);
    }, 1400);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-700">
                {initials(form.nombre, form.apellidos)}
              </div>
              <div>
                <p className="text-sm text-slate-500">Editar ficha de paciente</p>
                <h1 className="text-2xl font-semibold">{fullName}</h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/paciente/${pacienteId}`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Cancelar
              </Link>
              <button
                form="editar-paciente-form"
                type="submit"
                disabled={saving || loading}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-700">
            {error}
          </section>
        )}
        {success && (
          <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-700">
            {success}
          </section>
        )}

        <form id="editar-paciente-form" onSubmit={handleGuardar} className="space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 text-lg font-semibold">1. Datos personales</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={form.nombre}
                onChange={(e) => setForm((v) => ({ ...v, nombre: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Nombre"
                required
              />
              <input
                value={form.apellidos}
                onChange={(e) => setForm((v) => ({ ...v, apellidos: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Apellidos"
                required
              />
              <input
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) =>
                  setForm((v) => ({ ...v, fechaNacimiento: e.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                value={form.dni}
                onChange={(e) => setForm((v) => ({ ...v, dni: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="DNI"
              />
              <input
                value={form.direccion}
                onChange={(e) => setForm((v) => ({ ...v, direccion: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
                placeholder="Dirección"
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 text-lg font-semibold">2. Contacto</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={form.telefono}
                onChange={(e) => setForm((v) => ({ ...v, telefono: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Teléfono"
                required
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Email"
              />
              <select
                value={form.canalPreferido}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    canalPreferido: e.target.value as "whatsapp" | "telefono" | "email",
                  }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="telefono">Teléfono</option>
                <option value="email">Email</option>
              </select>
              <input
                value={form.seguroMedico}
                onChange={(e) => setForm((v) => ({ ...v, seguroMedico: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Seguro médico"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2 md:flex-row md:gap-6">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.recordatorioWhatsapp}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      recordatorioWhatsapp: e.target.checked,
                    }))
                  }
                />
                Activar recordatorios por WhatsApp
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.recordatorioEmail}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, recordatorioEmail: e.target.checked }))
                  }
                />
                Activar recordatorios por email
              </label>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 text-lg font-semibold">3. Alertas clínicas</h2>

            <div className="mb-4 space-y-2">
              {alertas.length === 0 && (
                <p className="text-sm text-slate-500">No hay alertas clínicas registradas.</p>
              )}
              {alertas.map((alerta) => (
                <article
                  key={alerta.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <p className="font-medium">{alerta.tipo}</p>
                    <p className="text-sm text-slate-700">{alerta.descripcion}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAlerta(alerta.id)}
                    disabled={deletingAlertId === alerta.id}
                    className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {deletingAlertId === alerta.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </article>
              ))}
            </div>

            <form onSubmit={handleAddAlerta} className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 font-medium">Añadir nueva alerta</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr_auto]">
                <select
                  value={nuevaAlerta.tipo}
                  onChange={(e) =>
                    setNuevaAlerta((v) => ({
                      ...v,
                      tipo: e.target.value as
                        | "alergia"
                        | "medicación"
                        | "intolerancia"
                        | "observación",
                    }))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="alergia">Alergia</option>
                  <option value="medicación">Medicación</option>
                  <option value="intolerancia">Intolerancia</option>
                  <option value="observación">Observación</option>
                </select>
                <input
                  value={nuevaAlerta.descripcion}
                  onChange={(e) =>
                    setNuevaAlerta((v) => ({ ...v, descripcion: e.target.value }))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Descripción de la alerta"
                  required
                />
                <button
                  type="submit"
                  disabled={savingAlerta}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingAlerta ? "Añadiendo..." : "Añadir"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 text-lg font-semibold">4. Datos clínicos</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={form.motivoPrincipal}
                onChange={(e) =>
                  setForm((v) => ({ ...v, motivoPrincipal: e.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
                placeholder="Motivo principal"
              />
              <select
                value={form.profesionalReferencia}
                onChange={(e) =>
                  setForm((v) => ({ ...v, profesionalReferencia: e.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Profesional de referencia</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <select
                value={form.tipoPaciente}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    tipoPaciente: e.target.value as "nuevo" | "recurrente",
                  }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="nuevo">Nuevo</option>
                <option value="recurrente">Recurrente</option>
              </select>
              <textarea
                value={form.observacionesGenerales}
                onChange={(e) =>
                  setForm((v) => ({ ...v, observacionesGenerales: e.target.value }))
                }
                className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
                placeholder="Observaciones generales"
              />
            </div>
          </section>
        </form>

        {loading && <p className="text-sm text-slate-500">Cargando datos del paciente...</p>}
      </div>
    </main>
  );
}
