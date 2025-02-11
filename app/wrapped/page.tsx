// app/wrapped/page.tsx
"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Slideshow from "@/components/Slideshow"
import { useSearchParams } from "next/navigation"

export default function Wrapped() {
  const [loadProgress, setLoadProgress] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [subjects, setSubjects] = useState<string[]>([])
  const [grades, setGrades] = useState<number[][]>([])
  const searchParams = useSearchParams()

  useEffect(() => {
    const loadData = async () => {
      try {
        // Retrieve stored credentials
        const wilmaAuth = JSON.parse(sessionStorage.getItem("wilmaAuth") || "{}")
        
        // First load: unread messages
        const res1 = await fetch("/api/connect-wilma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wilmaUsername: wilmaAuth.username,
            wilmaPassword: wilmaAuth.password,
            step: "unread"
          })
        });
        const { unreadMessages } = await res1.json()
        setUnreadMessages(unreadMessages)
        setLoadProgress(50)

        // Second load: grades data
        const res2 = await fetch("/api/connect-wilma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wilmaUsername: wilmaAuth.username,
            wilmaPassword: wilmaAuth.password,
            step: "grades"
          })
        });
        const { subjects, grades } = await res2.json()
        setSubjects(subjects)
        setGrades(grades)
        setLoadProgress(100)

      } catch (error) {
        console.error("Loading failed:", error)
        // Handle error state
      } finally {
        sessionStorage.removeItem("wilmaAuth")
      }
    }

    if (searchParams.get("loading")) {
      loadData()
    }
  }, [searchParams])

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
            {loadProgress < 50 ? "Finalizing login..." : "Analyzing your grades..."}
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