---
name: medium-publication
description: Create and configure a Medium Publication only after an explicit human request and confirmation of its exact identity fields. Do not publish or submit stories.
---

# Medium Publication creation

Use this skill only through the authorized `medium` command when the human explicitly asks to create or configure a
Medium Publication. Publication creation is account administration, separate from article drafting, scheduling,
publishing, or submission. A release target question never authorizes creation.

## Required brief and preflight

1. Verify the signed-in Medium profile matches the selected workflow's `account_profile_url`.
2. Verify the account has an active Medium membership. Medium currently requires membership to create a Publication.
3. Inspect `Settings → Publishing → Manage publications` on the web. Record existing owned Publications and stop if
   the account has reached Medium's current limit of seven owned Publications.
4. Obtain explicit human choices for all required creation fields:
   - exact Publication name;
   - concise description (maximum 280 characters under Medium's current UI); and
   - exact avatar asset, with authorization and provenance.
   Never invent or silently derive these values from an article, profile name, domain, or previous Publication.
5. Before mutation, show the exact name, description, avatar preview/path, expected Medium URL slug if shown, and owner
   account. Ask for confirmation if any field was proposed or transformed rather than supplied verbatim.

## Creation and verification

1. Open `https://medium.com/me/settings/publishing`, choose **Manage publications**, then **Create a new publication**.
2. Enter only the confirmed name and description, upload the confirmed avatar, and continue to the Homepage layout.
3. Do not add editors/writers, a custom domain, newsletter, navigation, sections, background image, subtitle, accent
   color, submission rules, or stories unless the human separately requests the exact change.
4. Click **Create** only for the confirmed identity. Read back the resulting Publication name, URL, owner/editor role,
   avatar, and description. Creation is complete only when the Publication appears in **Manage publications** and its
   homepage/settings open successfully.
5. Record the verified Publication target in the authorized article/archive configuration only when the human asks to
   use it for this workflow. Creating it does not select it for an article and never publishes or submits a story.

If membership, permissions, required fields, avatar upload, URL/identity verification, or final read-back fails, stop
without compensating publication actions and report `BLOCKED_MEDIUM_PUBLICATION_CREATION` with the exact unfinished
step. Never create a second Publication as a retry while the first result is uncertain. Deletion and ownership transfer
are separate destructive operations and require new explicit human requests.
