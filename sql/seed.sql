-- CallosaSalud - Seed data
-- Requiere que las tablas del schema ya existan.

begin;

-- 1) Profesionales (3)
insert into profesionales (id, nombre, especialidad, email, activo) values
('11111111-1111-1111-1111-111111111101', 'Dra. Sánchez', 'Fisioterapia', 'sanchez@callosasalud.com', true),
('11111111-1111-1111-1111-111111111102', 'Dr. Vega', 'Medicina estética', 'vega@callosasalud.com', true),
('11111111-1111-1111-1111-111111111103', 'Dr. Martín', 'Podología', 'martin@callosasalud.com', true)
on conflict (id) do nothing;

-- 2) Servicios (5)
insert into servicios (id, nombre, duracion_min, profesional_id, activo) values
('22222222-2222-2222-2222-222222222201', 'Sesión de fisioterapia general', 45, '11111111-1111-1111-1111-111111111101', true),
('22222222-2222-2222-2222-222222222202', 'Rehabilitación deportiva', 60, '11111111-1111-1111-1111-111111111101', true),
('22222222-2222-2222-2222-222222222203', 'Valoración medicina estética', 30, '11111111-1111-1111-1111-111111111102', true),
('22222222-2222-2222-2222-222222222204', 'Tratamiento facial hidratante', 60, '11111111-1111-1111-1111-111111111102', true),
('22222222-2222-2222-2222-222222222205', 'Estudio biomecánico de la pisada', 45, '11111111-1111-1111-1111-111111111103', true)
on conflict (id) do nothing;

-- 3) Pacientes (10)
insert into pacientes (
  id, nombre, apellidos, telefono, email, fecha_nacimiento, direccion, seguro_medico, canal_preferido, tipo, creado_en
) values
('33333333-3333-3333-3333-333333333301', 'Lucía', 'Pérez García', '+34 612 345 001', 'lucia.perez@gmail.com', '1992-03-14', 'C/ Mayor 12, Callosa de Segura', 'Sanitas', 'whatsapp', 'recurrente', now() - interval '140 days'),
('33333333-3333-3333-3333-333333333302', 'José', 'Martínez López', '+34 612 345 002', 'jose.martinez@hotmail.com', '1985-11-02', 'Av. Constitución 8, Callosa de Segura', 'Adeslas', 'telefono', 'recurrente', now() - interval '100 days'),
('33333333-3333-3333-3333-333333333303', 'María', 'Soler Ruiz', '+34 612 345 003', 'maria.soler@gmail.com', '1978-07-22', 'C/ Cervantes 5, Cox', 'DKV', 'email', 'nuevo', now() - interval '25 days'),
('33333333-3333-3333-3333-333333333304', 'Antonio', 'Navarro Vidal', '+34 612 345 004', 'antonio.navarro@yahoo.es', '1969-01-30', 'C/ Ramón y Cajal 21, Redován', null, 'telefono', 'recurrente', now() - interval '220 days'),
('33333333-3333-3333-3333-333333333305', 'Carmen', 'Ortuño Sánchez', '+34 612 345 005', 'carmen.ortuno@gmail.com', '1999-09-08', 'C/ Salitre 3, Callosa de Segura', 'Asisa', 'whatsapp', 'nuevo', now() - interval '15 days'),
('33333333-3333-3333-3333-333333333306', 'Raúl', 'Gómez Torres', '+34 612 345 006', 'raul.gomez@gmail.com', '1990-12-18', 'C/ Miguel Hernández 14, Albatera', null, 'whatsapp', 'recurrente', now() - interval '80 days'),
('33333333-3333-3333-3333-333333333307', 'Elena', 'Molina Ferrer', '+34 612 345 007', 'elena.molina@outlook.com', '1988-05-04', 'C/ San Roque 6, Callosa de Segura', 'Mapfre Salud', 'email', 'recurrente', now() - interval '160 days'),
('33333333-3333-3333-3333-333333333308', 'David', 'Bernabé Cano', '+34 612 345 008', 'david.bernabe@gmail.com', '1995-10-27', 'C/ Levante 2, Orihuela', null, 'telefono', 'nuevo', now() - interval '18 days'),
('33333333-3333-3333-3333-333333333309', 'Ana', 'Pastor Quesada', '+34 612 345 009', 'ana.pastor@gmail.com', '1982-02-11', 'C/ Alicante 33, Callosa de Segura', 'Sanitas', 'whatsapp', 'recurrente', now() - interval '175 days'),
('33333333-3333-3333-3333-333333333310', 'Sergio', 'Rico Alcaraz', '+34 612 345 010', 'sergio.rico@gmail.com', '2001-06-19', 'C/ Huerta 19, Granja de Rocamora', null, 'whatsapp', 'nuevo', now() - interval '8 days')
on conflict (id) do nothing;

-- 4) Citas (20) distribuidas esta semana
insert into citas (
  id, paciente_id, servicio_id, profesional_id, fecha_hora, duracion_min, estado, canal, notas, creado_en
) values
('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', date_trunc('week', now()) + interval '1 day 09:00', 45, 'confirmada', 'presencial', 'Dolor cervical en seguimiento.', now() - interval '4 days'),
('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', date_trunc('week', now()) + interval '1 day 10:30', 60, 'pendiente', 'telefono', 'Pendiente confirmar asistencia.', now() - interval '3 days'),
('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', date_trunc('week', now()) + interval '1 day 12:00', 30, 'confirmada', 'web', 'Primera valoración.', now() - interval '3 days'),
('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', date_trunc('week', now()) + interval '1 day 16:00', 45, 'completada', 'presencial', 'Control de dolor plantar.', now() - interval '5 days'),
('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', date_trunc('week', now()) + interval '2 day 09:30', 30, 'cancelada', 'web', 'Cancelada por indisposición.', now() - interval '2 days'),
('44444444-4444-4444-4444-444444444406', '33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', date_trunc('week', now()) + interval '2 day 11:00', 45, 'confirmada', 'presencial', 'Seguimiento lumbalgia.', now() - interval '2 days'),
('44444444-4444-4444-4444-444444444407', '33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', date_trunc('week', now()) + interval '2 day 17:30', 60, 'pendiente', 'telefono', 'A la espera de autorización de seguro.', now() - interval '2 days'),
('44444444-4444-4444-4444-444444444408', '33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', date_trunc('week', now()) + interval '3 day 09:00', 45, 'no_show', 'telefono', 'No acude a la cita.', now() - interval '1 day'),
('44444444-4444-4444-4444-444444444409', '33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', date_trunc('week', now()) + interval '3 day 10:00', 45, 'confirmada', 'presencial', 'Molestia de hombro derecho.', now() - interval '1 day'),
('44444444-4444-4444-4444-444444444410', '33333333-3333-3333-3333-333333333310', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', date_trunc('week', now()) + interval '3 day 12:00', 60, 'pendiente', 'web', 'Primera visita deportiva.', now() - interval '1 day'),
('44444444-4444-4444-4444-444444444411', '33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', date_trunc('week', now()) + interval '3 day 18:00', 45, 'completada', 'presencial', 'Buena evolución.', now() - interval '8 hours'),
('44444444-4444-4444-4444-444444444412', '33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', date_trunc('week', now()) + interval '4 day 09:30', 45, 'confirmada', 'presencial', 'Revisión pisada y apoyo.', now() - interval '8 hours'),
('44444444-4444-4444-4444-444444444413', '33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', date_trunc('week', now()) + interval '4 day 11:00', 60, 'confirmada', 'web', 'Tratamiento hidratación facial.', now() - interval '6 hours'),
('44444444-4444-4444-4444-444444444414', '33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', date_trunc('week', now()) + interval '4 day 16:30', 45, 'pendiente', 'telefono', 'Pendiente recolocación por horario.', now() - interval '6 hours'),
('44444444-4444-4444-4444-444444444415', '33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', date_trunc('week', now()) + interval '5 day 09:00', 30, 'confirmada', 'web', 'Consulta de seguimiento estético.', now() - interval '5 hours'),
('44444444-4444-4444-4444-444444444416', '33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', date_trunc('week', now()) + interval '5 day 10:00', 60, 'confirmada', 'presencial', 'Trabajo de core y movilidad.', now() - interval '5 hours'),
('44444444-4444-4444-4444-444444444417', '33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', date_trunc('week', now()) + interval '5 day 12:00', 60, 'cancelada', 'telefono', 'Paciente reprograma por trabajo.', now() - interval '4 hours'),
('44444444-4444-4444-4444-444444444418', '33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111103', date_trunc('week', now()) + interval '5 day 17:00', 45, 'confirmada', 'presencial', 'Evaluación inicial podológica.', now() - interval '4 hours'),
('44444444-4444-4444-4444-444444444419', '33333333-3333-3333-3333-333333333309', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', date_trunc('week', now()) + interval '6 day 10:30', 45, 'pendiente', 'web', 'Pendiente confirmación final.', now() - interval '3 hours'),
('44444444-4444-4444-4444-444444444420', '33333333-3333-3333-3333-333333333310', '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', date_trunc('week', now()) + interval '6 day 12:30', 30, 'confirmada', 'web', 'Consulta inicial y plan de tratamiento.', now() - interval '3 hours')
on conflict (id) do nothing;

-- 5) Alertas clínicas para algunos pacientes
insert into alertas_clinicas (id, paciente_id, tipo, descripcion, creado_en) values
('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333302', 'alergia', 'Alergia declarada a ibuprofeno.', now() - interval '70 days'),
('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333304', 'riesgo', 'Diabetes tipo 2; revisar integridad cutánea en cada visita.', now() - interval '160 days'),
('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333308', 'adherencia', 'Antecedente de inasistencias; confirmar asistencia por WhatsApp.', now() - interval '10 days'),
('55555555-5555-5555-5555-555555555504', '33333333-3333-3333-3333-333333333309', 'farmacologica', 'En tratamiento anticoagulante; valorar procedimientos invasivos.', now() - interval '40 days')
on conflict (id) do nothing;

-- 6) Notas de ejemplo
insert into notas_paciente (id, paciente_id, autor, contenido, creado_en) values
('66666666-6666-6666-6666-666666666601', '33333333-3333-3333-3333-333333333301', 'Dra. Sánchez', 'Buena respuesta a terapia manual cervical y ejercicios de movilidad.', now() - interval '3 days'),
('66666666-6666-6666-6666-666666666602', '33333333-3333-3333-3333-333333333303', 'Dr. Vega', 'Piel reactiva; recomendar fotoprotección diaria y rutina suave.', now() - interval '2 days'),
('66666666-6666-6666-6666-666666666603', '33333333-3333-3333-3333-333333333304', 'Dr. Martín', 'Se aconseja calzado amplio y revisión podológica en 4 semanas.', now() - interval '2 days'),
('66666666-6666-6666-6666-666666666604', '33333333-3333-3333-3333-333333333306', 'Dra. Sánchez', 'Mantener pauta de ejercicios lumbares en domicilio.', now() - interval '1 day'),
('66666666-6666-6666-6666-666666666605', '33333333-3333-3333-3333-333333333308', 'Dr. Martín', 'Reforzar recordatorio previo por historial de no_show.', now() - interval '20 hours')
on conflict (id) do nothing;

commit;
