"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Slideshow from "@/components/Slideshow"

export default function Wrapped() {
  const [isLoading, setIsLoading] = useState(true)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setIsLoading(false)
      // Retrieve unread messages count from sessionStorage
      const storedUnreadMessages = sessionStorage.getItem("unreadMessages")
      setUnreadMessages(storedUnreadMessages ? Number.parseInt(storedUnreadMessages, 10) : 0)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="w-16 h-16 border-t-4 border-primary rounded-full"
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-xl text-primary"
        >
          Loading your school year data...
        </motion.p>
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

