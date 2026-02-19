import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03142d] text-white">
      <div className="pointer-events-none absolute -left-24 top-[-6rem] h-72 w-72 rounded-full bg-[#00c2ff]/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5rem] top-16 h-80 w-80 rounded-full bg-[#ff5f9e]/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-10 h-72 w-72 rounded-full bg-[#2d7eff]/35 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-10 sm:px-10 sm:py-14">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#00d6ff]" />
            Lukio Wrapped 2026
          </div>
        </header>

        <div className="grid items-end gap-10 py-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <h1 className="text-5xl font-black uppercase leading-[0.92] tracking-tight sm:text-7xl">
              Lukio
              <br />
              Wrapped
            </h1>
            <p className="max-w-lg text-base text-white/80 sm:text-lg">
              Näe lukuvuotesi tarina yhdellä napilla: viestit, arvosanat ja poissaolot Wrapped-tyylillä.
            </p>
            <Link href="/signin" className="inline-block pt-6 sm:pt-8">
              <Button
                size="lg"
                className="h-14 rounded-full border border-[#8ec5ff]/60 bg-gradient-to-r from-[#0d69be] via-[#1b84d8] to-[#0c5ca9] px-7 text-base font-bold text-white shadow-[0_16px_40px_rgba(12,92,169,0.45)] transition-transform hover:scale-[1.02] hover:brightness-110"
              >
                <Image src="/wilma-logo.svg" alt="Wilma" width={22} height={22} />
                Log in with Wilma
              </Button>
            </Link>
          </div>

          <aside className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Esimerkki Wrapped</p>
            <div className="space-y-3 rounded-2xl border border-white/15 bg-[#0b264a]/70 p-5">
              <p className="text-2xl font-black tracking-tight">34 poissaoloa yhteensä</p>
              <p className="text-base text-white/85">Paras aine: matematiikka</p>
              <p className="text-base text-white/85">Kurssien keskiarvo: 7.4</p>
            </div>
          </aside>
        </div>

        <footer className="text-xs uppercase tracking-[0.2em] text-white/60">
          Valmis katsomaan lukuvuotesi kohokohdat?
        </footer>
      </section>
    </main>
  );
}
