"use client"

export interface AttendanceData {
  courseCode: string
  marks: {
    [key: string]: number
  }
}

export interface UserProfile {
  name: string | null
  school: string | null
}

export interface GradebookCourse {
  courseCode: string
  courseName: string
  curriculum: string | null
  subject: string | null
  track: string | null
  hierarchy: string[]
  level: number
  grade: number | string | null
  gradeValue: number | null
  ects: number | null
  completionDate: string | null
  completionDateIso: string | null
  teacher: string | null
  attendanceMarks?: Record<string, number>
  attendanceTotal?: number
}

export interface EctsSummaryRow {
  courseType: string
  byYear: Record<string, number>
  total: number
}

export interface EctsSummary {
  years: string[]
  byYear: Record<string, number>
  total: number
  rows: EctsSummaryRow[]
}

export interface WrappedDataResponse {
  success: boolean
  unreadMessages?: number
  subjects?: string[]
  grades?: number[][]
  gradebookCourses?: GradebookCourse[]
  ectsSummary?: EctsSummary
  attendance?: AttendanceData[]
  userProfile?: UserProfile
  error?: string
  details?: string
  status?: number
}

export interface ScrapeProgressEvent {
  type: "progress"
  progress: number
  phase: string
  message: string
}

interface ScrapeDoneEvent {
  type: "done"
  progress: number
  phase: string
  message: string
  result: WrappedDataResponse
}

interface ScrapeErrorEvent {
  type: "error"
  progress: number
  phase: string
  message: string
  error: string
  details?: string
  status?: number
}

type ScrapeStreamEvent = ScrapeProgressEvent | ScrapeDoneEvent | ScrapeErrorEvent

export async function startWilmaScrapeJob(
  wilmaUsername: string,
  wilmaPassword: string
): Promise<{ jobId: string }> {
  const response = await fetch("/api/connect-wilma", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wilmaUsername, wilmaPassword, startJob: true }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.jobId) {
    throw new Error(payload?.error || "Failed to start scrape job")
  }

  return { jobId: payload.jobId as string }
}

export async function waitForWilmaScrapeJob(
  jobId: string,
  onProgress: (event: ScrapeProgressEvent) => void
): Promise<WrappedDataResponse> {
  return new Promise((resolve, reject) => {
    const source = new EventSource(`/api/connect-wilma?jobId=${encodeURIComponent(jobId)}`)

    source.onmessage = (event) => {
      let parsed: ScrapeStreamEvent
      try {
        parsed = JSON.parse(event.data) as ScrapeStreamEvent
      } catch {
        return
      }

      if (parsed.type === "progress") {
        onProgress(parsed)
        return
      }

      source.close()
      if (parsed.type === "done") {
        resolve(parsed.result)
        return
      }

      reject(
        new Error(parsed.error || parsed.message || "Scraping failed while listening for progress")
      )
    }

    source.onerror = () => {
      source.close()
      reject(new Error("Connection to progress stream was interrupted"))
    }
  })
}

export function persistWrappedData(data: WrappedDataResponse): void {
  sessionStorage.setItem("unreadMessages", String(data.unreadMessages || 0))
  sessionStorage.setItem("subjects", JSON.stringify(data.subjects || []))
  sessionStorage.setItem("grades", JSON.stringify(data.grades || []))
  sessionStorage.setItem("gradebookCourses", JSON.stringify(data.gradebookCourses || []))
  sessionStorage.setItem(
    "ectsSummary",
    JSON.stringify(data.ectsSummary || { years: [], byYear: {}, total: 0, rows: [] })
  )
  sessionStorage.setItem("attendance", JSON.stringify(data.attendance || []))
  sessionStorage.setItem("userProfile", JSON.stringify(data.userProfile || null))
  sessionStorage.setItem("wrappedReady", "1")
}
