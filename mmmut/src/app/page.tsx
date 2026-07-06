import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-emerald-500/30">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-emerald-500/20 via-zinc-900/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      <main className="z-10 flex flex-col items-center max-w-5xl px-6 text-center">
        
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full bg-zinc-900/50 border border-zinc-800 text-sm font-medium text-zinc-300 backdrop-blur-md shadow-2xl animate-fade-in-up">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          System Operational
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
          MMMUT Notice <br className="hidden md:block" />
          Intelligence Platform
        </h1>

        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-12 leading-relaxed">
          The automated, zero-cost pipeline that scrapes, processes, and distributes university notices using advanced OCR and Gemini Vision AI.
        </p>

        <Link
          href="/admin/notices"
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-zinc-100 text-zinc-950 rounded-full font-semibold text-lg transition-all duration-300 hover:scale-105 hover:bg-white focus:outline-none focus:ring-4 focus:ring-zinc-100/20"
        >
          Enter Admin Dashboard
          <svg
            className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          {/* Subtle glow effect behind button */}
          <div className="absolute inset-0 rounded-full bg-zinc-100 blur-md opacity-20 group-hover:opacity-40 transition-opacity -z-10" />
        </Link>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full">
          {[
            {
              title: "AI-Powered Extraction",
              desc: "Automatically extracts dates, summaries, and categories from complex Hindi PDFs.",
              icon: "M13 10V3L4 14h7v7l9-11h-7z"
            },
            {
              title: "Zero-Cost Infrastructure",
              desc: "Built entirely on free-tier services using GitHub Actions, Vercel, and Supabase.",
              icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            },
            {
              title: "WhatsApp Ready",
              desc: "Generates formatted messages with Google Calendar links instantly.",
              icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            }
          ].map((feature, i) => (
            <div key={i} className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm transition-colors hover:bg-zinc-800/50">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">{feature.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
