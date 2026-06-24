# Security Policy

## Supported Use

This project is designed for reservation operations with minimal personal information:

- Name
- Phone number
- Appointment date
- Appointment time
- Appointment item
- Consent status

Do not use this project to store medical records, diagnosis details, resident registration numbers, card numbers, passwords, or other sensitive data.

## Before Using Real Data

Before using this project with real customers:

1. Review your privacy notice.
2. Turn off public link sharing.
3. Share the original Google Sheet only with necessary staff.
4. Enable two-step verification for important Google accounts.
5. Run `예약 자동화 > 보안 점검 실행`.
6. Run `예약 자동화 > 보호 설정 적용`.
7. Use `Masked_View` for external sharing.
8. Create a backup snapshot before bulk edits.

## Reporting Security Issues

If you find a security issue:

1. Do not post real personal information in public issues.
2. Describe the issue with sample or fake data.
3. Include reproduction steps.
4. Mention the affected file or Apps Script function.

If this repository becomes public, add a private contact email here:

```text
Security contact: TODO@example.com
```

## Known Limitations

- Google Sheets permissions are controlled by the file owner and Google Workspace settings.
- Apps Script checks cannot replace an organizational privacy/security review.
- Masking views reduce exposure but do not anonymize the original file.
- Backup sheets may still contain personal data and must be managed carefully.

## Security References

See [docs/security/security_references.md](docs/security/security_references.md).

