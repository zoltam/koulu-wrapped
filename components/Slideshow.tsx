"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react"
import { AnimatePresence, motion } from "framer-motion"

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

type SlideDirection = 1 | -1

const TRANSITION_MS = 680
const WHEEL_TRIGGER = 12

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function SlideCard({ slide, direction }: { slide: SlideData; direction: SlideDirection }) {
  return (
    <motion.article
      custom={direction}
      initial={{
        opacity: 0,
        y: direction > 0 ? 24 : -24,
        rotateX: direction > 0 ? -14 : 14,
        rotateZ: direction > 0 ? 2.5 : -2.5,
        scale: 0.96,
        filter: "blur(6px) saturate(120%)",
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotateX: 0,
        rotateZ: 0,
        scale: 1,
        filter: "blur(0px) saturate(100%)",
      }}
      exit={{
        opacity: 0,
        y: direction > 0 ? -24 : 24,
        rotateX: direction > 0 ? 12 : -12,
        rotateZ: direction > 0 ? -2 : 2,
        scale: 0.97,
        filter: "blur(5px) saturate(116%)",
      }}
      transition={{ duration: TRANSITION_MS / 1000, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative min-h-[29.5rem] overflow-hidden rounded-[2rem] border border-white/35 bg-[#0a1326] p-7 shadow-[0_30px_95px_rgba(0,0,0,0.52)] sm:min-h-[31rem] sm:p-8"
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(132deg,rgba(255,255,255,0.42)_0%,rgba(255,255,255,0.14)_22%,rgba(9,20,40,0.4)_56%,rgba(8,14,30,0.74)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,81,154,0.18) 0 2px, transparent 2px 11px), repeating-linear-gradient(-135deg, rgba(93,214,255,0.12) 0 1px, transparent 1px 10px), repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 18px)",
        }}
      />
      <div className="pointer-events-none absolute -right-14 top-6 h-10 w-44 rotate-[8deg] bg-gradient-to-r from-[#ff4d9f]/70 via-[#ffcf57]/45 to-[#53d5ff]/70 blur-md" />
      <div className={`pointer-events-none absolute -right-16 -top-14 h-44 w-44 rounded-full bg-gradient-to-br ${slide.accentFrom} ${slide.accentVia} ${slide.accentTo} opacity-85 blur-3xl`} />
      <div className={`pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-gradient-to-br ${slide.accentTo} ${slide.accentVia} ${slide.accentFrom} opacity-65 blur-[58px]`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/28 to-transparent" />
      <div className="pointer-events-none absolute -left-6 bottom-14 h-14 w-14 rotate-45 border border-white/25 bg-[#ff4d9f]/20" />

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">{slide.kicker}</p>
        <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl">{slide.title}</h2>

        {slide.highlight && (
          <p className="mt-5 text-3xl font-black tracking-tight text-[#9fdbff] sm:text-4xl">
            {slide.highlight}
          </p>
        )}

        <p className="mt-5 text-base text-white/88">{slide.description}</p>

        {slide.badge && (
          <div className="mt-6 inline-flex items-center rounded-md border border-white/35 bg-black/25 px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-white/95">
            {slide.badge}
          </div>
        )}
      </div>
    </motion.article>
  )
}

export default function Slideshow() {
  const [isLoading, setIsLoading] = useState(true)
  const [activeSlide, setActiveSlide] = useState(0)
  const [maxReachedSlide, setMaxReachedSlide] = useState(0)
  const [direction, setDirection] = useState<SlideDirection>(1)
  const [isTransitioning, setIsTransitioning] = useState(false)
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
        description: "Napauta tai skrollaa kerran siirtyaksesi seuraavaan korttiin.",
        badge: school,
        accentFrom: "from-[#00c2ff]/80",
        accentVia: "via-[#2d7eff]/70",
        accentTo: "to-[#ff5f9e]/80",
      },
      {
        id: "study-time",
        kicker: "Lukioaika",
        title: `Olet istunut yhteensa ${lessons} oppitunnilla lukio urasi aikana.`,
        description: studyTimeSentence,
        accentFrom: "from-[#ff9f67]/80",
        accentVia: "via-[#ff5f9e]/70",
        accentTo: "to-[#6f7eff]/80",
      },
    ]
  }, [snapshot])

  const goToSlide = useCallback(
    (targetIndex: number) => {
      if (isTransitioning) return
      const clampedTarget = clamp(targetIndex, 0, slides.length - 1)
      if (clampedTarget === activeSlide) return

      setDirection(clampedTarget > activeSlide ? 1 : -1)
      setActiveSlide(clampedTarget)
      setMaxReachedSlide((previous) => Math.max(previous, clampedTarget))
      setIsTransitioning(true)
    },
    [activeSlide, isTransitioning, slides.length]
  )

  const goToNext = useCallback(() => {
    goToSlide(activeSlide + 1)
  }, [activeSlide, goToSlide])

  useEffect(() => {
    if (!isTransitioning) return
    const timeout = window.setTimeout(() => setIsTransitioning(false), TRANSITION_MS)
    return () => window.clearTimeout(timeout)
  }, [isTransitioning])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " ") {
        event.preventDefault()
        goToSlide(activeSlide + 1)
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault()
        goToSlide(activeSlide - 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeSlide, goToSlide])

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      event.preventDefault()
      if (Math.abs(event.deltaY) < WHEEL_TRIGGER) return
      goToSlide(activeSlide + (event.deltaY > 0 ? 1 : -1))
    },
    [activeSlide, goToSlide]
  )

  const handleMainPress = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      goToNext()
    },
    [goToNext]
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[100svh] min-h-[100dvh] items-center justify-center px-4 text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-white/70">Rakennetaan wrappediasi...</p>
      </div>
    )
  }

  return (
    <main
      className="relative flex min-h-[100svh] min-h-[100dvh] items-center justify-center overflow-hidden px-4 pb-28 pt-6 text-white sm:px-8"
      onWheel={handleWheel}
      onPointerUp={handleMainPress}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.12),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_24px),repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_24px)]" />

      <div className="relative w-full max-w-md [perspective:1600px]">
        <AnimatePresence initial={false} mode="wait">
          <SlideCard key={slides[activeSlide].id} slide={slides[activeSlide]} direction={direction} />
        </AnimatePresence>
      </div>

      <div className="fixed bottom-5 left-1/2 z-20 w-[min(94vw,33rem)] -translate-x-1/2">
        <div
          className="relative flex items-center gap-3 rounded-2xl border border-white/25 bg-[#060f24]/78 px-4 py-3 shadow-[0_16px_44px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border border-[#ff68ad]/50 bg-[#ff68ad]/20" />
          <div className="pointer-events-none absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border border-[#5ad6ff]/50 bg-[#5ad6ff]/20" />

          <div className="relative flex min-w-0 flex-1 items-center justify-between px-1">
            <div className="pointer-events-none absolute left-1 right-1 top-1/2 h-px -translate-y-1/2 bg-white/20" />
            {slides.map((slide, index) => {
              const isCurrent = index === activeSlide
              const isReached = index <= maxReachedSlide

              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goToSlide(index)}
                  disabled={!isReached || isTransitioning}
                  aria-label={`Siirry diaan ${index + 1}`}
                  className={`relative z-10 rounded-full transition-all ${
                    isCurrent
                      ? "h-3.5 w-3.5 bg-white shadow-[0_0_0_4px_rgba(255,104,173,0.25)]"
                      : isReached
                        ? "h-2.5 w-2.5 bg-[#9fdbff]/90 hover:scale-110 hover:bg-white"
                        : "h-2.5 w-2.5 cursor-not-allowed bg-white/25"
                  }`}
                />
              )
            })}
          </div>

          <button
            type="button"
            onClick={goToNext}
            disabled={activeSlide >= slides.length - 1 || isTransitioning}
            className="inline-flex h-10 shrink-0 items-center rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  )
}
