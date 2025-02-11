"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface SlideProps {
  content: React.ReactNode
}

const Slide: React.FC<SlideProps> = ({ content }) => (
  <motion.div
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -50 }}
    transition={{ duration: 0.5 }}
    className="absolute inset-0 flex items-center justify-center"
  >
    {content}
  </motion.div>
)

export default function Slideshow() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    const storedUnreadMessages = sessionStorage.getItem("unreadMessages")
    setUnreadMessages(storedUnreadMessages ? Number.parseInt(storedUnreadMessages, 10) : 0)

    const timer = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % slides.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(timer)
  }, [])

  const slides = [
    {
      id: 1,
      content: (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4 text-primary">Unread Messages</h2>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="text-6xl font-bold text-accent"
          >
            {unreadMessages}
          </motion.div>
          <p className="mt-4 text-xl text-muted-foreground">new messages waiting for you!</p>
        </div>
      ),
    },
    { id: 2, content: <div className="text-3xl font-bold text-primary">Placeholder Slide 2</div> },
    { id: 3, content: <div className="text-3xl font-bold text-primary">Placeholder Slide 3</div> },
  ]

  return (
    <div className="relative w-full h-full bg-card rounded-lg shadow-lg p-6">
      <AnimatePresence mode="wait">
        <Slide key={currentSlide} content={slides[currentSlide].content} />
      </AnimatePresence>
      <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
        {slides.map((slide, index) => (
          <motion.div
            key={slide.id}
            className={`w-2 h-2 rounded-full ${index === currentSlide ? "bg-primary" : "bg-secondary"}`}
            animate={{ scale: index === currentSlide ? 1.5 : 1 }}
          />
        ))}
      </div>
    </div>
  )
}

