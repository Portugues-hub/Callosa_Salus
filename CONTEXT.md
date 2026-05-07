# CallosaSalud — Sistema de gestión de agenda

## Stack
Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL)

## Servicios de la clínica
Fisioterapia, Medicina estética, Podología, Implantación capilar, Psicotécnicos

## Profesionales
- Dra. Sánchez — Fisioterapia
- Dr. Vega — Medicina estética
- Dr. Martín — Podología

## Pantallas a construir
1. /dashboard — Panel del recepcionista (citas hoy, alertas, estadísticas)
2. /dashboard/agenda — Vista semanal con creación manual de citas pinchando en huecos
3. /dashboard/paciente/[id] — Ficha completa del paciente con historial y notas
4. /widget — Widget embebible para pegar en callosasalud.com

## Automatizaciones
- WhatsApp via Twilio al confirmar cita
- Recordatorio automático 24h y 2h antes via WhatsApp
- Sincronización con Google Calendar
- Lista de espera automática si hay cancelación

## Base de datos (Supabase)
Tablas necesarias:
- pacientes
- profesionales
- servicios
- citas
- alertas_clinicas
- notas