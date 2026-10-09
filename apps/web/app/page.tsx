import { Activity, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7fbfb] text-[#10201f]">
      <section className="mx-auto grid min-h-screen max-w-6xl content-center gap-10 px-6 py-12">
        <nav className="flex items-center justify-between border-b border-[#d5e7e4] pb-5">
          <div className="flex items-center gap-3 font-semibold">
            <Activity aria-hidden size={24} />
            <span>HealthHack 2027</span>
          </div>
          <a className="rounded-md bg-[#106b5f] px-4 py-2 text-sm font-medium text-white" href="/register">
            Register
          </a>
        </nav>
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div className="space-y-6">
            <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-7xl">
              HealthHack 2027
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[#3a5652]">
              A configurable event operating system for participant registration, teams, rounds,
              reviews, interviews, onsite operations, and results.
            </p>
            <a
              className="inline-flex items-center gap-2 rounded-md bg-[#10201f] px-5 py-3 font-medium text-white"
              href="/register"
            >
              Start registration <ArrowRight aria-hidden size={18} />
            </a>
          </div>
          <div className="grid gap-3 text-sm">
            {["Multi-event foundation", "Server-enforced RBAC", "Auditable workflows"].map((item) => (
              <div className="rounded-md border border-[#d5e7e4] bg-white p-4 shadow-sm" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
