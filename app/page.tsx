"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function Home() {
  const [showLogin, setShowLogin] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      sessionStorage.setItem("wilmaAuth", JSON.stringify({ username, password }))
      document.cookie = `wilmaUsername=${encodeURIComponent(username)};path=/;max-age=86400`
      document.cookie = `wilmaPassword=${encodeURIComponent(password)};path=/;max-age=86400`
      router.push("/wrapped?loading=true")
    } catch {
      setError("Tapahtui odottamaton virhe. Yrit\u00E4 uudelleen.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03142d] text-white">
      <div className="pointer-events-none absolute -left-24 top-[-6rem] h-72 w-72 rounded-full bg-[#00c2ff]/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[-5rem] top-16 h-80 w-80 rounded-full bg-[#ff5f9e]/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-10 h-72 w-72 rounded-full bg-[#2d7eff]/35 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 sm:px-10 sm:py-14">
        <AnimatePresence mode="wait">
          {showLogin ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mx-auto w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            >
              <h1 className="text-center text-3xl font-black tracking-tight">Lukio Wrapped</h1>
              <p className="mt-2 text-center text-sm text-white/80">{"Kirjaudu Wilman avulla jatkaaksesi."}</p>

              {error ? (
                <div className="mt-5 rounded-md bg-destructive p-3 text-sm text-destructive-foreground">{error}</div>
              ) : null}


              <form onSubmit={handleSubmit} autoComplete="off" className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">{"K\u00E4ytt\u00E4j\u00E4tunnus"}</Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="off"
                    data-1p-ignore="true"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="rounded-[8px] bg-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Salasana</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="rounded-[8px] bg-input text-foreground"
                  />
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-[10px] border border-[#8ec5ff]/60 bg-gradient-to-r from-[#0d69be] via-[#1b84d8] to-[#0c5ca9] text-white hover:brightness-110"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                      className="h-5 w-5 rounded-full border-r-2 border-t-2 border-white"
                    />
                  ) : (
                    <>
                      <Image src="/wilma-logo.svg" alt="Wilma" width={18} height={18} />
                      Kirjaudu Wilman avulla
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-white/80 hover:bg-white/10 hover:text-white"
                  onClick={() => setShowLogin(false)}
                >
                  Takaisin
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="w-full"
            >
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
                    {"N\u00E4e lukuvuotesi tarina yhdell\u00E4 napilla: viestit, arvosanat ja poissaolot Wrapped-tyylill\u00E4."}
                  </p>
                  <div className="inline-block pt-6 sm:pt-8">
                    <Button
                      size="lg"
                      className="h-14 rounded-full border border-[#8ec5ff]/60 bg-gradient-to-r from-[#0d69be] via-[#1b84d8] to-[#0c5ca9] px-7 text-base font-bold text-white shadow-[0_16px_40px_rgba(12,92,169,0.45)] transition-transform hover:scale-[1.02] hover:brightness-110"
                      onClick={() => setShowLogin(true)}
                    >
                      <Image src="/wilma-logo.svg" alt="Wilma" width={22} height={22} />
                      Kirjaudu Wilman avulla
                    </Button>
                  </div>
                </div>

                <aside className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Esimerkki Wrapped</p>
                  <div className="space-y-3 rounded-2xl border border-white/15 bg-[#0b264a]/70 p-5">
                    <p className="text-2xl font-black tracking-tight">{"34 poissaoloa yhteens\u00E4"}</p>
                    <p className="text-base text-white/85">Paras aine: matematiikka</p>
                    <p className="text-base text-white/85">Kurssien keskiarvo: 7.4</p>
                  </div>
                </aside>
              </div>

              <footer className="text-xs uppercase tracking-[0.2em] text-white/60">Valmis katsomaan lukuvuotesi kohokohdat?</footer>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  )
}
