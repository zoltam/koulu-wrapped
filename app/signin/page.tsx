"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"

export default function SignIn() {
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
      sessionStorage.setItem("wilmaAuth", JSON.stringify({
        username,
        password
      }))

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
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8 rounded-xl bg-card p-8 shadow-lg"
      >
        <h1 className="text-center text-3xl font-bold text-primary">Kirjaudu Wilmaan</h1>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-md bg-destructive p-3 text-sm text-destructive-foreground"
          >
            {error}
          </motion.div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">{"K\u00E4ytt\u00E4j\u00E4tunnus"}</Label>
            <Input
              id="username"
              type="text"
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
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="h-5 w-5 rounded-full border-r-2 border-t-2 border-white"
              />
            ) : (
              <>
                <Image src="/wilma-logo.svg" alt="Wilma" width={18} height={18} />
                Log in with Wilma
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
