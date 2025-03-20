import { NextResponse } from "next/server";
import puppeteer, { Page } from "puppeteer";

export async function POST(request: Request) {
  console.log("API route called with request:", request.url);

  let requestBody;
  try {
    requestBody = await request.json();
    console.log("Request body (excluding password):", JSON.stringify({ ...requestBody, wilmaPassword: undefined }, null, 2));
  } catch (error) {
    console.error("Failed to parse request body:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { wilmaUsername, wilmaPassword, step } = requestBody;

  console.log("Credentials check:", {
    hasUsername: !!wilmaUsername,
    hasPassword: !!wilmaPassword,
    step: step || "initial"
  });

  if (!wilmaUsername || !wilmaPassword) {
    console.log("Missing credentials in request");
    return NextResponse.json(
      { success: false, error: "Missing credentials" },
      { status: 400 }
    );
  }

  try {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log("Browser launched successfully");
    
    const page = await browser.newPage();
    console.log("New page created");

    // Common login logic
    console.log("Navigating to Wilma login page...");
    await page.goto("https://yvkoulut.inschool.fi/");
    console.log("Typing username...");
    await page.type("#login-frontdoor", wilmaUsername);
    console.log("Typing password...");
    await page.type("#password", wilmaPassword);
    console.log("Clicking submit button...");
    await page.click('[name="submit"]');
    console.log("Waiting for navigation...");
    await page.waitForNavigation();

    // Verify successful login
    console.log("Verifying login success...");
    const loginSuccess = await page.$("body.somebody");
    if (!loginSuccess) {
      await browser.close();
      console.log("Login failed - no 'body.somebody' element found");
      return NextResponse.json({
        success: false,
        error: "Invalid Wilma credentials",
      });
    }
    console.log("Login successful - 'body.somebody' element found");

    // Handle different steps
    if (step === "unread") {
      console.log("Processing unread messages step");
      const unreadMessages = await getUnreadMessages(page);
      console.log("Unread messages:", unreadMessages);
      await browser.close();
      return NextResponse.json({ success: true, unreadMessages });
    }

    if (step === "grades") {
      console.log("Processing grades step");
      console.log("Navigating to grades page...");
      await page.goto("https://yvkoulut.inschool.fi/choices");
      console.log("Waiting for page to load...");
      await page.waitForSelector("#choices-tree", { timeout: 10000 }).catch(e => {
        console.error("Error waiting for #choices-tree:", e);
        console.log("Current page URL:", page.url());
        console.log("Page content:", page.content());
      });
      
      console.log("Fetching grades data...");
      const { subjects, grades } = await getGradesData(page);
      console.log("Grades data retrieved:", { 
        subjectsCount: subjects.length,
        gradesCount: grades.length
      });
      await browser.close();
      return NextResponse.json({ success: true, subjects, grades });
    }

    if (step === "attendance") {
      console.log("Processing attendance step");
      console.log("Navigating to attendance page...");
      await page.goto("https://yvkoulut.inschool.fi/attendance/view?range=-4");
      console.log("Waiting for attendance table to load...");
      await page.waitForSelector('.datatable.attendance-single', { timeout: 10000 });
      
      console.log("Fetching attendance data...");
      const attendanceData = await getAttendanceData(page);
      console.log("Attendance data retrieved:", attendanceData);
      
      await browser.close();
      return NextResponse.json({ success: true, attendance: attendanceData });
    }

    // Handle initial login without step parameter
    console.log("Processing initial login step");
    await browser.close();
    return NextResponse.json({ 
      success: true,
      message: "Login verified successfully" 
    });

  } catch (error) {
    console.error("Error in API route:", error);
    return NextResponse.json(
      { success: false, error: "Failed to connect to Wilma", details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function getUnreadMessages(page: Page): Promise<number> {
  console.log("Starting getUnreadMessages function");
  try {
    const unreadMessagesElement = await page.$('a[href="/messages"] .badge');
    console.log("Unread messages element found:", !!unreadMessagesElement);
    
    let unreadMessages = 0;
    
    if (unreadMessagesElement) {
      const text = await page.evaluate(
        (el) => el.textContent,
        unreadMessagesElement
      );
      console.log("Raw unread messages text:", text);
      
      if (text) {
        const match = text.match(/(\d+) uutta viestiä/);
        console.log("Regex match for unread messages:", match);
        if (match) unreadMessages = Number.parseInt(match[1], 10);
      }
    }
    
    console.log("Final unread messages count:", unreadMessages);
    return unreadMessages;
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    return 0;
  }
}

async function getGradesData(page: Page): Promise<{ subjects: string[], grades: number[][] }> {
  console.log("Starting getGradesData function");
  try {
    console.log("Waiting for choices-tree selector");
    await page.waitForSelector("#choices-tree", { timeout: 10000 });
    console.log("Clicking show-graded checkbox");
    
    // Check if the checkbox exists
    const checkboxExists = await page.$('#cb-show-graded');
    console.log("Checkbox exists:", !!checkboxExists);
    
    if (checkboxExists) {
      await page.click('#cb-show-graded');
      console.log("Checkbox clicked");
      
      // Take a screenshot for debugging
      await page.screenshot({ path: '/tmp/wilma-grades.png' }).catch(e => {
        console.log("Screenshot failed:", e.message);
      });
      
      console.log("Waiting for grades to load");
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log("WARNING: Checkbox not found");
    }

    console.log("Evaluating page for grades data");
    const result = await page.evaluate(() => {
      console.log("Inside evaluate function");
      const subjects: string[] = [];
      const grades: number[][] = [];

      // Find main category headings
      const mainCategories = document.querySelectorAll(
        "#choices-tree > li.flag-show > ul > li.flag-show > a"
      );
      console.log("Main categories found:", mainCategories.length);

      mainCategories.forEach((categoryElement, index) => {
        console.log(`Processing category ${index + 1}`);
        const subjectElements = categoryElement.parentElement?.querySelectorAll(
          'ul > li.flag-show > a.c-type236-graded'
        );
        console.log(`Found ${subjectElements?.length || 0} subject elements`);

        subjectElements?.forEach((subjectElement, sIndex) => {
          console.log(`Processing subject ${sIndex + 1}`);
          const subjectName = subjectElement.querySelector('.expand')?.textContent?.trim();
          console.log(`Subject name: ${subjectName}`);
          
          if (subjectName) {
            subjects.push(subjectName);

            // Extract grades from both grade types
            const subjectGrades: number[] = [];
            const gradeElements = subjectElement.parentElement?.querySelectorAll(
              'ul > li.flag-show > a.c-type237-graded .expand, ' +
              'ul > li.flag-show > a.c-type238-graded .expand'
            );
            console.log(`Found ${gradeElements?.length || 0} grade elements`);

            gradeElements?.forEach(gradeEl => {
              const gradeText = gradeEl.textContent?.trim();
              console.log(`Grade text: ${gradeText}`);
              if (gradeText && !isNaN(Number(gradeText))) {
                subjectGrades.push(Number(gradeText));
              }
            });

            grades.push(subjectGrades);
          }
        });
      });

      console.log(`Returning data: ${subjects.length} subjects, ${grades.length} grade arrays`);
      return { subjects, grades };
    });

    console.log("Page evaluation complete");
    console.log("Subjects:", result.subjects);
    console.log("Grades:", result.grades);
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
  console.log("Starting getAttendanceData function");
  try {
    await page.waitForSelector('.datatable.attendance-single');
    
    return await page.evaluate(() => {
      const courses: { [key: string]: { [markType: string]: number } } = {};
      const relevantMarks = new Set([
        'Terveydellisiin syihin liittyvä poissaolo',
        'Luvaton poissaolo (selvitetty)',
        'Myöhässä alle 15 min'
      ]);

      document.querySelectorAll('td.event').forEach(element => {
        const title = element.getAttribute('title');
        if (!title) return;

        // Parse course code and mark type from title
        const [coursePart, ...rest] = title.split(';');
        const courseCode = coursePart.trim();
        const markPart = rest.join(';').split('/')[0].trim();

        if (relevantMarks.has(markPart)) {
          if (!courses[courseCode]) {
            courses[courseCode] = {};
          }
          courses[courseCode][markPart] = (courses[courseCode][markPart] || 0) + 1;
        }
      });

      // Convert to array format
      return Object.entries(courses).map(([courseCode, marks]) => ({
        courseCode,
        marks
      }));
    });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    return [];
  }
}