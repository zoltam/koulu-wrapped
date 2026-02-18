import { NextResponse } from "next/server";
import puppeteer, { Page } from "puppeteer";

export async function POST(request: Request) {
  const requestId = `wilma-${Date.now().toString(36)}`;
  const startedAt = Date.now();
  let requestBody;

  try {
    requestBody = await request.json();
  } catch (error) {
    console.error(`[${requestId}] Invalid request body`, error);
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { wilmaUsername, wilmaPassword, step } = requestBody;
  const mode = step || "all";

  if (!wilmaUsername || !wilmaPassword) {
    console.error(`[${requestId}] Missing credentials`);
    return NextResponse.json(
      { success: false, error: "Missing credentials" },
      { status: 400 }
    );
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    console.log(`[${requestId}] Starting ${mode} scrape`);
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://yvkoulut.inschool.fi/", { waitUntil: "domcontentloaded" });
    await page.type("#login-frontdoor", wilmaUsername);
    await page.type("#password", wilmaPassword);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      page.click('[name="submit"]'),
    ]);

    const loginSuccess = await page.$("body.somebody");
    if (!loginSuccess) {
      console.warn(`[${requestId}] Login failed`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Wilma credentials",
        },
        { status: 401 }
      );
    }

    if (mode === "unread") {
      const unreadMessages = await getUnreadMessages(page);
      return NextResponse.json({ success: true, unreadMessages });
    }

    if (mode === "grades") {
      await page.goto("https://yvkoulut.inschool.fi/choices", { waitUntil: "domcontentloaded" });
      const { subjects, grades } = await getGradesData(page);
      return NextResponse.json({ success: true, subjects, grades });
    }

    if (mode === "attendance") {
      await page.goto("https://yvkoulut.inschool.fi/attendance/view?range=-4", {
        waitUntil: "domcontentloaded",
      });
      const attendance = await getAttendanceData(page);
      return NextResponse.json({ success: true, attendance });
    }

    const unreadMessages = await getUnreadMessages(page);

    await page.goto("https://yvkoulut.inschool.fi/choices", { waitUntil: "domcontentloaded" });
    const { subjects, grades } = await getGradesData(page);

    await page.goto("https://yvkoulut.inschool.fi/attendance/view?range=-4", {
      waitUntil: "domcontentloaded",
    });
    const attendance = await getAttendanceData(page);

    return NextResponse.json({
      success: true,
      unreadMessages,
      subjects,
      grades,
      attendance,
    });
  } catch (error) {
    console.error(`[${requestId}] Failed scrape`, error);
    return NextResponse.json(
      { success: false, error: "Failed to connect to Wilma", details: (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
    const durationMs = Date.now() - startedAt;
    console.log(`[${requestId}] Finished ${mode} scrape in ${durationMs}ms`);
  }
}

async function getUnreadMessages(page: Page): Promise<number> {
  try {
    const unreadMessagesElement = await page.$('a[href="/messages"] .badge');
    let unreadMessages = 0;

    if (unreadMessagesElement) {
      const text = await page.evaluate((el) => el.textContent, unreadMessagesElement);
      if (text) {
        const match = text.match(/(\d+)/);
        if (match) unreadMessages = Number.parseInt(match[1], 10);
      }
    }

    return unreadMessages;
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    return 0;
  }
}

async function getGradesData(page: Page): Promise<{ subjects: string[]; grades: number[][] }> {
  try {
    await page.waitForSelector("#choices-tree", { timeout: 10000 });

    const checkboxExists = await page.$("#cb-show-graded");
    if (checkboxExists) {
      await page.click("#cb-show-graded");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const result = await page.evaluate(() => {
      const subjects: string[] = [];
      const grades: number[][] = [];

      const mainCategories = document.querySelectorAll(
        "#choices-tree > li.flag-show > ul > li.flag-show > a"
      );

      mainCategories.forEach((categoryElement) => {
        const subjectElements = categoryElement.parentElement?.querySelectorAll(
          "ul > li.flag-show > a.c-type236-graded"
        );

        subjectElements?.forEach((subjectElement) => {
          const subjectName = subjectElement.querySelector(".expand")?.textContent?.trim();

          if (subjectName) {
            subjects.push(subjectName);

            const subjectGrades: number[] = [];
            const gradeElements = subjectElement.parentElement?.querySelectorAll(
              "ul > li.flag-show > a.c-type237-graded .expand, " +
                "ul > li.flag-show > a.c-type238-graded .expand"
            );

            gradeElements?.forEach((gradeEl) => {
              const gradeText = gradeEl.textContent?.trim();
              if (gradeText && !isNaN(Number(gradeText))) {
                subjectGrades.push(Number(gradeText));
              }
            });

            grades.push(subjectGrades);
          }
        });
      });

      return { subjects, grades };
    });

    return result;
  } catch (error) {
    console.error("Error fetching grades:", error);
    return { subjects: [], grades: [] };
  }
}

interface AttendanceData {
  courseCode: string;
  marks: {
    [key: string]: number;
  };
}

async function getAttendanceData(page: Page): Promise<AttendanceData[]> {
  try {
    await page.waitForSelector(".datatable.attendance-single");

    return await page.evaluate(() => {
      const courses: { [key: string]: { [markType: string]: number } } = {};
      const relevantMarks = new Set([
        "Terveydellisiin syihin liittyvä poissaolo",
        "Luvaton poissaolo (selvitetty)",
        "Myöhässä alle 15 min",
      ]);

      document.querySelectorAll("td.event").forEach((element) => {
        const title = element.getAttribute("title");
        if (!title) return;

        const [coursePart, ...rest] = title.split(";");
        const courseCode = coursePart.trim();
        const markPart = rest.join(";").split("/")[0].trim();

        if (relevantMarks.has(markPart)) {
          if (!courses[courseCode]) {
            courses[courseCode] = {};
          }
          courses[courseCode][markPart] = (courses[courseCode][markPart] || 0) + 1;
        }
      });

      return Object.entries(courses).map(([courseCode, marks]) => ({
        courseCode,
        marks,
      }));
    });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    return [];
  }
}

