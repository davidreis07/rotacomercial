export default function Home() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-600">
          RotaComercial
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Diagnóstico Supabase
        </h1>

        <div className="mt-6 space-y-3 text-sm">
          <p>
            URL configurada:{" "}
            <strong>{supabaseUrl ? "SIM ✅" : "NÃO ❌"}</strong>
          </p>

          <p>
            Publishable Key configurada:{" "}
            <strong>{hasKey ? "SIM ✅" : "NÃO ❌"}</strong>
          </p>
        </div>
      </div>
    </main>
  );
}