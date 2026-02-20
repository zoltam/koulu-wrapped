"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"
import {
  persistWrappedData,
  startWilmaScrapeJob,
  waitForWilmaScrapeJob,
} from "@/lib/wilma-scrape-client"

const PROGRESS_RING_RADIUS = 9
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS

export default function SignIn() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submitProgress, setSubmitProgress] = useState(0)
  const [submitMessage, setSubmitMessage] = useState("Kirjaudutaan Wilmaan...")
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSubmitProgress(4)
    setSubmitMessage("Kirjaudutaan Wilmaan...")
    setError("")

    try {
      sessionStorage.removeItem("wrappedReady")
      const { jobId } = await startWilmaScrapeJob(username, password)
      const data = await waitForWilmaScrapeJob(jobId, (progressEvent) => {
        setSubmitProgress(progressEvent.progress)
        setSubmitMessage(progressEvent.message)
      })

      if (!data.success) {
        setError(data.error || "Wilma-yhteys epäonnistui.")
        return
      }

      persistWrappedData(data)
      sessionStorage.setItem("wilmaAuth", JSON.stringify({ username, password }))
      document.cookie = `wilmaUsername=${encodeURIComponent(username)};path=/;max-age=86400`
      document.cookie = `wilmaPassword=${encodeURIComponent(password)};path=/;max-age=86400`
      router.push("/wrapped")
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      setError(message || "Tapahtui odottamaton virhe. Yrit\u00E4 uudelleen.")
    } finally {
      setIsLoading(false)
      setSubmitProgress(0)
      setSubmitMessage("Kirjaudutaan Wilmaan...")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 rounded-xl bg-card p-8 shadow-lg"
      >
        <h1 className="text-center text-3xl font-bold text-primary">Kirjaudu Wilman avulla</h1>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-md bg-destructive p-3 text-sm text-destructive-foreground"
          >
            {error}
          </motion.div>
        )}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
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
              className="rounded-[6px] bg-input text-foreground"
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
              className="rounded-[6px] bg-input text-foreground"
            />
          </div>
          <Button
            type="submit"
            className="h-12 w-full rounded-[10px] border border-[#8ec5ff]/60 bg-gradient-to-r from-[#0d69be] via-[#1b84d8] to-[#0c5ca9] text-white hover:brightness-110"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="relative h-6 w-6">
                  <svg viewBox="0 0 24 24" className="absolute inset-0 h-6 w-6 -rotate-90">
                    <circle cx="12" cy="12" r={PROGRESS_RING_RADIUS} stroke="rgba(255,255,255,0.28)" strokeWidth="2" fill="none" />
                    <motion.circle
                      cx="12"
                      cy="12"
                      r={PROGRESS_RING_RADIUS}
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={PROGRESS_RING_CIRCUMFERENCE}
                      animate={{
                        strokeDashoffset:
                          PROGRESS_RING_CIRCUMFERENCE * (1 - submitProgress / 100),
                      }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </svg>
                  <motion.span
                    className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-white/35"
                    animate={{ opacity: [0.2, 0.45, 0.2], scale: [0.92, 1, 0.92] }}
                    transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  />
                </div>
                <motion.span
                  key={submitMessage}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm"
                >
                  {submitMessage}
                </motion.span>
              </div>
            ) : (
              <>
                <Image src="/wilma-logo.svg" alt="Wilma" width={18} height={18} />
                Kirjaudu Wilman avulla
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
