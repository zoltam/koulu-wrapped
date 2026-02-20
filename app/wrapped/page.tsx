"use client"

import { useEffect, useState } from "react"
import Slideshow from "@/components/Slideshow"

type WrappedViewState = "checking" | "ready" | "missing"

export default function Wrapped() {
  const [viewState, setViewState] = useState<WrappedViewState>("checking")

  useEffect(() => {
    const ready = sessionStorage.getItem("wrappedReady") === "1"
    setViewState(ready ? "ready" : "missing")
  }, [])

  if (viewState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#03142d] px-4 text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-white/70">Tarkistetaan wrapped...</p>
      </div>
    )
  }

  if (viewState === "missing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#03142d] px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-xl">
          <p className="text-base text-white/90">Wrapped-data puuttuu. Kirjaudu Wilmaan uudelleen.</p>
          <button
            onClick={() => (window.location.href = "/signin")}
            className="mt-4 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm text-white transition hover:bg-white/20"
          >
            Siirry kirjautumiseen
          </button>
        </div>
      </div>
    )
  }

  return <Slideshow />
}
