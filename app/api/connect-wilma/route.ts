import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function POST(request: Request) {
  console.log("POST /api/connect-wilma initiated");

  const { wilmaUsername, wilmaPassword } = await request.json();
  console.log("Received Wilma credentials:", { wilmaUsername });

  if (!wilmaUsername || !wilmaPassword) {
    console.log("Missing credentials");
    return NextResponse.json(
      { success: false, error: "Missing credentials" },
      { status: 400 }
    );
  }

  try {
    console.log("Launching Puppeteer browser");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    console.log("Puppeteer browser launched, new page created");

    // Navigate to the Wilma login page
    await page.goto("https://yvkoulut.inschool.fi/");
    console.log("Navigated to Wilma login page");

    // Fill out the login form
    await page.type("#login-frontdoor", wilmaUsername);
    console.log("Entered Wilma username");
    await page.type("#password", wilmaPassword);
    console.log("Entered Wilma password");
    await page.click('[name="submit"]');
    console.log("Submitted login form");

    // Wait for navigation to complete
    await page.waitForNavigation();
    console.log("Navigation after login completed");

    // Check for successful login by verifying the presence of a known element on the post-login page
    const loginSuccess = await page.$("body.somebody");
    console.log("Current page url:", page.url());

    if (!loginSuccess) {
      await browser.close();
      console.log("Wilma credentials invalid");
      return NextResponse.json({
        success: false,
        error: "Invalid Wilma credentials",
      });
    }

    console.log("Wilma login successful");

    // Scrape the unread messages count
    const unreadMessagesElement = await page.$('a[href="/messages"] .badge');
    let unreadMessages = 0;
    if (unreadMessagesElement) {
      const text = await page.evaluate(
        (el) => el.textContent,
        unreadMessagesElement
      );
      if (text) {
        const match = text.match(/(\d+) uutta viestiä/);
        if (match) {
          unreadMessages = Number.parseInt(match[1], 10);
        }
      }
    }

    console.log("Scraped unread messages:", unreadMessages);

    // Navigate to the grades page (replace with the correct URL)
    await page.goto("https://yvkoulut.inschool.fi/choices");
    console.log("Navigated to grades page");

    // Wait for the grades table to load
    await page.waitForSelector("#choices-tree");
    console.log("Grades table loaded");
    await page.click('#cb-show-graded');
    
    // Wait for grades to load after clicking the checkbox
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Adjust timeout as needed

    // Scrape course names and grades

    const { subjects, grades } = await page.evaluate(() => {
      const subjects: string[] = [];
      const grades: number[][] = [];
    
      // Find main category headings
      const mainCategories = document.querySelectorAll(
        "#choices-tree > li.flag-show > ul > li.flag-show > a"
      );
    
      mainCategories.forEach((categoryElement) => {
        const categoryName = categoryElement.querySelector('.expand')?.textContent?.trim();
        if (!categoryName) return;
    
        // Find the subject-level elements within each category
        const subjectElements = categoryElement.parentElement?.querySelectorAll(
          'ul > li.flag-show > a.c-type236-graded'
        );
    
        subjectElements?.forEach((subjectElement) => {
          const subjectName = subjectElement.querySelector('.expand')?.textContent?.trim();
          if (subjectName) {
            subjects.push(subjectName);
    
            // Extract grades from both c-type237-graded and c-type238-graded
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


    // Add formatted printing
    console.log("\nFormatted Results:");
    subjects.forEach((subject, index) => {
      console.log(`Subject: ${subject}`);
      console.log(`Grades: [${grades[index].join(", ")}]`);
      console.log("-------------------");
    });

    await browser.close();

    return NextResponse.json({
      success: true,
      unreadMessages,
      subjects,
      grades,
    });
  } catch (error) {
    console.error("Error connecting to Wilma:", error);
    return NextResponse.json(
      { success: false, error: "Failed to connect to Wilma" },
      { status: 500 }
    );
  }
}