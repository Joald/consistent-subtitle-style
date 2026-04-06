/**
 * Per-platform documentation: implementation approach, supported features,
 * known limitations, and workarounds for each streaming platform.
 *
 * Rendered in the popup's help panel when the user clicks the ℹ️ icon
 * on the platform indicator banner.
 */

export interface PlatformDoc {
  /** Platform display name */
  name: string;
  /** How the extension applies styles on this platform */
  approach: string;
  /** Supported settings (✅) */
  supported: string[];
  /** Known limitations and workarounds */
  limitations: string[];
  /** Additional notes */
  notes?: string;
}

export const PLATFORM_DOCS: Record<string, PlatformDoc> = {
  youtube: {
    name: 'YouTube',
    approach:
      "Uses YouTube's native caption settings API via the embedded player. " +
      "Settings are applied through the player's setCaptionStyle() method for " +
      'font color, background, window, font family, font size, and edge style. ' +
      'Font opacity uses CSS color-mix() on the subtitle container.',
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      'Font opacity uses CSS color-mix rather than the native API, since YouTube does not expose a separate text opacity control.',
    ],
  },

  nebula: {
    name: 'Nebula',
    approach:
      'CSS injection targeting Video.js caption elements. Styles are applied ' +
      'via CSS custom properties and direct selectors on .vjs-text-track-cue elements. ' +
      'Supports live setting updates via the subtitleStylerChanged message.',
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      'Font size uses CSS transform: scale() rather than direct font-size changes, since percentage-based font-size is relative to the parent container.',
    ],
  },

  dropout: {
    name: 'Dropout',
    approach:
      'Bridges into the VHX/Vimeo OTT embedded player iframe. Uses a combination ' +
      'of the Vimeo Player API (setCaptionStyle), localStorage sync, and direct ' +
      'inline style manipulation on caption elements. A MutationObserver watches for ' +
      'new caption DOM elements (created on subtitle cue changes) and re-applies styles.',
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      'The Dropout player is embedded in an iframe; style application relies on postMessage bridge and direct DOM manipulation inside the iframe.',
      'New subtitle cues create fresh DOM elements — the MutationObserver handles re-applying styles, but there may be a brief flash of unstyled content.',
    ],
    notes:
      'Dropout uses the same Vimeo OTT player technology as regular Vimeo, ' +
      'but the embedding context and caption renderer differ.',
  },

  primevideo: {
    name: 'Prime Video',
    approach:
      "CSS-only injection targeting Amazon's atvwebplayersdk caption elements. " +
      'Styles are applied via CSS selectors on the subtitle container and individual ' +
      'caption spans. Covers 11 regional Amazon domains (amazon.com, .co.uk, .de, etc.).',
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      "CSS-only approach — no access to Prime Video's native caption API.",
      'Font size uses transform: scale() to work around CSS font-size percentage inheritance.',
    ],
  },

  max: {
    name: 'Max (HBO)',
    approach:
      "CSS-only injection targeting HBO Max's CaptionWindow, TextCue, and " +
      'CueBoxContainer elements. Works on both max.com and legacy hbomax.com domains.',
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      'CSS-only approach — no access to the native caption API.',
      'Font size uses transform: scale() to work around CSS font-size percentage inheritance.',
    ],
  },

  crunchyroll: {
    name: 'Crunchyroll',
    approach:
      "CSS-only injection targeting Bitmovin player's subtitle elements " +
      '(bmpui-ui-subtitle-label and bmpui-ui-subtitle-overlay).',
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      "CSS-only approach — no access to Crunchyroll's native caption settings.",
      'Font size uses transform: scale() to work around CSS font-size percentage inheritance.',
    ],
  },

  disneyplus: {
    name: 'Disney+',
    approach:
      'CSS injection into a Shadow DOM inside the <disney-web-player> custom element. ' +
      'Targets both dss-subtitle-renderer-cue and hive-subtitle-renderer-cue elements ' +
      "to handle Disney's dual renderer architecture.",
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      'Requires Shadow DOM penetration — the extension injects a <style> element into the shadow root.',
      'Disney+ uses two different subtitle renderers; both must be targeted.',
      'Font size uses transform: scale() to work around CSS font-size percentage inheritance.',
    ],
  },

  netflix: {
    name: 'Netflix',
    approach:
      "CSS injection targeting the Cadmium player's player-timedtext-text-container " +
      'and player-timedtext elements. Netflix does not expose a public caption API.',
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      'CSS-only approach — Netflix does not have a public caption styling API.',
      "Netflix's own subtitle settings (in profile preferences) may conflict; our CSS uses !important to override.",
      'Font size uses transform: scale() to work around CSS font-size percentage inheritance.',
    ],
  },

  vimeo: {
    name: 'Vimeo',
    approach:
      'CSS injection targeting the vp-captions container on vimeo.com and ' +
      'player.vimeo.com embeds.',
    supported: [
      'Font color',
      'Font opacity',
      'Font family',
      'Font size',
      'Background color',
      'Background opacity',
      'Window color',
      'Window opacity',
      'Character edge style',
    ],
    limitations: [
      'CSS-only approach on standard Vimeo (as opposed to Dropout/VHX which uses the player API).',
      'Font size uses transform: scale() to work around CSS font-size percentage inheritance.',
    ],
  },
};

/**
 * Get documentation for a specific platform.
 * Returns undefined if the platform is not documented.
 */
export function getPlatformDoc(platform: string): PlatformDoc | undefined {
  return PLATFORM_DOCS[platform];
}

/**
 * Get a list of all documented platforms.
 */
export function getDocumentedPlatforms(): string[] {
  return Object.keys(PLATFORM_DOCS);
}
