"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

interface EctsSummary {
  years: string[]
  byYear: Record<string, number>
  total: number
  rows: Array<{
    courseType: string
    byYear: Record<string, number>
    total: number
  }>
}

interface AttendanceData {
  courseCode: string
  marks: Record<string, number>
}

interface UserProfile {
  name: string | null
  school: string | null
}

interface WrappedSnapshot {
  ectsSummary: EctsSummary
  attendance: AttendanceData[]
  userProfile: UserProfile | null
}

interface SlideData {
  id: string
  kicker: string
  title: string
  highlight?: string
  description: string
  badge?: string
  accentFrom: string
  accentVia: string
  accentTo: string
}

function safeParseArray<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "ystava"
  const first = fullName.trim().split(/\s+/)[0]
  return first || "ystava"
}

function getTotalAttendanceMarks(attendance: AttendanceData[]): number {
  return attendance.reduce((total, course) => {
    const courseTotal = Object.values(course.marks || {}).reduce((sum, count) => sum + count, 0)
    return total + courseTotal
  }, 0)
}

function getStudyTimeFromEcts(
  ectsTotal: number,
  attendanceMarksTotal: number
): { lessons: number; hours: number; minutes: number } {
  const ectsMinutes = Math.max(0, Math.round(ectsTotal * 14 * 60 + ectsTotal * 15))
  const deductedMinutes = Math.max(0, attendanceMarksTotal) * 75
  const totalMinutes = Math.max(0, ectsMinutes - deductedMinutes)
  const lessons = Math.round(totalMinutes / 75)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return { lessons, hours, minutes }
}

function getStudyTimeSentence(hours: number, minutes: number): string {
  if (minutes === 0) {
    return `${hours} tuntia elämästäsi on kärsitty koulun penkillä.`
  }
  return `${hours} tuntia ja ${minutes} minuuttia elämästäsi on kärsitty koulun penkillä.`
}

function SlidePanel({ slide }: { slide: SlideData }) {
  const panelRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: panelRef,
    offset: ["start end", "end start"],
  })

  const cardOpacity = useTransform(scrollYProgress, [0.1, 0.3, 0.75, 0.95], [0, 1, 1, 0])
  const cardY = useTransform(scrollYProgress, [0.1, 0.45, 0.9], [120, 0, -120])
  const cardScale = useTransform(scrollYProgress, [0.1, 0.45, 0.9], [0.92, 1, 0.95])

  return (
    <section ref={panelRef} className="relative h-[130vh]">
      <div className="sticky top-0 flex h-[100svh] h-[100dvh] items-center justify-center px-4 py-8 sm:px-8">
        <motion.article
          style={{ opacity: cardOpacity, y: cardY, scale: cardScale }}
          className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-7 shadow-[0_20px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl"
        >
          <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${slide.accentFrom} ${slide.accentVia} ${slide.accentTo} opacity-80 blur-2xl`} />
          <div className={`pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-gradient-to-br ${slide.accentTo} ${slide.accentVia} ${slide.accentFrom} opacity-70 blur-2xl`} />

          <div className="relative">
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.5 }}
              className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70"
            >
              {slide.kicker}
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-4 text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl"
            >
              {slide.title}
            </motion.h2>

            {slide.highlight && (
              <motion.p
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: false, amount: 0.5 }}
                transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.12 }}
                className="mt-5 text-3xl font-black tracking-tight text-[#9fdbff] sm:text-4xl"
              >
                {slide.highlight}
              </motion.p>
            )}

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="mt-5 text-base text-white/85"
            >
              {slide.description}
            </motion.p>

            {slide.badge && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.5 }}
                transition={{ duration: 0.45, delay: 0.2 }}
                className="mt-5 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white/90"
              >
                {slide.badge}
              </motion.div>
            )}
          </div>
        </motion.article>
      </div>
    </section>
  )
}

export default function Slideshow() {
  const [isLoading, setIsLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<WrappedSnapshot>({
    ectsSummary: { years: [], byYear: {}, total: 0, rows: [] },
    attendance: [],
    userProfile: null,
  })

  useEffect(() => {
    const ectsSummary = safeParseArray<EctsSummary>(sessionStorage.getItem("ectsSummary"), {
      years: [],
      byYear: {},
      total: 0,
      rows: [],
    })
    const userProfile = safeParseArray<UserProfile | null>(sessionStorage.getItem("userProfile"), null)
    const attendance = safeParseArray<AttendanceData[]>(sessionStorage.getItem("attendance"), [])

    setSnapshot({ ectsSummary, attendance, userProfile })
    setIsLoading(false)
  }, [])

  const slides = useMemo<SlideData[]>(() => {
    const firstName = getFirstName(snapshot.userProfile?.name)
    const school = snapshot.userProfile?.school || "Koulu"
    const attendanceMarksTotal = getTotalAttendanceMarks(snapshot.attendance)
    const { lessons, hours, minutes } = getStudyTimeFromEcts(
      snapshot.ectsSummary.total || 0,
      attendanceMarksTotal
    )
    const studyTimeSentence = getStudyTimeSentence(hours, minutes)

    return [
      {
        id: "intro",
        kicker: "Lukio Wrapped 2026",
        title: `Hei ${firstName}, Lukio Wrappedisi on valmis.`,
        description: "Skrollaa alas ja katso millainen lukuvuosi sinulla oli.",
        badge: school,
        accentFrom: "from-[#00c2ff]/80",
        accentVia: "via-[#2d7eff]/70",
        accentTo: "to-[#ff5f9e]/80",
      },
      {
        id: "study-time",
        kicker: "Lukioaika",
        title: `Olet istunut yhteensä ${lessons} oppitunnilla lukio urasi aikana.`,
        description: studyTimeSentence,
        accentFrom: "from-[#ff9f67]/80",
        accentVia: "via-[#ff5f9e]/70",
        accentTo: "to-[#6f7eff]/80",
      },
    ]
  }, [snapshot])

  if (isLoading) {
    return (
      <div className="flex min-h-[100svh] min-h-[100dvh] items-center justify-center bg-[#03142d] px-4 text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-white/70">Rakennetaan wrappediasi...</p>
      </div>
    )
  }

  return (
    <main className="relative min-h-[100svh] min-h-[100dvh] overflow-x-clip bg-[#03142d] text-white">
      <div className="pointer-events-none fixed -left-24 top-[-6rem] h-72 w-72 rounded-full bg-[#00c2ff]/30 blur-3xl" />
      <div className="pointer-events-none fixed right-[-5rem] top-16 h-80 w-80 rounded-full bg-[#ff5f9e]/35 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-8rem] left-10 h-72 w-72 rounded-full bg-[#2d7eff]/35 blur-3xl" />

      <div className="relative">
        {slides.map((slide) => (
          <SlidePanel key={slide.id} slide={slide} />
        ))}
      </div>
    </main>
  )
}
