-- CallosaSalud - Supabase schema + seed data
-- PostgreSQL (Supabase)

begin;

create extension if not exists pgcrypto;

-- =========================
-- Core tables
-- =========================

create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellidos text not null,
  telefono text not null,
  email text unique,
  fecha_nacimiento date,
  direccion text,
  seguro_medico text,
  canal_preferido text not null check (canal_preferido in ('whatsapp', 'telefono', 'email')),
  tipo text not null check (tipo in ('nuevo', 'recurrente')),
  creado_en timestamptz not null default now()
);

create table if not exists profesionales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  especialidad text not null,
  email text not null unique,
  activo boolean not null default true
);

create table if not exists servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  duracion_min integer not null check (duracion_min > 0),
  profesional_id uuid not null references profesionales(id) on update cascade on delete restrict,
  activo boolean not null default true
);

create table if not exists citas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on update cascade on delete cascade,
  servicio_id uuid not null references servicios(id) on update cascade on delete restrict,
  profesional_id uuid not null references profesionales(id) on update cascade on delete restrict,
  fecha_hora timestamptz not null,
  duracion_min integer not null check (duracion_min > 0),
  estado text not null check (estado in ('confirmada', 'pendiente', 'completada', 'cancelada', 'no_show')),
  canal text not null check (canal in ('web', 'presencial', 'telefono')),
  notas text,
  creado_en timestamptz not null default now()
);

create table if not exists alertas_clinicas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on update cascade on delete cascade,
  tipo text not null,
  descripcion text not null,
  creado_en timestamptz not null default now()
);

create table if not exists notas_paciente (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on update cascade on delete cascade,
  autor text not null,
  contenido text not null,
  creado_en timestamptz not null default now()
);

-- =========================
-- Helpful indexes
-- =========================

create index if not exists idx_citas_fecha_hora on citas(fecha_hora);
create index if not exists idx_citas_paciente_id on citas(paciente_id);
create index if not exists idx_citas_profesional_id on citas(profesional_id);
create index if not exists idx_alertas_paciente_id on alertas_clinicas(paciente_id);
create index if not exists idx_notas_paciente_id on notas_paciente(paciente_id);

-- =========================
-- Seed data
-- =========================

-- Profesionales (3)
insert into profesionales (id, nombre, especialidad, email, activo) values
('11111111-1111-1111-1111-111111111101', 'Dra. Sánchez', 'Fisioterapia', 'sanchez@callosasalud.com', true),
('11111111-1111-1111-1111-111111111102', 'Dr. Vega', 'Medicina estética', 'vega@callosasalud.com', true),
('11111111-1111-1111-1111-111111111103', 'Dr. Martín', 'Podología', 'martin@callosasalud.com', true)
on conflict (id) do nothing;

-- Servicios (5)
insert into servicios (id, nombre, duracion_min, profesional_id, activo) values
('22222222-2222-2222-2222-222222222201', 'Sesión de fisioterapia general', 45, '11111111-1111-1111-1111-111111111101', true),
('22222222-2222-2222-2222-222222222202', 'Rehabilitación deportiva', 60, '11111111-1111-1111-1111-111111111101', true),
('22222222-2222-2222-2222-222222222203', 'Valoración medicina estética', 30, '11111111-1111-1111-1111-111111111102', true),
('22222222-2222-2222-2222-222222222204', 'Tratamiento facial hidratante', 60, '11111111-1111-1111-1111-111111111102', true),
('22222222-2222-2222-2222-222222222205', 'Estudio biomecánico de la pisada', 45, '11111111-1111-1111-1111-111111111103', true)
on conflict (id) do nothing;

-- Pacientes (10)
insert into pacientes (
  id, nombre, apellidos, telefono, email, fecha_nacimiento, direccion, seguro_medico, canal_preferido, tipo, creado_en
) values
('33333333-3333-3333-3333-333333333301', 'Lucía', 'Pérez García', '+34 612 345 001', 'lucia.perez@gmail.com', '1992-03-14', 'C/ Mayor 12, Callosa de Segura', 'Sanitas', 'whatsapp', 'recurrente', now() - interval '120 days'),
('33333333-3333-3333-3333-333333333302', 'José', 'Martínez López', '+34 612 345 002', 'jose.martinez@hotmail.com', '1985-11-02', 'Av. Constitución 8, Callosa de Segura', 'Adeslas', 'telefono', 'recurrente', now() - interval '90 days'),
('33333333-3333-3333-3333-333333333303', 'María', 'Soler Ruiz', '+34 612 345 003', 'maria.soler@gmail.com', '1978-07-22', 'C/ Cervantes 5, Cox', 'DKV', 'email', 'nuevo', now() - interval '20 days'),
('33333333-3333-3333-3333-333333333304', 'Antonio', 'Navarro Vidal', '+34 612 345 004', 'antonio.navarro@yahoo.es', '1969-01-30', 'C/ Ramón y Cajal 21, Redován', null, 'telefono', 'recurrente', now() - interval '200 days'),
('33333333-3333-3333-3333-333333333305', 'Carmen', 'Ortuño Sánchez', '+34 612 345 005', 'carmen.ortuno@gmail.com', '1999-09-08', 'C/ Salitre 3, Callosa de Segura', 'Asisa', 'whatsapp', 'nuevo', now() - interval '10 days'),
('33333333-3333-3333-3333-333333333306', 'Raúl', 'Gómez Torres', '+34 612 345 006', 'raul.gomez@gmail.com', '1990-12-18', 'C/ Miguel Hernández 14, Albatera', null, 'whatsapp', 'recurrente', now() - interval '75 days'),
('33333333-3333-3333-3333-333333333307', 'Elena', 'Molina Ferrer', '+34 612 345 007', 'elena.molina@outlook.com', '1988-05-04', 'C/ San Roque 6, Callosa de Segura', 'Mapfre Salud', 'email', 'recurrente', now() - interval '140 days'),
('33333333-3333-3333-3333-333333333308', 'David', 'Bernabé Cano', '+34 612 345 008', 'david.bernabe@gmail.com', '1995-10-27', 'C/ Levante 2, Orihuela', null, 'telefono', 'nuevo', now() - interval '15 days'),
('33333333-3333-3333-3333-333333333309', 'Ana', 'Pastor Quesada', '+34 612 345 009', 'ana.pastor@gmail.com', '1982-02-11', 'C/ Alicante 33, Callosa de Segura', 'Sanitas', 'whatsapp', 'recurrente', now() - interval '160 days'),
('33333333-3333-3333-3333-333333333310', 'Sergio', 'Rico Alcaraz', '+34 612 345 010', 'sergio.rico@gmail.com', '2001-06-19', 'C/ Huerta 19, Granja de Rocamora', null, 'whatsapp', 'nuevo', now() - interval '5 days')
on conflict (id) do nothing;

-- Citas (20)
insert into citas (
  id, paciente_id, servicio_id, profesional_id, fecha_hora, duracion_min, estado, canal, notas, creado_en
) values
('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', now() - interval '14 days' + interval '09:00', 45, 'completada', 'presencial', 'Mejora de cervicalgia tras tercera sesión.', now() - interval '20 days'),
('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', now() - interval '13 days' + interval '10:30', 60, 'completada', 'presencial', 'Rehabilitación post esguince tobillo derecho.', now() - interval '18 days'),
('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', now() - interval '12 days' + interval '11:00', 30, 'completada', 'web', 'Primera valoración de piel sensible.', now() - interval '16 days'),
('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', now() - interval '12 days' + interval '12:00', 45, 'completada', 'telefono', 'Dolor plantar en pie izquierdo.', now() - interval '17 days'),
('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', now() - interval '10 days' + interval '17:00', 30, 'cancelada', 'web', 'Cancelada por viaje de trabajo.', now() - interval '13 days'),
('44444444-4444-4444-4444-444444444406', '33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', now() - interval '9 days' + interval '09:45', 45, 'completada', 'presencial', 'Lumbalgia crónica en seguimiento.', now() - interval '12 days'),
('44444444-4444-4444-4444-444444444407', '33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', now() - interval '8 days' + interval '18:30', 60, 'completada', 'web', 'Buena tolerancia al tratamiento.', now() - interval '11 days'),
('44444444-4444-4444-4444-444444444408', '33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', now() - interval '8 days' + interval '16:00', 45, 'no_show', 'telefono', 'No acude. Se intenta contacto telefónico.', now() - interval '10 days'),
('44444444-4444-4444-4444-444444444409', '33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', now() - interval '7 days' + interval '11:30', 45, 'completada', 'presencial', 'Descarga muscular de trapecio.', now() - interval '9 days'),
('44444444-4444-4444-4444-444444444410', '33333333-3333-3333-3333-333333333310', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', now() - interval '6 days' + interval '19:00', 60, 'completada', 'web', 'Primera sesión por sobrecarga deportiva.', now() - interval '8 days'),
('44444444-4444-4444-4444-444444444411', '33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', now() - interval '5 days' + interval '09:00', 45, 'completada', 'presencial', 'Se pauta ejercicio domiciliario.', now() - interval '7 days'),
('44444444-4444-4444-4444-444444444412', '33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', now() - interval '4 days' + interval '10:00', 45, 'completada', 'presencial', 'Ajuste de plantillas recomendado.', now() - interval '6 days'),
('44444444-4444-4444-4444-444444444413', '33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', now() - interval '3 days' + interval '12:30', 60, 'completada', 'web', 'Control post tratamiento estético.', now() - interval '5 days'),
('44444444-4444-4444-4444-444444444414', '33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', now() - interval '2 days' + interval '09:30', 45, 'completada', 'presencial', 'Mejoría del dolor metatarsal.', now() - interval '4 days'),
('44444444-4444-4444-4444-444444444415', '33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', now() - interval '1 days' + interval '18:00', 30, 'confirmada', 'web', 'Valoración para tratamiento antiacné.', now() - interval '3 days'),
('44444444-4444-4444-4444-444444444416', '33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', now() + interval '1 days' + interval '08:30', 60, 'confirmada', 'presencial', 'Seguimiento de rehabilitación lumbar.', now() - interval '2 days'),
('44444444-4444-4444-4444-444444444417', '33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', now() + interval '1 days' + interval '11:00', 60, 'pendiente', 'telefono', 'Pendiente confirmar disponibilidad.', now() - interval '2 days'),
('44444444-4444-4444-4444-444444444418', '33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', now() + interval '2 days' + interval '10:30', 45, 'confirmada', 'web', 'Primera consulta de podología.', now() - interval '1 days'),
('44444444-4444-4444-4444-444444444419', '33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', now() + interval '3 days' + interval '17:30', 45, 'pendiente', 'presencial', 'Paciente solicita última hora de tarde.', now() - interval '1 days'),
('44444444-4444-4444-4444-444444444420', '33333333-3333-3333-3333-333333333310', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', now() + interval '4 days' + interval '19:00', 30, 'confirmada', 'web', 'Consulta de medicina estética inicial.', now())
on conflict (id) do nothing;

-- Alertas clínicas (extra de ejemplo)
insert into alertas_clinicas (id, paciente_id, tipo, descripcion, creado_en) values
('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333302', 'alergia', 'Alergia declarada a ibuprofeno.', now() - interval '80 days'),
('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333304', 'riesgo', 'Diabetes tipo 2; revisar integridad cutánea en cada visita.', now() - interval '150 days'),
('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333308', 'adherencia', 'Antecedente de inasistencias; confirmar por WhatsApp el día previo.', now() - interval '7 days')
on conflict (id) do nothing;

-- Notas de paciente (extra de ejemplo)
insert into notas_paciente (id, paciente_id, autor, contenido, creado_en) values
('66666666-6666-6666-6666-666666666601', '33333333-3333-3333-3333-333333333301', 'Dra. Sánchez', 'Responder bien a terapia manual cervical y ejercicios de movilidad.', now() - interval '5 days'),
('66666666-6666-6666-6666-666666666602', '33333333-3333-3333-3333-333333333303', 'Dr. Vega', 'Piel reactiva; evitar productos con retinol durante 72h.', now() - interval '3 days'),
('66666666-6666-6666-6666-666666666603', '33333333-3333-3333-3333-333333333304', 'Dr. Martín', 'Recomendado calzado amplio y revisión en 4 semanas.', now() - interval '2 days')
on conflict (id) do nothing;

commit;
