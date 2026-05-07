import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enviarRecordatorio } from "../notificaciones/route";

type CitaCron = {
  id: string;
  fecha_hora: string;
  estado: "confirmada" | "pendiente" | "completada" | "cancelada" | "no_show";
  notas: string | null;
};

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan credenciales de Supabase.");
  return createClient(url, key);
}

function shouldSendByType(diffMs: number, type: "24h" | "2h"): boolean {
  const target = type === "24h" ? 24 * 60 : 2 * 60;
  const diffMin = Math.round(diffMs / 60000);
  return diffMin >= target - 10 && diffMin <= target + 10;
}

function alreadySent(notas: string | null, type: "24h" | "2h"): boolean {
  const marker = type === "24h" ? "[WA_REMINDER_24H_SENT]" : "[WA_REMINDER_2H_SENT]";
  return (notas ?? "").includes(marker);
}

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const now = new Date();
    const in25h = new Date(now.getTime() + 25 * 60 * 60000);

    const { data, error } = await supabase
      .from("citas")
      .select("id, fecha_hora, estado, notas")
      .in("estado", ["confirmada", "pendiente"])
      .gte("fecha_hora", now.toISOString())
      .lte("fecha_hora", in25h.toISOString());

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const citas = (data ?? []) as CitaCron[];
    let enviados24h = 0;
    let enviados2h = 0;
    const errores: string[] = [];

    for (const cita of citas) {
      const diff = new Date(cita.fecha_hora).getTime() - now.getTime();

      if (shouldSendByType(diff, "24h") && !alreadySent(cita.notas, "24h")) {
        try {
          await enviarRecordatorio(cita.id, "24h");
          enviados24h += 1;
        } catch (e) {
          errores.push(
            `24h cita ${cita.id}: ${e instanceof Error ? e.message : "error desconocido"}`
          );
        }
      }

      if (shouldSendByType(diff, "2h") && !alreadySent(cita.notas, "2h")) {
        try {
          await enviarRecordatorio(cita.id, "2h");
          enviados2h += 1;
        } catch (e) {
          errores.push(
            `2h cita ${cita.id}: ${e instanceof Error ? e.message : "error desconocido"}`
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      revisadas: citas.length,
      enviados24h,
      enviados2h,
      errores,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
