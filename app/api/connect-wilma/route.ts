import { NextResponse } from "next/server"
import puppeteer, { Page } from "puppeteer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface UserProfile {
  name: string | null
  school: string | null
}

interface AttendanceData {
  courseCode: string
  marks: {
    [key: string]: number
  }
}

interface WrappedDataResponse {
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

interface GradebookCourse {
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

interface EctsSummaryRow {
  courseType: string
  byYear: Record<string, number>
  total: number
}

interface EctsSummary {
  years: string[]
  byYear: Record<string, number>
  total: number
  rows: EctsSummaryRow[]
}

type ScrapeMode = "all" | "unread" | "grades" | "attendance"

interface ProgressUpdate {
  progress: number
  phase: string
  message: string
}

interface ProgressEvent extends ProgressUpdate {
  type: "progress"
}

interface DoneEvent extends ProgressUpdate {
  type: "done"
  result: WrappedDataResponse
}

interface ErrorEvent extends ProgressUpdate {
  type: "error"
  error: string
  details?: string
  status?: number
}

type StreamEvent = ProgressEvent | DoneEvent | ErrorEvent

interface ScrapeJob {
  id: string
  listeners: Set<ReadableStreamDefaultController<Uint8Array>>
  currentEvent: StreamEvent
  finished: boolean
  cleanupTimer: ReturnType<typeof setTimeout> | null
}

class ScrapeError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const encoder = new TextEncoder()
const jobs = new Map<string, ScrapeJob>()
const JOB_TTL_MS = 5 * 60 * 1000

function toSseMessage(event: StreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
}

function normalizeMode(step: unknown): ScrapeMode {
  if (step === "unread" || step === "grades" || step === "attendance") {
    return step
  }
  return "all"
}

function normalizeCourseCode(courseCode: string): string {
  return courseCode.replace(/\s+/g, "").trim().toLowerCase()
}

function mergeAttendanceIntoGradebookCourses(
  gradebookCourses: GradebookCourse[],
  attendance: AttendanceData[]
): GradebookCourse[] {
  const attendanceByCode = new Map<string, AttendanceData["marks"]>()
  attendance.forEach((course) => {
    attendanceByCode.set(normalizeCourseCode(course.courseCode), course.marks)
  })

  return gradebookCourses.map((course) => {
    const attendanceMarks = attendanceByCode.get(normalizeCourseCode(course.courseCode)) || {}
    const attendanceTotal = Object.values(attendanceMarks).reduce((sum, count) => sum + count, 0)

    return {
      ...course,
      attendanceMarks,
      attendanceTotal,
    }
  })
}

function createScrapeJob(): ScrapeJob {
  const id = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const job: ScrapeJob = {
    id,
    listeners: new Set(),
    currentEvent: {
      type: "progress",
      progress: 2,
      phase: "queued",
      message: "Käynnistetään scraping...",
    },
    finished: false,
    cleanupTimer: null,
  }

  jobs.set(id, job)
  return job
}

function scheduleJobCleanup(job: ScrapeJob): void {
  if (job.cleanupTimer) {
    clearTimeout(job.cleanupTimer)
  }
  job.cleanupTimer = setTimeout(() => {
    jobs.delete(job.id)
  }, JOB_TTL_MS)
}

function pushJobEvent(job: ScrapeJob, event: StreamEvent): void {
  job.currentEvent = event

  for (const controller of [...job.listeners]) {
    try {
      controller.enqueue(toSseMessage(event))
      if (event.type !== "progress") {
        controller.close()
        job.listeners.delete(controller)
      }
    } catch {
      job.listeners.delete(controller)
    }
  }

  if (event.type !== "progress") {
    job.finished = true
    scheduleJobCleanup(job)
  }
}

function createResponseStatus(error: unknown): number {
  if (error instanceof ScrapeError) {
    return error.status
  }
  return 500
}

function createResponseError(error: unknown): string {
  if (error instanceof ScrapeError) {
    return error.message
  }
  return "Failed to connect to Wilma"
}

function createResponseDetails(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message
  }
  return undefined
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get("jobId")

  if (!jobId) {
    return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 })
  }

  const job = jobs.get(jobId)
  if (!job) {
    return NextResponse.json({ success: false, error: "Progress job not found" }, { status: 404 })
  }

  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
      job.listeners.add(controller)

      controller.enqueue(toSseMessage(job.currentEvent))

      if (job.finished) {
        controller.close()
        job.listeners.delete(controller)
        return
      }

      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"))
        } catch {
          job.listeners.delete(controller)
          if (keepAliveTimer) {
            clearInterval(keepAliveTimer)
            keepAliveTimer = null
          }
        }
      }, 15_000)
    },
    cancel() {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer)
        keepAliveTimer = null
      }
      if (controllerRef) {
        job.listeners.delete(controllerRef)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

export async function POST(request: Request) {
  const requestId = `wilma-${Date.now().toString(36)}`
  const startedAt = Date.now()
  let requestBody: Record<string, unknown>

  try {
    requestBody = (await request.json()) as Record<string, unknown>
  } catch (error) {
    console.error(`[${requestId}] Invalid request body`, error)
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }

  const wilmaUsername = String(requestBody.wilmaUsername || "")
  const wilmaPassword = String(requestBody.wilmaPassword || "")
  const mode = normalizeMode(requestBody.step)
  const startJob = Boolean(requestBody.startJob)

  if (!wilmaUsername || !wilmaPassword) {
    console.error(`[${requestId}] Missing credentials`)
    return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 })
  }

  if (startJob) {
    const job = createScrapeJob()
    void runScrapeJob({
      job,
      requestId,
      wilmaUsername,
      wilmaPassword,
      mode,
      startedAt,
    })

    return NextResponse.json({ success: true, jobId: job.id })
  }

  try {
    const result = await scrapeWilma({
      requestId,
      wilmaUsername,
      wilmaPassword,
      mode,
      onProgress: () => undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error(`[${requestId}] Failed scrape`, error)
    return NextResponse.json(
      {
        success: false,
        error: createResponseError(error),
        details: createResponseDetails(error),
      },
      { status: createResponseStatus(error) }
    )
  }
}

async function runScrapeJob({
  job,
  requestId,
  wilmaUsername,
  wilmaPassword,
  mode,
  startedAt,
}: {
  job: ScrapeJob
  requestId: string
  wilmaUsername: string
  wilmaPassword: string
  mode: ScrapeMode
  startedAt: number
}) {
  try {
    const result = await scrapeWilma({
      requestId,
      wilmaUsername,
      wilmaPassword,
      mode,
      onProgress: (update) => {
        pushJobEvent(job, { type: "progress", ...update })
      },
    })

    pushJobEvent(job, {
      type: "done",
      progress: 100,
      phase: "done",
      message: "Wrapped on valmis.",
      result,
    })
  } catch (error) {
    console.error(`[${requestId}] Failed scrape`, error)
    pushJobEvent(job, {
      type: "error",
      progress: 100,
      phase: "error",
      message: "Scraping epäonnistui.",
      error: createResponseError(error),
      details: createResponseDetails(error),
      status: createResponseStatus(error),
    })
  } finally {
    const durationMs = Date.now() - startedAt
    console.log(`[${requestId}] Finished ${mode} scrape in ${durationMs}ms`)
  }
}

async function scrapeWilma({
  requestId,
  wilmaUsername,
  wilmaPassword,
  mode,
  onProgress,
}: {
  requestId: string
  wilmaUsername: string
  wilmaPassword: string
  mode: ScrapeMode
  onProgress: (update: ProgressUpdate) => void
}): Promise<WrappedDataResponse> {
  console.log(`[${requestId}] Starting ${mode} scrape`)

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

  try {
    onProgress({ progress: 8, phase: "login", message: "Yhdistetään Wilmaan..." })

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()
    await page.goto("https://yvkoulut.inschool.fi/", { waitUntil: "domcontentloaded" })
    await page.type("#login-frontdoor", wilmaUsername)
    await page.type("#password", wilmaPassword)
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.click('[name="submit"]'),
    ])

    const loginSuccess = await page.$("body.somebody")
    if (!loginSuccess) {
      throw new ScrapeError("Invalid Wilma credentials", 401)
    }

    onProgress({ progress: 24, phase: "login-success", message: "Kirjautuminen onnistui." })
    const userProfile = await getUserProfile(page)

    if (mode === "unread") {
      onProgress({ progress: 55, phase: "unread", message: "Haetaan viestit..." })
      const unreadMessages = await getUnreadMessages(page)
      onProgress({ progress: 92, phase: "unread", message: "Viestit haettu." })
      return { success: true, unreadMessages, userProfile }
    }

    if (mode === "grades") {
      onProgress({ progress: 52, phase: "grades", message: "Haetaan arvosanat..." })
      await page.goto("https://yvkoulut.inschool.fi/choices?view=gradebook", {
        waitUntil: "domcontentloaded",
      })
      const { subjects, grades, gradebookCourses } = await getGradesData(page)
      await page.goto("https://yvkoulut.inschool.fi/choices?view=summary", {
        waitUntil: "domcontentloaded",
      })
      const ectsSummary = await getEctsSummaryData(page)
      onProgress({ progress: 92, phase: "grades", message: "Arvosanat haettu." })
      return { success: true, subjects, grades, gradebookCourses, ectsSummary, userProfile }
    }

    if (mode === "attendance") {
      onProgress({ progress: 52, phase: "attendance", message: "Haetaan poissaolot..." })
      await page.goto(
        "https://yvkoulut.inschool.fi/attendance/view?range=-3&first=1.1.2000&last=1.1.2040",
        {
          waitUntil: "domcontentloaded",
        }
      )
      const attendance = await getAttendanceData(page)
      onProgress({ progress: 92, phase: "attendance", message: "Poissaolot haettu." })
      return { success: true, attendance, userProfile }
    }

    onProgress({ progress: 40, phase: "unread", message: "Haetaan viestit..." })
    const unreadMessages = await getUnreadMessages(page)

    onProgress({ progress: 58, phase: "grades", message: "Haetaan arvosanat..." })
    await page.goto("https://yvkoulut.inschool.fi/choices?view=gradebook", {
      waitUntil: "domcontentloaded",
    })
    const { subjects, grades, gradebookCourses } = await getGradesData(page)
    await page.goto("https://yvkoulut.inschool.fi/choices?view=summary", {
      waitUntil: "domcontentloaded",
    })
    const ectsSummary = await getEctsSummaryData(page)

    onProgress({ progress: 82, phase: "attendance", message: "Haetaan poissaolot..." })
    await page.goto(
      "https://yvkoulut.inschool.fi/attendance/view?range=-3&first=1.1.2000&last=1.1.2040",
      {
        waitUntil: "domcontentloaded",
      }
    )
    const attendance = await getAttendanceData(page)
    const mergedGradebookCourses = mergeAttendanceIntoGradebookCourses(gradebookCourses, attendance)

    onProgress({ progress: 96, phase: "finalizing", message: "Viimeistellään wrapped..." })
    return {
      success: true,
      unreadMessages,
      subjects,
      grades,
      gradebookCourses: mergedGradebookCourses,
      ectsSummary,
      attendance,
      userProfile,
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

async function getUserProfile(page: Page): Promise<UserProfile> {
  try {
    await page.waitForSelector(".dropdown-toggle.profile .name-container", { timeout: 10000 })

    return await page.evaluate(() => {
      const name = document
        .querySelector(".dropdown-toggle.profile .name-container .teacher")
        ?.textContent?.trim()
      const school = document
        .querySelector(".dropdown-toggle.profile .name-container .school")
        ?.textContent?.trim()

      return {
        name: name || null,
        school: school || null,
      }
    })
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return { name: null, school: null }
  }
}

async function getUnreadMessages(page: Page): Promise<number> {
  try {
    const unreadMessagesElement = await page.$('a[href="/messages"] .badge')
    let unreadMessages = 0

    if (unreadMessagesElement) {
      const text = await page.evaluate((element) => element.textContent, unreadMessagesElement)
      if (text) {
        const match = text.match(/(\d+)/)
        if (match) unreadMessages = Number.parseInt(match[1], 10)
      }
    }

    return unreadMessages
  } catch (error) {
    console.error("Error fetching unread messages:", error)
    return 0
  }
}

async function getGradesData(page: Page): Promise<{
  subjects: string[]
  grades: number[][]
  gradebookCourses: GradebookCourse[]
}> {
  try {
    await page.waitForSelector("#gradebook", { timeout: 10000 })

    const canExpandAll = await page
      .$eval("#expand-all", (element) => {
        const style = window.getComputedStyle(element)
        return style.display !== "none" && style.visibility !== "hidden"
      })
      .catch(() => false)

    if (canExpandAll) {
      await page.click("#expand-all a")
      await page.waitForFunction(
        () => {
          const collapsedRows = document.querySelectorAll("#gradebook tbody tr[style*='display: none']")
          return collapsedRows.length === 0
        },
        { timeout: 5000 }
      ).catch(() => undefined)
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    return await page.evaluate(() => {
      const toText = (cell?: Element | null): string => {
        return cell?.textContent?.replace(/\s+/g, " ").trim() || ""
      }

      const parseNumber = (value: string): number | null => {
        if (!value) return null
        const normalized = value.replace(",", ".").trim()
        const parsed = Number.parseFloat(normalized)
        return Number.isFinite(parsed) ? parsed : null
      }

      const parseDateIso = (value: string): string | null => {
        const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
        if (!match) return null
        const day = match[1].padStart(2, "0")
        const month = match[2].padStart(2, "0")
        return `${match[3]}-${month}-${day}`
      }

      const rows = Array.from(document.querySelectorAll("#gradebook tbody tr"))
      const hierarchyByLevel: Record<number, string> = {}
      const gradebookCourses: GradebookCourse[] = []

      rows.forEach((row) => {
        const levelMatch = row.className.match(/level(\d+)/)
        const level = levelMatch ? Number.parseInt(levelMatch[1], 10) : 0
        if (!level) return

        const cells = row.querySelectorAll("td")
        if (!cells.length) return

        const nameCell = cells[0]
        const rootSpan = nameCell.querySelector("span")
        const codeText = toText(nameCell.querySelector(".secondary-text"))

        let labelText = ""
        if (rootSpan) {
          const clone = rootSpan.cloneNode(true) as HTMLElement
          clone.querySelectorAll(".secondary-text").forEach((element) => element.remove())
          labelText = toText(clone)
        }
        if (!labelText) {
          labelText = toText(nameCell)
        }

        if (labelText) {
          hierarchyByLevel[level] = labelText
          Object.keys(hierarchyByLevel).forEach((key) => {
            const asNumber = Number.parseInt(key, 10)
            if (asNumber > level) {
              delete hierarchyByLevel[asNumber]
            }
          })
        }

        if (!codeText) return

        const gradeText = toText(cells[1])
        const completedDate = toText(cells[3])
        const isCompleted = Boolean(gradeText || completedDate)
        if (!isCompleted) return

        const hierarchy: string[] = []
        for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
          const label = hierarchyByLevel[currentLevel]
          if (label) hierarchy.push(label)
        }

        const gradeNumeric = parseNumber(gradeText)
        const grade = gradeText ? (gradeNumeric !== null ? gradeNumeric : gradeText) : null

        const immediateParent = hierarchyByLevel[level - 1] || null
        const level2Parent = hierarchyByLevel[2] || null
        const curriculum = hierarchyByLevel[1] || null
        const subject = level >= 3 ? (level2Parent || immediateParent) : (immediateParent || curriculum)

        gradebookCourses.push({
          courseCode: codeText,
          courseName: labelText,
          curriculum,
          subject,
          track: immediateParent,
          hierarchy,
          level,
          grade,
          gradeValue: gradeNumeric,
          ects: parseNumber(toText(cells[2])),
          completionDate: completedDate || null,
          completionDateIso: parseDateIso(completedDate),
          teacher: toText(cells[4]) || null,
        })
      })

      const subjectGradeMap = new Map<string, number[]>()
      gradebookCourses.forEach((course) => {
        if (typeof course.gradeValue !== "number") return

        const subjectName = course.subject || course.track || course.curriculum || "Muu aine"
        const currentGrades = subjectGradeMap.get(subjectName) || []
        currentGrades.push(course.gradeValue)
        subjectGradeMap.set(subjectName, currentGrades)
      })

      const subjects = Array.from(subjectGradeMap.keys())
      const grades = subjects.map((subjectName) => subjectGradeMap.get(subjectName) || [])

      return { subjects, grades, gradebookCourses }
    })
  } catch (error) {
    console.error("Error fetching grades:", error)
    return { subjects: [], grades: [], gradebookCourses: [] }
  }
}

async function getAttendanceData(page: Page): Promise<AttendanceData[]> {
  try {
    await page.waitForSelector(".datatable.attendance-single")

    return await page.evaluate(() => {
      const courses: { [key: string]: { [markType: string]: number } } = {}
      const relevantMarks = new Set([
        "Terveydellisiin syihin liittyvä poissaolo",
        "Luvaton poissaolo (selvitetty)",
        "Myöhässä alle 15 min",
      ])

      document.querySelectorAll("td.event").forEach((element) => {
        const title = element.getAttribute("title")
        if (!title) return

        const [coursePart, ...rest] = title.split(";")
        const courseCode = coursePart.trim()
        const markPart = rest.join(";").split("/")[0].trim()

        if (relevantMarks.has(markPart)) {
          if (!courses[courseCode]) {
            courses[courseCode] = {}
          }
          courses[courseCode][markPart] = (courses[courseCode][markPart] || 0) + 1
        }
      })

      return Object.entries(courses).map(([courseCode, marks]) => ({
        courseCode,
        marks,
      }))
    })
  } catch (error) {
    console.error("Error fetching attendance data:", error)
    return []
  }
}

async function getEctsSummaryData(page: Page): Promise<EctsSummary> {
  try {
    await page.waitForSelector("#credits-summary-table", { timeout: 10000 })

    return await page.evaluate(() => {
      const toText = (element?: Element | null): string => {
        return element?.textContent?.replace(/\s+/g, " ").trim() || ""
      }

      const parseNumber = (value: string): number => {
        const normalized = value.replace(",", ".").trim()
        if (!normalized) return 0
        const parsed = Number.parseFloat(normalized)
        return Number.isFinite(parsed) ? parsed : 0
      }

      const table = document.querySelector("#credits-summary-table")
      if (!table) {
        return { years: [], byYear: {}, total: 0, rows: [] }
      }

      const headerCells = Array.from(table.querySelectorAll("thead th"))
      const allColumns = headerCells.map((cell) => toText(cell))
      const yearColumns = allColumns.slice(1, -1)
      const years = yearColumns.filter((value) => Boolean(value))

      const rows: EctsSummaryRow[] = []
      table.querySelectorAll("tbody tr").forEach((row) => {
        const cells = row.querySelectorAll("td")
        if (cells.length < 2) return

        const courseType = toText(cells[0])
        if (!courseType) return

        const byYear: Record<string, number> = {}
        years.forEach((year, index) => {
          byYear[year] = parseNumber(toText(cells[index + 1]))
        })
        const total = parseNumber(toText(cells[cells.length - 1]))

        rows.push({ courseType, byYear, total })
      })

      const totalsRow = table.querySelector("tfoot tr.total")
      const byYear: Record<string, number> = {}
      if (totalsRow) {
        const totalCells = totalsRow.querySelectorAll("td")
        years.forEach((year, index) => {
          byYear[year] = parseNumber(toText(totalCells[index + 1]))
        })
      } else {
        years.forEach((year) => {
          byYear[year] = rows.reduce((sum, row) => sum + (row.byYear[year] || 0), 0)
        })
      }

      const total =
        totalsRow !== null
          ? parseNumber(toText(totalsRow.querySelector("td:last-child")))
          : rows.reduce((sum, row) => sum + row.total, 0)

      return { years, byYear, total, rows }
    })
  } catch (error) {
    console.error("Error fetching ECTS summary:", error)
    return { years: [], byYear: {}, total: 0, rows: [] }
  }
}
