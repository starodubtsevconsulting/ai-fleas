# Medium desktop navigation map

Use these landmarks to orient on Medium's current desktop site. Read the page that is actually open before acting;
responsive layout, labels, and placement can change. Semantic controls, visible text, and a fresh screenshot or
accessibility view are more reliable than fixed screen coordinates. This map supplies navigation, not scheduling
authority; the [schedule skill](../SKILL.md) owns the gates and final action.

| Goal | Where to look | What to do and verify |
| --- | --- | --- |
| Confirm the account | Profile image or user menu, commonly near the upper right; the sidebar may also show Profile. | Open the profile link if needed and compare its URL with the active workflow's `account_profile_url`. Do not infer the account from the displayed name alone. |
| Find the article | Start with the exact Medium draft URL in the article archive. If unavailable, open **Stories** from the sidebar or profile menu; `https://medium.com/me/stories` is Medium's account story list. On a narrow layout, first open the sidebar menu. | Select **Drafts** and find the article by title and other archive evidence. Open the exact draft and check its URL and content revision. Do not take the first row merely because it looks recent. |
| Check existing releases | On **Stories**, look for **Scheduled** and **Published** beside **Drafts**. | Inspect the account's upcoming and past stories to reconcile the queue and daily cap with archive records. The active tab and row status matter more than their position. |
| Enter scheduling | In the intended unpublished draft editor, look for **Publish** near the upper right. | Open its publish dialog. This is an entry to the dialog; inspect the resulting choices before any final action. If the story is already published or the wrong draft opened, stop. |
| Choose a future slot | In the publish dialog, find **Schedule for later** and the date and time fields. | Translate the configured release time zone to the local time shown by Medium. Read the entered date and time back from the live dialog. Avoid **Publish now** and publication submission controls. |
| Complete and verify | In the scheduling state, find **Schedule to publish**. Then return to the story state or **Stories → Scheduled**. | Select the final scheduling control once when the article acceptance and slot checks pass. Verify the exact story, scheduled status, and date/time on Medium; preserve the URL and archive record. If the result is unclear, inspect the Scheduled list before retrying. |

Medium's help documents the [Stories page and Drafts tab](https://help.medium.com/hc/en-us/articles/214874698-Create-edit-or-delete-a-story)
and the [Publish → Schedule for later → Schedule to publish](https://help.medium.com/hc/en-us/articles/216650227-Schedule-to-publish)
path. Current account observations showed the Stories page with Drafts, Scheduled, and Published tabs; recheck those
landmarks on each run. Medium uses the local time shown in its scheduling UI and may publish edits made before the
scheduled time, so compare the accepted revision again before pressing the final scheduling control.
