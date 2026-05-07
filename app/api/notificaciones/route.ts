import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

type TipoRecordatorio = "24h" | "2h";

type CitaDetalle = {
  id: string;
  fecha_hora: string;
  estado: string;
  notas: string | null;
  pacientes: {
    nombre: string;
    apellidos: string;
    telefono: string;
  } | null;
  servicios: { nombre: string } | null;
  profesionales: { nombre: string } | null;
};

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan credenciales de Supabase en variables de entorno.");
  return createClient(url, key);
}

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken || !from) {
    throw new Error("Faltan variables de Twilio (SID, TOKEN o WHATSAPP_FROM).");
  }
  return {
    client: twilio(accountSid, authToken),
    from,
  };
}

function normalizeWhatsappPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `whatsapp:${digits}`;
  if (digits.startsWith("34")) return `whatsapp:+${digits}`;
  return `whatsapp:+34${digits}`;
}

async function getCitaDetalle(citaId: string): Promise<CitaDetalle> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("citas")
    .select(
      "id, fecha_hora, estado, notas, pacientes(nombre, apellidos, telefono), servicios(nombre), profesionales(nombre)"
    )
    .eq("id", citaId)
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se encontró la cita.");
  return data as CitaDetalle;
}

function resumenCita(cita: CitaDetalle): string {
  const fecha = new Date(cita.fecha_hora);
  return [
    `Paciente: ${cita.pacientes?.nombre ?? ""} ${cita.pacientes?.apellidos ?? ""}`.trim(),
    `Servicio: ${cita.servicios?.nombre ?? "Sin servicio"}`,
    `Fecha: ${fecha.toLocaleDateString("es-ES")}`,
    `Hora: ${fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`,
    `Profesional: ${cita.profesionales?.nombre ?? "Sin asignar"}`,
  ].join("\n");
}

async function sendWhatsappMessage(to: string, body: string) {
  const { client, from } = getTwilioClient();
  return client.messages.create({
    from,
    to,
    body,
  });
}

async function markReminderSent(cita: CitaDetalle, tipo: TipoRecordatorio) {
  const supabase = getServerSupabase();
  const marker = tipo === "24h" ? "[WA_REMINDER_24H_SENT]" : "[WA_REMINDER_2H_SENT]";
  const currentNotes = cita.notas ?? "";
  if (currentNotes.includes(marker)) return;
  const nextNotes = `${currentNotes}\n${marker}`.trim();
  await supabase.from("citas").update({ notas: nextNotes }).eq("id", cita.id);
}

export async function enviarConfirmacion(citaId: string) {
  const cita = await getCitaDetalle(citaId);
  const telefono = cita.pacientes?.telefono;
  if (!telefono) throw new Error("La cita no tiene teléfono de paciente.");

  const body = `Hola ${cita.pacientes?.nombre ?? ""}, tu cita en CallosaSalud está confirmada.\n\n${resumenCita(
    cita
  )}\n\nSi necesitas cambios, responde a este mensaje.`;

  await sendWhatsappMessage(normalizeWhatsappPhone(telefono), body);
  return { ok: true };
}

export async function enviarRecordatorio(citaId: string, tipo: TipoRecordatorio) {
  const cita = await getCitaDetalle(citaId);
  const telefono = cita.pacientes?.telefono;
  if (!telefono) throw new Error("La cita no tiene teléfono de paciente.");

  const body = `Recordatorio ${tipo} · CallosaSalud\n\n${resumenCita(
    cita
  )}\n\nTe esperamos. Si no puedes asistir, avísanos con antelación.`;

  await sendWhatsappMessage(normalizeWhatsappPhone(telefono), body);
  await markReminderSent(cita, tipo);
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as {
      action?: "confirmacion" | "recordatorio";
      citaId?: string;
      tipo?: TipoRecordatorio;
    };

    if (!payload.action || !payload.citaId) {
      return NextResponse.json(
        { ok: false, error: "Faltan action o citaId." },
        { status: 400 }
      );
    }

    if (payload.action === "confirmacion") {
      const result = await enviarConfirmacion(payload.citaId);
      return NextResponse.json(result);
    }

    if (payload.action === "recordatorio") {
      if (!payload.tipo) {
        return NextResponse.json(
          { ok: false, error: "Falta tipo para recordatorio." },
          { status: 400 }
        );
      }
      const result = await enviarRecordatorio(payload.citaId, payload.tipo);
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: false, error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
