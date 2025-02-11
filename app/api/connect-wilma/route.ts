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
    await browser.close();

    return NextResponse.json({ success: true, unreadMessages });
  } catch (error) {
    console.error("Error connecting to Wilma:", error);
    return NextResponse.json(
      { success: false, error: "Failed to connect to Wilma" },
      { status: 500 }
    );
  }
}
