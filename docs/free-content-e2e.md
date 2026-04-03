# Free Content for E2E Testing (No Subscription Required)

Research into which streaming platforms offer content with subtitles accessible without paid subscriptions, for E2E testing of the Consistent Subtitle Style extension.

## Summary

| Platform | Free Content? | Login Required? | Subtitles? | E2E Feasible? |
|---|---|---|---|---|
| **Prime Video** | ✅ "Free with Ads" (Freevee) | ⚠️ Free Amazon account | ✅ Yes | ⚠️ Needs free account |
| **Max/HBO** | ✅ Free trailers & extras | ❌ No login needed | ⚠️ Trailers only | ✅ **Best candidate** |
| **Disney+** | ❌ No free content on site | N/A | N/A | ❌ Not feasible |
| **Netflix** | ❌ No free content (discontinued ~2021) | N/A | N/A | ❌ Not feasible |
| **Crunchyroll** | ❌ Free tier ended Dec 2024 | N/A | N/A | ❌ Not feasible |

## Detailed Findings

### 1. Prime Video — ⚠️ Partial (Free Amazon Account Required)

**Status:** Amazon offers "Free with Ads" content (formerly Freevee/IMDb TV). Hundreds of movies and shows available for free with ad interruptions.

**Login requirement:** Requires a **free Amazon account** (not Prime subscription). You need to sign in, but no payment method needed.

**Subtitles:** Full subtitle/CC support on free content, same player as paid content (`atvwebplayersdk-captions-*` selectors).

**E2E approach:**
- Create a test Amazon account (free, no credit card)
- Use content from `amazon.com/gp/video/offers/ref=atv_dp_cnc_svod_0` (free tier)
- Any free movie/show will have the same subtitle DOM as paid content
- Example free content page: `https://www.amazon.com/gp/video/detail/` + ASIN of a free title

**Verdict:** Feasible but requires managing a test account with login automation.

### 2. Max/HBO — ✅ Best Candidate (No Login)

**Status:** Max/HBO offers free trailers and behind-the-scenes extras at:
- **URL:** `https://www.hbomax.com/collections/watch-free`
- Content includes: Succession companion series, The Last of Us journey recap, IT behind-the-scenes, and more

**Login requirement:** **No login needed.** Content plays directly in browser.

**Subtitles:** Trailers/extras use the same player as full episodes. The subtitle DOM (`CaptionWindow`, `TextCue`, `CueBoxContainer`) should be identical.

**E2E approach:**
1. Navigate to `https://www.hbomax.com/collections/watch-free`
2. Click any "WATCH FOR FREE" item
3. Enable subtitles/CC in player
4. Test subtitle styling

**Specific free content found:**
- "Controlling the Narrative: S4 E1" (Succession companion)
- "Ellie's Season 1 Journey" (The Last of Us)
- "Behind the Scenes: Mutant Baby" (IT companion)

**Verdict:** ✅ Best option. No login, real player with real subtitle DOM, multiple free videos.

### 3. Disney+ — ❌ Not Feasible

**Status:** Disney+ does not offer any free content on `disneyplus.com` without a subscription. The website redirects to sign-up page. Trailers for Disney content exist only on YouTube, not on the Disney+ player.

**Note:** Some Disney content is available free on ITVX (UK) and other third-party platforms, but these use different players with different subtitle implementations — not useful for testing Disney+ subtitle selectors.

**Verdict:** ❌ Cannot test without subscription.

### 4. Netflix — ❌ Not Feasible

**Status:** Netflix briefly offered free content without login in 2020 (`netflix.com/watch/free`), but this program was **discontinued**. As of 2026, all Netflix content requires a paid subscription. The site redirects non-logged-in users to the signup page.

**Note:** Netflix Tudum (tudum.com) has editorial content but no video player with Netflix's subtitle system.

**Verdict:** ❌ Cannot test without subscription. No free content available.

### 5. Crunchyroll — ❌ Not Feasible (Free Tier Ended)

**Status:** Crunchyroll's ad-supported free tier (AVOD) **ended in December 2024**. Previously, users could watch select anime for free with ads. Now all content requires a paid subscription.

**Alternative:** Crunchyroll posts free first episodes on their **YouTube channel** (as of March 2026). However, YouTube uses a completely different player — not useful for testing Crunchyroll-specific subtitle selectors (Bitmovin player).

**Cloudflare issue:** Even when free content was available, Crunchyroll's aggressive Cloudflare bot detection blocks headless browsers. Solutions like `puppeteer-extra-plugin-stealth` or `rebrowser-patches` might help, but the point is moot since there's no free content to access anymore.

**Verdict:** ❌ Cannot test. Free tier discontinued, and Cloudflare blocks automation.

## Recommendations

### Immediate (no account needed):
1. **Max/HBO** — Write E2E tests using `hbomax.com/collections/watch-free`. Best option, zero friction.

### With free account:
2. **Prime Video** — Create a free Amazon test account, access "Free with Ads" content. Same subtitle DOM as paid.

### Skip (require paid subscription):
3. **Netflix** — No free content. E2E requires paid account or mocked DOM.
4. **Disney+** — No free content. E2E requires paid account or mocked DOM.  
5. **Crunchyroll** — Free tier ended. E2E requires paid account or mocked DOM.

### Alternative for locked platforms:
For Netflix, Disney+, and Crunchyroll, consider **DOM-mocking E2E tests** — create a local HTML page that replicates the platform's subtitle DOM structure, inject the extension, and verify styling. Not a real E2E test, but validates CSS selector targeting without needing platform access.
