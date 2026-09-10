import { test, expect } from "@playwright/test";
import { GoogleCourseSearchPage } from "../pages/googleCourseSearchPage";
import { googleCourseConstants } from "../constants/googleCourseConstants";

test.describe.serial("Google Python Course Search and Fee Validation", () => {
    test("Find the latest available Python course and verify its fee", async ({ page, context }) => {
        test.info().annotations.push({ type: "TestCase", description: "Latest Python course fee" });
        const googleCourse = new GoogleCourseSearchPage(page, context);

        // 1. Open Google and handle only a required consent or regional prompt.
        await googleCourse.openGoogle();
        await expect(googleCourse.searchBox).toBeVisible();

        // 2. Search for latest Python course with fees.
        await googleCourse.searchForLatestPythonCourse();
        await googleCourse.assertSearchPage();
        if (googleCourse.isBlocked()) {
            await expect(page.locator("body")).toContainText(googleCourseConstants.blockedContentPattern);
            test.skip(true, "Google returned an anti-automation challenge.");
        }

        // 3. Inspect results and recency signals.
        const result = googleCourse.relevantResult();
        await expect(result).toBeVisible();
        await expect(result).toContainText(/python|course|learn/i);

        // 4. Open a relevant current Python course result.
        await googleCourse.openRelevantResult();
        await expect(page).not.toHaveURL(/google\.[^/]+\/search/);
        await expect(page.locator("body")).toContainText(/python/i);

        // 5. Capture the exact fee, currency, billing period, and pricing qualifications.
        const courseText = await googleCourse.pageText();
        expect(courseText).toMatch(googleCourseConstants.feeContentPattern);

        // 6. Treat the course page as the source of truth for fees.
        expect(page.url()).not.toMatch(/google\.[^/]+\/search/);
    });
});
