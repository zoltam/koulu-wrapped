// app/wrapped/page.tsx
"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Slideshow from "@/components/Slideshow"
import { useSearchParams } from "next/navigation"

interface AttendanceData {
  courseCode: string;
  marks: {
    [key: string]: number;
  };
}

interface WrappedDataResponse {
  success: boolean;
  unreadMessages?: number;
  subjects?: string[];
  grades?: number[][];
  attendance?: AttendanceData[];
  error?: string;
  details?: string;
  status?: number;
}

let activeLoadPromise: Promise<WrappedDataResponse> | null = null
let activeLoadKey: string | null = null

async function loadWrappedData(wilmaUsername: string, wilmaPassword: string): Promise<WrappedDataResponse> {
  const requestKey = `${wilmaUsername}::${wilmaPassword}`

  if (activeLoadPromise && activeLoadKey === requestKey) {
    return activeLoadPromise
  }

  activeLoadKey = requestKey
  activeLoadPromise = (async () => {
    const response = await fetch("/api/connect-wilma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wilmaUsername, wilmaPassword }),
    })

    const payload = await response.json().catch(() => ({
      success: false,
      error: "Invalid server response",
    }))

    if (!response.ok) {
      return {
        ...payload,
        success: false,
        status: response.status,
      }
    }

    return payload
  })().finally(() => {
    activeLoadPromise = null
    activeLoadKey = null
  })

  return activeLoadPromise
}

function getLoadingMessage(progress: number): string {
  if (progress < 33) return "Finalizing login..."
  if (progress < 66) return "Analyzing your grades..."
  return "Checking your attendance..."
}

export default function Wrapped() {
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const shouldLoad = searchParams.get("loading") === "true"
    if (!shouldLoad) return

    let cancelled = false
    const progressTimer = window.setInterval(() => {
      setLoadProgress((prev) => {
        if (prev >= 90) return prev
        if (prev < 33) return prev + 4
        if (prev < 66) return prev + 3
        return prev + 2
      })
    }, 250)

    const loadData = async () => {
      try {
        let wilmaAuth = JSON.parse(sessionStorage.getItem("wilmaAuth") || "{}")

        if (!wilmaAuth.username || !wilmaAuth.password) {
          const getCookie = (name: string) => {
            const value = `; ${document.cookie}`
            const parts = value.split(`; ${name}=`)
            if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '')
            return ''
          }

          const username = getCookie('wilmaUsername')
          const password = getCookie('wilmaPassword')

          if (username && password) {
            wilmaAuth = { username, password }
            sessionStorage.setItem("wilmaAuth", JSON.stringify(wilmaAuth))
          }
        }

        if (!wilmaAuth.username || !wilmaAuth.password) {
          setError("Missing credentials. Please sign in again.")
          return
        }

        const data = await loadWrappedData(wilmaAuth.username, wilmaAuth.password)
        if (cancelled) return

        if (!data.success) {
          setError(data.error || `Failed to load wrapped data${data.status ? ` (${data.status})` : ""}`)
          setDebugInfo(JSON.stringify(data, null, 2))
          return
        }

        sessionStorage.setItem("unreadMessages", String(data.unreadMessages || 0))
        sessionStorage.setItem("subjects", JSON.stringify(data.subjects || []))
        sessionStorage.setItem("grades", JSON.stringify(data.grades || []))
        sessionStorage.setItem("attendance", JSON.stringify(data.attendance || []))

        setLoadProgress(100)
      } catch (error) {
        if (cancelled) return
        setError(`An error occurred: ${(error as Error).message}`)
        setDebugInfo(JSON.stringify(error, null, 2))
      } finally {
        window.clearInterval(progressTimer)
      }
    }

    loadData()

    return () => {
      cancelled = true
      window.clearInterval(progressTimer)
    }
  }, [searchParams])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md p-6 bg-destructive/20 rounded-lg">
          <h2 className="text-xl font-bold text-destructive-foreground mb-4">Error</h2>
          <p className="mb-4">{error}</p>
          <pre className="p-4 bg-card text-sm overflow-auto max-h-64 rounded-md">
            {debugInfo}
          </pre>
          <button
            onClick={() => window.location.href = '/signin'}
            className="mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-md"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  if (loadProgress < 100) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <motion.div className="w-full max-w-md p-4">
          <div className="h-2 bg-muted rounded-full mb-4">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${loadProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <motion.p className="text-center text-muted-foreground">
            {getLoadingMessage(loadProgress)}
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-md h-[60vh]">
        <Slideshow />
      </div>
    </div>
  )
}
