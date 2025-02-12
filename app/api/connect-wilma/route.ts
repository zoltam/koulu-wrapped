import { NextResponse } from "next/server";
import puppeteer, { Page } from "puppeteer";

export async function POST(request: Request) {
  const { wilmaUsername, wilmaPassword, step } = await request.json();

  if (!wilmaUsername || !wilmaPassword) {
    return NextResponse.json(
      { success: false, error: "Missing credentials" },
      { status: 400 }
    );
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

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
      console.log("Login failed");
      return NextResponse.json({
        success: false,
        error: "Invalid Wilma credentials",
      });
    }
    console.log("Login successful.");

    // Handle different steps
    if (step === "unread") {
      const unreadMessages = await getUnreadMessages(page);
      console.log("Unread messages:", unreadMessages);
      await browser.close();
      return NextResponse.json({ success: true, unreadMessages });
    }

    if (step === "grades") {
      console.log("Navigating to grades page...");
      await page.goto("https://yvkoulut.inschool.fi/choices");
      const { subjects, grades } = await getGradesData(page);
      await browser.close();
      return NextResponse.json({ success: true, subjects, grades });
    }

    // Handle initial login without step parameter
    await browser.close();
    return NextResponse.json({ 
      success: true,
      message: "Login verified successfully" 
    });

  } catch (error) {
    console.error("Error in API route:", error);
    return NextResponse.json(
      { success: false, error: "Failed to connect to Wilma" },
      { status: 500 }
    );
  }
}

async function getUnreadMessages(page: Page): Promise<number> {
  try {
    const unreadMessagesElement = await page.$('a[href="/messages"] .badge');
    let unreadMessages = 0;
    
    if (unreadMessagesElement) {
      const text = await page.evaluate(
        (el) => el.textContent,
        unreadMessagesElement
      );
      if (text) {
        const match = text.match(/(\d+) uutta viestiä/);
        if (match) unreadMessages = Number.parseInt(match[1], 10);
      }
    }
    
    return unreadMessages;
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    return 0;
  }
}

async function getGradesData(page: Page): Promise<{ subjects: string[], grades: number[][] }> {
  try {
    await page.waitForSelector("#choices-tree");
    await page.click('#cb-show-graded');
    await new Promise(resolve => setTimeout(resolve, 2000));

    return await page.evaluate(() => {
      const subjects: string[] = [];
      const grades: number[][] = [];

      // Find main category headings
      const mainCategories = document.querySelectorAll(
        "#choices-tree > li.flag-show > ul > li.flag-show > a"
      );

      mainCategories.forEach((categoryElement) => {
        const subjectElements = categoryElement.parentElement?.querySelectorAll(
          'ul > li.flag-show > a.c-type236-graded'
        );

        subjectElements?.forEach((subjectElement) => {
          const subjectName = subjectElement.querySelector('.expand')?.textContent?.trim();
          if (subjectName) {
            subjects.push(subjectName);

            // Extract grades from both grade types
            const subjectGrades: number[] = [];
            const gradeElements = subjectElement.parentElement?.querySelectorAll(
              'ul > li.flag-show > a.c-type237-graded .expand, ' +
              'ul > li.flag-show > a.c-type238-graded .expand'
            );

            gradeElements?.forEach(gradeEl => {
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

  } catch (error) {
    console.error("Error fetching grades:", error);
    return { subjects: [], grades: [] };
  }
}