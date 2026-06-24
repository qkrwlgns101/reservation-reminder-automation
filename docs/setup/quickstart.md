# Quickstart

## 1. Create A Google Sheet

1. Download `templates/reservation_reminder_template.xlsx`.
2. Upload it to Google Drive.
3. Open it with Google Sheets.
4. Rename the file for your business.

## 2. Create A Google Form

Use [google_form_blueprint.md](google_form_blueprint.md).

Minimum questions:

- Name
- Phone number
- Appointment date
- Appointment time
- Appointment item
- Consent checkbox

Do not ask for diagnosis details, disease names, resident registration numbers, or payment data.

## 3. Connect Form Responses

Connect Google Form responses to the Google Sheet.

Recommended approach:

- Keep raw form responses in `Form_Responses`
- Use `Appointments` as the clean operation table

## 4. Install Apps Script

1. Open Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Paste `apps-script/reservation_reminder_demo.gs`.
4. Save.
5. Reload the Google Sheet.

## 5. Run Checks

Run these menu items:

```text
예약 자동화 > 사전 점검 실행
예약 자동화 > 보안 점검 실행
예약 자동화 > 백업 스냅샷 생성
예약 자동화 > 마스킹 뷰 생성
예약 자동화 > 발송 대기함 갱신
예약 자동화 > 주간 리포트 갱신
```

## 6. Staff Workflow

Daily:

1. Open Dashboard.
2. Check today's reservations.
3. Open Send_Queue.
4. Review message text.
5. Send manually by SMS/Kakao/email.
6. Mark sent rows as sent.
7. Update appointment status after visit.

Weekly:

1. Open Weekly_Report.
2. Check reservation count, cancellations, and no-shows.
3. Review `Validation_Errors`.
4. Review `Security_Audit`.

