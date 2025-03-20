"use client"

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

  // app/signin/page.tsx - Update the handleSubmit function

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  setError("")

  try {
    const response = await fetch("/api/connect-wilma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wilmaUsername: username, wilmaPassword: password }),
    })
    const data = await response.json()
    if (data.success) {
      // Store the auth in both sessionStorage and a cookie for persistence
      sessionStorage.setItem("wilmaAuth", JSON.stringify({
        username,
        password
      }));
      
      // Set a cookie that expires in 24 hours
      document.cookie = `wilmaUsername=${encodeURIComponent(username)};path=/;max-age=86400`;
      document.cookie = `wilmaPassword=${encodeURIComponent(password)};path=/;max-age=86400`;
      
      router.push("/wrapped?loading=true");
    } else {
      setError("Failed to connect to Wilma. Please check your credentials.")
    }
  } catch (error) {
    setError("An unexpected error occurred. Please try again.")
  } finally {
    setIsLoading(false)
  }
}

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-lg"
      >
        <h1 className="text-3xl font-bold text-center text-primary">Sign in with Wilma</h1>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 text-sm text-destructive-foreground bg-destructive rounded-md"
          >
            {error}
          </motion.div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="bg-input text-foreground rounded-[6px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-input text-foreground rounded-[6px]"
            />
          </div>
          <Button type="submit" className="w-full rounded-[8px]" disabled={isLoading}>
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="w-5 h-5 border-t-2 border-r-2 border-white rounded-full"
              />
            ) : (
              "Connect to Wilma"
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}