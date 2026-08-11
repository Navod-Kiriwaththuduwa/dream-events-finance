Dream Events Finance V1.8.3 — Mobile Responsiveness

Frontend-only update.

Fixes:
- Restores + Expense on mobile; both + Expense and + Income are visible.
- Prevents long event/page titles from overflowing out of the top header.
- Long top titles use a safe one-line ellipsis.
- Improves event card spacing and text wrapping.
- Improves event-detail headings and buttons.
- Makes event tabs swipe horizontally cleanly.
- Improves budget sections on small screens.
- Makes forms and modal dialogs fit phones better.
- Keeps modal headers visible while scrolling.
- Makes Save/Cancel buttons full-width on mobile.
- Uses 16px mobile form inputs to reduce browser auto-zoom.
- Keeps wide tables horizontally scrollable instead of breaking the page.
- Improves toast/message width.
- Adds extra tuning for <=390px phones.

INSTALL — GITHUB ONLY
1. Replace index.html
2. Add assets/css/mobile-responsive.css
3. Commit: V1.8.3 improve mobile responsiveness
4. Wait for GitHub Pages to update.
5. Refresh on the phone. If necessary, clear site cache/reload.

NO Google Apps Script change.
NO Apps Script redeployment.
DO NOT run setupDreamEvents().
