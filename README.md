# Reservation Reminder Automation

Google Forms, Google Sheets, and Apps Script based reservation reminder automation template.

This project helps small appointment-based businesses manage reservations, reminder messages, no-show follow-ups, weekly reports, backup snapshots, and basic privacy/security checks without building a full SaaS product.

Korean project name:

> 예약 누락 방지 자동화 패키지

## What This Does

- Collect reservations with Google Forms
- Manage reservations in Google Sheets
- Generate confirmation, day-before, same-day, no-show, and review request messages
- Show a send queue for staff approval
- Track reservation status: reserved, changed, completed, cancelled, no-show, pending
- Generate weekly reservation reports
- Create backup snapshots before risky edits
- Run validation checks for broken or duplicated data
- Run privacy/security checks for sensitive information risks
- Create a masked view for safer external sharing

## Who Can Use It

This template is useful for:

- Clinics and dental offices
- Beauty salons and nail shops
- Academies and tutoring centers
- PT studios and pilates studios
- Photo studios
- Repair shops
- Consulting offices
- Any small business that manages appointments manually

## Important Privacy Notice

This project handles personal information such as names, phone numbers, and appointment dates.

Do not collect:

- Medical diagnosis details
- Disease names
- Test results
- Resident registration numbers
- Card numbers
- Bank account numbers
- Passwords or authentication codes

Use this project only after reviewing your local privacy laws, internal policy, and Google Workspace sharing settings.

Start here:

- [Security and privacy plan](docs/security/security_privacy_plan.md)
- [Privacy notice template](docs/security/privacy_notice_template.md)
- [Security checklist](docs/security/security_checklist.md)
- [Security references](docs/security/security_references.md)

## Free Version

The free version includes:

- Google Sheets workbook template
- Apps Script automation code
- Google Form setup guide
- Validation and security check menus
- Backup and recovery guide
- QA test cases

## Paid Services You Can Offer

You can make this project free for everyone and earn revenue from services around it.

Recommended paid services:

- Setup service
- Industry-specific customization
- Privacy/security setup
- Staff training
- Monthly maintenance
- Monthly report generation
- SMS or Kakao notification integration
- Google Workspace sharing and permission review

See:

- [Monetization model](docs/monetization_model.md)
- [Business kit](business-kit/)

## Repository Structure

```text
apps-script/
  reservation_reminder_demo.gs

templates/
  reservation_reminder_template.xlsx

docs/
  setup/
  security/
  mvp_spec.md
  qa_test_cases.md
  risk_recovery_plan.md
  monetization_model.md
  github_upload_guide.md

business-kit/
  one_page_proposal.md
  pricing_scope.md
  sales_messages.md
  customer_discovery_checklist.md
  demo_script.md
  pilot_launch_next_steps.md
```

## Quick Start

1. Download `templates/reservation_reminder_template.xlsx`.
2. Upload it to Google Drive.
3. Open it with Google Sheets.
4. Create a Google Form using [Google Form blueprint](docs/setup/google_form_blueprint.md).
5. Connect the form responses to your Google Sheet.
6. Open `Extensions > Apps Script`.
7. Copy and paste `apps-script/reservation_reminder_demo.gs`.
8. Save and reload the Google Sheet.
9. Run these menu items:
   - `예약 자동화 > 사전 점검 실행`
   - `예약 자동화 > 보안 점검 실행`
   - `예약 자동화 > 백업 스냅샷 생성`
   - `예약 자동화 > 마스킹 뷰 생성`
   - `예약 자동화 > 발송 대기함 갱신`
   - `예약 자동화 > 주간 리포트 갱신`

## Apps Script Menu

After installation, the `예약 자동화` menu adds:

- `사전 점검 실행`: validates required sheets, headers, duplicated appointment IDs, dates, statuses, and consent values
- `보안 점검 실행`: checks sharing status, suspected sensitive data, suspicious phone formats, and retention issues
- `보호 설정 적용`: applies warning protections to key sheets and personal-data ranges
- `마스킹 뷰 생성`: creates a masked view with hidden names and phone numbers
- `백업 스냅샷 생성`: creates hidden backup copies of key sheets
- `발송 대기함 갱신`: generates send queue rows
- `주간 리포트 갱신`: refreshes weekly metrics
- `선택 행 발송완료 처리`: marks selected send queue rows as sent
- `매일 오전 트리거 설치`: installs a daily automation trigger

## Suggested Public Positioning

Use this as a free open-source template:

> Free Google Sheets reservation reminder automation for small appointment-based businesses.

Use paid services for:

> Setup, customization, privacy-safe operation, and monthly maintenance.

## License

MIT License. See [LICENSE](LICENSE).

## Disclaimer

This project is not legal, medical, accounting, or security advice. You are responsible for reviewing privacy, security, and regulatory requirements before using this with real customer data.

