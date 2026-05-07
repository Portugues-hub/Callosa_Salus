"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type EstadoCita =
  | "confirmada"
  | "pendiente"
  | "completada"
  | "cancelada"
  | "no_show";

type CitaStats = {
  id: string;
  paciente_id: string;
  estado: EstadoCita;
  fecha_hora: string;
  profesional_id: string | null;
  pacientes: { tipo: "nuevo" | "recurrente" } | null;
  servicios: { nombre: string } | null;
  profesionales: { nombre: string; especialidad: string } | null;
};

type Profesional = {
  id: string;
  nombre: string;
  especialidad: string;
};

type RowRendimiento = {
  id: string;
  nombre: string;
  especialidad: string;
  total: number;
  confirmacion: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = supabaseReady
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

const pieColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];

function monthRange(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year, mon - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, mon, 0, 23, 59, 59, 999);
  return { start, end };
}

function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions(back = 11): string[] {
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i <= back; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return options;
}

export default function EstadisticasPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [citas, setCitas] = useState<CitaStats[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!supabase) {
        setError(
          "Faltan variables de Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY)."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { start, end } = monthRange(selectedMonth);

      const [citasRes, profRes] = await Promise.all([
        supabase
          .from("citas")
          .select(
            `
            id,
            paciente_id,
            estado,
            fecha_hora,
            profesional_id,
            pacientes(tipo),
            servicios(nombre),
            profesionales(nombre, especialidad)
          `
          )
          .gte("fecha_hora", start.toISOString())
          .lte("fecha_hora", end.toISOString()),
        supabase.from("profesionales").select("id, nombre, especialidad"),
      ]);

      if (citasRes.error || profRes.error) {
        setError(
          citasRes.error?.message ??
            profRes.error?.message ??
            "No se pudieron cargar las estadísticas."
        );
        setLoading(false);
        return;
      }

      setCitas((citasRes.data ?? []) as CitaStats[]);
      setProfesionales((profRes.data ?? []) as Profesional[]);
      setLoading(false);
    }

    void loadData();
  }, [selectedMonth]);

  const general = useMemo(() => {
    const total = citas.length;
    const canceladas = citas.filter((c) => c.estado === "cancelada").length;
    const noShows = citas.filter((c) => c.estado === "no_show").length;
    const cancelacionPct = total ? Math.round((canceladas / total) * 100) : 0;
    const noShowPct = total ? Math.round((noShows / total) * 100) : 0;

    const pacientesTipo = new Map<string, "nuevo" | "recurrente">();
    for (const cita of citas) {
      if (!cita.pacientes?.tipo) continue;
      pacientesTipo.set(cita.paciente_id, cita.pacientes.tipo);
    }
    const nuevos = [...pacientesTipo.values()].filter((v) => v === "nuevo").length;
    const recurrentes = [...pacientesTipo.values()].filter(
      (v) => v === "recurrente"
    ).length;

    return {
      total,
      cancelacionPct,
      noShowPct,
      nuevos,
      recurrentes,
    };
  }, [citas]);

  const citasPorSemana = useMemo(() => {
    const weeks = [0, 0, 0, 0, 0, 0];
    for (const cita of citas) {
      const day = new Date(cita.fecha_hora).getDate();
      const index = Math.min(5, Math.floor((day - 1) / 7));
      weeks[index] += 1;
    }
    return weeks
      .map((count, i) => ({ semana: `S${i + 1}`, citas: count }))
      .filter((w) => w.citas > 0 || w.semana !== "S6");
  }, [citas]);

  const serviciosDonut = useMemo(() => {
    const map = new Map<string, number>();
    for (const cita of citas) {
      const name = cita.servicios?.nombre ?? "Sin servicio";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [citas]);

  const horasPunta = useMemo(() => {
    const map = new Map<number, number>();
    for (const cita of citas) {
      const hour = new Date(cita.fecha_hora).getHours();
      map.set(hour, (map.get(hour) ?? 0) + 1);
    }
    const result: { franja: string; citas: number }[] = [];
    for (let h = 9; h <= 19; h += 1) {
      result.push({
        franja: `${String(h).padStart(2, "0")}:00`,
        citas: map.get(h) ?? 0,
      });
    }
    return result;
  }, [citas]);

  const rendimientoProfesional = useMemo<RowRendimiento[]>(() => {
    const acc = new Map<string, { total: number; confirmadas: number }>();
    for (const cita of citas) {
      if (!cita.profesional_id) continue;
      const current = acc.get(cita.profesional_id) ?? { total: 0, confirmadas: 0 };
      current.total += 1;
      if (cita.estado === "confirmada" || cita.estado === "completada") {
        current.confirmadas += 1;
      }
      acc.set(cita.profesional_id, current);
    }

    return profesionales
      .map((p) => {
        const r = acc.get(p.id) ?? { total: 0, confirmadas: 0 };
        const confirmacion = r.total ? Math.round((r.confirmadas / r.total) * 100) : 0;
        return {
          id: p.id,
          nombre: p.nombre,
          especialidad: p.especialidad,
          total: r.total,
          confirmacion,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [citas, profesionales]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Estadísticas</h1>
              <p className="text-sm text-slate-600">
                Indicadores operativos de CallosaSalud por mes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
              >
                Volver al dashboard
              </Link>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {monthOptions().map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {error && (
          <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-700">
            {error}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Total citas del mes</p>
            <p className="mt-2 text-3xl font-semibold">{general.total}</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Tasa de cancelación</p>
            <p className="mt-2 text-3xl font-semibold">{general.cancelacionPct}%</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Tasa de no-shows</p>
            <p className="mt-2 text-3xl font-semibold">{general.noShowPct}%</p>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Clientes nuevos vs recurrentes</p>
            <p className="mt-2 text-xl font-semibold">
              {general.nuevos} / {general.recurrentes}
            </p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold">Citas por semana</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={citasPorSemana}>
                  <XAxis dataKey="semana" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="citas" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold">Servicios más solicitados</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviciosDonut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {serviciosDonut.map((_, index) => (
                      <Cell key={index} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
              {serviciosDonut.map((s, i) => (
                <span key={s.name} className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: pieColors[i % pieColors.length] }}
                  />
                  {s.name} ({s.value})
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold">Horas punta de reserva</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={horasPunta}>
                <XAxis dataKey="franja" interval={1} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="citas" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold">Rendimiento por profesional</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Especialidad</th>
                  <th className="px-3 py-2 font-medium">Total citas</th>
                  <th className="px-3 py-2 font-medium">% confirmación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rendimientoProfesional.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium">{row.nombre}</td>
                    <td className="px-3 py-3">{row.especialidad}</td>
                    <td className="px-3 py-3">{row.total}</td>
                    <td className="px-3 py-3">{row.confirmacion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {loading && <p className="text-sm text-slate-500">Cargando estadísticas...</p>}
      </div>
    </main>
  );
}
