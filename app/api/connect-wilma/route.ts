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
  attendance?: AttendanceData[]
  userProfile?: UserProfile
  error?: string
  details?: string
  status?: number
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
      await page.goto("https://yvkoulut.inschool.fi/choices", { waitUntil: "domcontentloaded" })
      const { subjects, grades } = await getGradesData(page)
      onProgress({ progress: 92, phase: "grades", message: "Arvosanat haettu." })
      return { success: true, subjects, grades, userProfile }
    }

    if (mode === "attendance") {
      onProgress({ progress: 52, phase: "attendance", message: "Haetaan poissaolot..." })
      await page.goto("https://yvkoulut.inschool.fi/attendance/view?range=-4", {
        waitUntil: "domcontentloaded",
      })
      const attendance = await getAttendanceData(page)
      onProgress({ progress: 92, phase: "attendance", message: "Poissaolot haettu." })
      return { success: true, attendance, userProfile }
    }

    onProgress({ progress: 40, phase: "unread", message: "Haetaan viestit..." })
    const unreadMessages = await getUnreadMessages(page)

    onProgress({ progress: 58, phase: "grades", message: "Haetaan arvosanat..." })
    await page.goto("https://yvkoulut.inschool.fi/choices", { waitUntil: "domcontentloaded" })
    const { subjects, grades } = await getGradesData(page)

    onProgress({ progress: 82, phase: "attendance", message: "Haetaan poissaolot..." })
    await page.goto("https://yvkoulut.inschool.fi/attendance/view?range=-4", {
      waitUntil: "domcontentloaded",
    })
    const attendance = await getAttendanceData(page)

    onProgress({ progress: 96, phase: "finalizing", message: "Viimeistellään wrapped..." })
    return {
      success: true,
      unreadMessages,
      subjects,
      grades,
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

async function getGradesData(page: Page): Promise<{ subjects: string[]; grades: number[][] }> {
  try {
    await page.waitForSelector("#choices-tree", { timeout: 10000 })

    const checkboxExists = await page.$("#cb-show-graded")
    if (checkboxExists) {
      await page.click("#cb-show-graded")
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    return await page.evaluate(() => {
      const subjects: string[] = []
      const grades: number[][] = []

      const mainCategories = document.querySelectorAll("#choices-tree > li.flag-show > ul > li.flag-show > a")

      mainCategories.forEach((categoryElement) => {
        const subjectElements = categoryElement.parentElement?.querySelectorAll(
          "ul > li.flag-show > a.c-type236-graded"
        )

        subjectElements?.forEach((subjectElement) => {
          const subjectName = subjectElement.querySelector(".expand")?.textContent?.trim()

          if (subjectName) {
            subjects.push(subjectName)

            const subjectGrades: number[] = []
            const gradeElements = subjectElement.parentElement?.querySelectorAll(
              "ul > li.flag-show > a.c-type237-graded .expand, ul > li.flag-show > a.c-type238-graded .expand"
            )

            gradeElements?.forEach((gradeEl) => {
              const gradeText = gradeEl.textContent?.trim()
              if (gradeText && !Number.isNaN(Number(gradeText))) {
                subjectGrades.push(Number(gradeText))
              }
            })

            grades.push(subjectGrades)
          }
        })
      })

      return { subjects, grades }
    })
  } catch (error) {
    console.error("Error fetching grades:", error)
    return { subjects: [], grades: [] }
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
