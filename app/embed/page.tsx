const embedCode = `<script src="https://callosa-salus-j78jwl6qn-chatbot7.vercel.app/widget.js"></script>
<div id="callosasalud-widget"></div>`;

export default function EmbedPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold">Embed del widget de reservas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Copia y pega este bloque en tu web para mostrar el widget de CallosaSalud.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold">Código para copiar</h2>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
            <code>{embedCode}</code>
          </pre>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold">Instrucciones</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Abre el HTML o plantilla de tu web donde quieras mostrar el widget.</li>
            <li>Pega el script y el div exactamente como aparece arriba.</li>
            <li>Guarda cambios y publica tu web.</li>
            <li>El widget aparecerá automáticamente en el contenedor.</li>
          </ol>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold">Preview</h2>
          <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
            <iframe
              src="https://callosa-salus-j78jwl6qn-chatbot7.vercel.app/widget"
              title="Preview widget CallosaSalud"
              className="block h-[860px] w-full border-0"
              loading="lazy"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
