# Dream Events Finance V1.7.0 — Reports & Profit Analysis

Adds:
- Event Profitability Portfolio
- Confirmed sales, cash received, estimated cost, current event cost
- Projected profit and projected margin
- Customer outstanding
- Inventory use cost and event labour cost
- Over-budget indicator
- Event search
- Detailed Budget vs Actual analysis
- Main → Sub → Detailed hierarchy
- LKR variance and variance %
- Linked approved expense visibility
- Over / Under / On Budget highlighting
- Unlinked expenses, inventory and labour shown separately

Profit logic:
Projected Event Profit = Confirmed Value - Current Event Cost.

Current Event Cost =
Budget Actual Cost
+ Approved Unlinked Event Expenses
+ Inventory Internal-Use Cost
+ Event Labour Cost.

For each detailed budget line, linked approved expenses take priority.
If there is no linked approved expense, manually entered Actual Qty × Actual Unit Cost is used.

INSTALL — GitHub
Replace/add:
- index.html — replace
- assets/css/reports.css — new
- assets/js/reports.js — new
- apps-script/Code.gs — replace GitHub copy
- apps-script/Reports.gs — new

Keep all existing V1.6.1 files.

INSTALL — Google Apps Script
1. Replace Code.gs.
2. Create Reports.gs.
3. Paste the supplied Reports.gs.
4. Save.
5. Deploy → Manage deployments → Edit → New version.
6. Description: V1.7 reports profit analysis
7. Execute as: Me
8. Who has access: Anyone
9. Deploy.

Do NOT run setupDreamEvents().

TEST
1. Open Reports.
2. Check portfolio totals.
3. Search an event.
4. Click the event row.
5. Compare Budget vs Actual with the event budget and approved expenses.
