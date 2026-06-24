# GitHub Upload Guide

## Recommended Repository Name

```text
reservation-reminder-automation
```

## Recommended Description

```text
Free Google Sheets and Apps Script reservation reminder automation with privacy checks, backup snapshots, send queue, and weekly reports.
```

## Recommended Topics

```text
google-sheets
google-forms
apps-script
reservation
appointment-reminders
small-business
privacy
no-show
automation
operations
```

## Before Uploading

Check these first:

- No real customer data
- No API keys
- No personal Google account secrets
- No private business names unless intentional
- No screenshots with real phone numbers
- README has a disclaimer
- SECURITY.md has a contact placeholder or real contact

## Upload With GitHub Website

1. Go to GitHub.
2. Click `New repository`.
3. Repository name: `reservation-reminder-automation`.
4. Visibility: `Public`.
5. Do not add README, license, or gitignore because this folder already has them.
6. Create repository.
7. Upload all files from this folder.
8. Commit with message:

```text
Initial public release
```

## Upload With Git CLI

Open a terminal in this folder:

```bash
git init
git add .
git commit -m "Initial public release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/reservation-reminder-automation.git
git push -u origin main
```

## After Uploading

1. Edit repository About section.
2. Add topics.
3. Pin the repository to your profile.
4. Create a first release:

```text
v0.1.0
```

Release title:

```text
Reservation Reminder Automation v0.1.0
```

Release notes:

```text
Initial public release with Google Sheets template, Apps Script automation, setup guide, privacy/security checks, backup snapshots, masked view, and QA test cases.
```

## Suggested README CTA

Add a contact method after you decide how users should reach you:

```text
Need help setting this up?
Contact: your-email@example.com
```

## Important Warning

Never upload a Google Sheet export that contains real customer names, phone numbers, or appointment details.

