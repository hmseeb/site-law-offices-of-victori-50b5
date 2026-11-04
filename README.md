# Law Offices of Victoria Clemans — website

Static, five-page marketing site for the Law Offices of Victoria Clemans
(criminal defense, trial advocacy and conflict resolution — Santa Monica, CA).

Built with vanilla HTML, CSS and JavaScript. No build step: serve the directory
as-is, with `index.html` as the entry point.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Hero + primary call to action, practice areas, process, Google reviews, FAQ, case review form |
| `services.html` | Practice areas in detail |
| `reviews.html` | Google reviews (5.0 from 12 reviews) |
| `faq.html` | Frequently asked questions |
| `contact.html` | Contact details and the case review form |
| `404.html` | Not-found page |

## Structure

```
index.html, services.html, reviews.html, faq.html, contact.html, 404.html
favicon.svg, robots.txt, sitemap.xml
assets/css/styles.css   — single stylesheet, mobile first
assets/js/main.js       — mobile nav, form handling, scroll reveal (progressive enhancement)
```

## Contact details used on the site

- Phone (primary call to action, `tel:` everywhere): (310) 488-6357
- Email: vclemansesquire@gmail.com
- Office: 401 Wilshire Blvd PH, Santa Monica, CA 90401
- Google Business Profile: https://maps.google.com/?cid=6319697230949345026

## Forms

Both forms (home page "Case review", contact page "Contact") POST to the
LeadrVision endpoint:

```
https://vision.leadrai.com/api/forms/91fd01ec81f92a32155959cca7aadbf9
```

Each form includes a `_form` name, a `_page` field populated with
`window.location.href` on load, and a hidden `_gotcha` honeypot. `main.js`
submits via `fetch()` and shows an inline confirmation on `{"ok": true}`; if
JavaScript is unavailable or the request fails, the browser performs a plain
POST and the visitor returns with `?submitted=1`, which also renders the
confirmation.

### GoHighLevel sync

Alongside the LeadrVision submission, `main.js` posts the same payload to
`api/ghl-contact.js`, which creates or updates the contact in the GoHighLevel
sub-account (location `zWrqTLGrbnMMy9BmMcwK`) with first name, last name,
phone, email and the message, sets the custom fields `Lead Source` to
`Website` and `Website Form` to the form name, and adds the tag
`website-lead`. The message — plus any extra answers such as "Type of matter"
— is also written as a note on the contact.

The API token is server-side only: set `GHL_API_TOKEN` in the hosting
environment (a Private Integration token for that sub-account, with contact
read/write and custom-field read scopes). `GHL_LOCATION_ID` can override the
location id. If the token is missing, the endpoint returns `503` and the
visitor's form submission is unaffected.

## Notes

- All review text, the 5.0/12 rating and the contact details come from the
  firm's Google Business Profile. Nothing on the site is invented — no claimed
  years in business, awards, or guaranteed outcomes.
- No photographs are used; the design relies on typography, colour and layout.
- Accessibility: one `<h1>` per page, semantic landmarks, visible focus states,
  44px+ tap targets, and `prefers-reduced-motion` support.
