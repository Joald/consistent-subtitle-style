import type { StorageSettings, PlatformConfig, SettingApplicationReport } from '../types/index.js';

// ── Value Maps ──────────────────────────────────────────────────────────────

const COLOR_HEX_MAP: Record<string, string> = {
  white: '#fff',
  yellow: '#ff0',
  green: '#0f0',
  cyan: '#0ff',
  blue: '#00f',
  magenta: '#f0f',
  red: '#f00',
  black: '#000',
};

// The Vimeo OTT player accepts different color representations depending on the
// property being set:
//   `color`       (font color)   → expects a hex string, e.g. '#fff'
//   `bgColor`     (background)   → expects a color name, e.g. 'white'
//   `windowColor` (window bg)    → expects a hex string, e.g. '#fff'
// Hence we maintain both maps and use the appropriate one per setting.
const COLOR_NAME_MAP: Record<string, string> = {
  white: 'white',
  yellow: 'yellow',
  green: 'green',
  cyan: 'cyan',
  blue: 'blue',
  magenta: 'magenta',
  red: 'red',
  black: 'black',
};

const REVERSE_COLOR_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COLOR_HEX_MAP).map(([k, v]) => [v, k]),
);

// Opacity values are passed to the Vimeo player as percentage strings ('0'–'100').
// The player maps these to its own internal 0.0–1.0 scale.
const TEXT_OPACITY_MAP: Record<string, string> = {
  '0': '0',
  '25': '25',
  '50': '50',
  '75': '75',
  '100': '100',
};

const BG_OPACITY_MAP: Record<string, string> = {
  '0': '0',
  '25': '25',
  '50': '50',
  '75': '75',
  '100': '100',
};

const EDGE_STYLE_MAP: Record<string, string> = {
  none: 'none',
  dropshadow: 'shadow',
  raised: 'raised',
  depressed: 'depressed',
  outline: 'uniform',
};

const REVERSE_EDGE_STYLE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(EDGE_STYLE_MAP).map(([k, v]) => [v, k]),
);

const FONT_FAMILY_MAP: Record<string, string> = {
  proportional_sans_serif: 'proportionalSansSerif',
  monospace_sans_serif: 'monospaceSansSerif',
  proportional_serif: 'proportionalSerif',
  monospace_serif: 'monospaceSerif',
  casual: 'casual',
  cursive: 'cursive',
  small_capitals: 'smallCaps',
};

const REVERSE_FONT_FAMILY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FONT_FAMILY_MAP).map(([k, v]) => [v, k]),
);

const FONT_SIZE_MAP: Record<string, string> = {
  '50%': '0.5',
  '75%': '0.75',
  '100%': '1',
  '150%': '1.5',
  '200%': '2',
  '300%': '3',
  '400%': '4',
};

const REVERSE_FONT_SIZE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FONT_SIZE_MAP).map(([k, v]) => [v, k]),
);

// ── Types ───────────────────────────────────────────────────────────────────

interface AnyRecord {
  [key: string]: unknown;
  textTrackSettings?: unknown;
  textTracks?: unknown;
  getTextTracks?: unknown;
  setValues?: unknown;
  updateDisplay?: unknown;
  mode?: unknown;
  language?: unknown;
  kind?: unknown;
  srclang?: unknown;
  label?: unknown;
  showing?: unknown;
  videojs?: unknown;
  vjs?: unknown;
  players?: unknown;
  getPlayers?: unknown;
  player?: unknown;
  vimeoPlayer?: unknown;
  __vimeoPlayer?: unknown;
  __player?: unknown;
  ottPlayer?: unknown;
  vhxPlayer?: unknown;
  VHX?: unknown;
  vjsPlayer?: unknown;
  VjsPlayer?: unknown;
  VimeoPlayer?: unknown;
  Vimeo?: unknown;
  _player?: unknown;
  _vjs_player?: unknown;
  _vjs?: unknown;
  _vimeo?: unknown;
  Player?: unknown;
  memoizedProps?: unknown;
  memoizedState?: unknown;
  stateNode?: unknown;
  api?: unknown;
  child?: unknown;
  sibling?: unknown;
}

interface VimeoPlayer {
  setCaptionStyle(property: string, value: string): void;
  enableTextTrack?(language: string, kind?: string): void;
  disableTextTrack?(): void;
  // textTracks can be a method (Video.js style) or a plain array property
  // (native HTMLVideoElement / Vimeo OTT). We cast to `any` at call-sites.
  textTracks?: (() => unknown[]) | unknown[];
  getTextTracks?(): unknown[];
}

function isRecord(obj: unknown): obj is AnyRecord {
  return obj !== null && typeof obj === 'object';
}

function hasFn(obj: AnyRecord, key: string): boolean {
  return typeof obj[key] === 'function';
}

// ── Globals ─────────────────────────────────────────────────────────────────

const currentValues: Record<string, string | null> = {};
let pokeTimer: ReturnType<typeof setTimeout> | null = null;

// ── Discovery Helpers ───────────────────────────────────────────────────────

function findAllReactRoots(root: Document | ShadowRoot, roots: HTMLElement[] = []): HTMLElement[] {
  const all = root.querySelectorAll('*');
  for (const el of Array.from(all)) {
    const reactKey = Object.keys(el).find((k) => k.startsWith('__reactContainer'));
    if (reactKey) {
      console.log(
        `[CSS-STYL] Found React root: ${el.tagName}#${el.id}.${el.className} [key: ${reactKey}]`,
      );
      roots.push(el as HTMLElement);
    }
    if (el.shadowRoot) {
      findAllReactRoots(el.shadowRoot, roots);
    }
  }
  return roots;
}

// ── Helper: Sync to LocalStorage ───────────────────────────────────────────

function syncLocalStorage(values: Record<string, string | null>): void {
  const keys = [
    'vimeo-ott-player-settings',
    'vimeo-video-settings',
    'vimeo-player-settings',
    'vimeo.player.settings',
  ];
  for (const lsk of keys) {
    try {
      const raw = localStorage.getItem(lsk);
      const existing = JSON.parse(raw ?? '{}') as Record<string, unknown>;
      let modified = false;

      for (const [k, v] of Object.entries(values)) {
        const val = v ?? undefined;
        const snakeKey = k.replace(/([A-Z])/g, '_$1').toLowerCase();

        // Write both variants and prefixed variants
        const variants = [k, snakeKey, `captionStyle.${k}`, `captionStyle.${snakeKey}`];
        for (const variant of variants) {
          if (existing[variant] !== val) {
            existing[variant] = val;
            modified = true;
          }
        }
      }

      if (modified) {
        existing['updated_at'] = new Date().toISOString();
        const newValue = JSON.stringify(existing);
        localStorage.setItem(lsk, newValue);

        // Manually dispatch a StorageEvent in the current window so any
        // listeners in the same frame (like the Vimeo OTT Player) pick it up live.
        const event = new StorageEvent('storage', {
          key: lsk,
          newValue: newValue,
          storageArea: localStorage,
          url: window.location.href,
        });
        window.dispatchEvent(event);

        console.log(`[CSS-STYL] Sync: Updated localStorage key [${lsk}] and fired StorageEvent`);
      }
    } catch {
      /* ignore */
    }
  }
}

function getVimeoPlayer(): VimeoPlayer | null {
  console.log('[CSS-STYL] Searching for Vimeo Player (URL:', window.location.href, ')');
  try {
    const win = window as unknown as AnyRecord;

    const checkIsPlayer = (obj: unknown): boolean => {
      try {
        if (!isRecord(obj)) return false;
        if (hasFn(obj, 'setCaptionStyle')) return true;
        if (hasFn(obj, 'setSubtitleStyle')) return true;
        // Native Video.js player check:
        const tts = obj.textTrackSettings;
        if (isRecord(tts) && hasFn(tts, 'setValues')) {
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };

    const wrapPlayer = (obj: unknown): VimeoPlayer => {
      if (!isRecord(obj))
        return {
          setCaptionStyle(): void {
            /* empty */
          },
        };

      if (hasFn(obj, 'setCaptionStyle') || hasFn(obj, 'setSubtitleStyle')) {
        return obj as unknown as VimeoPlayer;
      }
      // If it's a Video.js player config wrapper
      return {
        setCaptionStyle(property: string, value: string): void {
          try {
            const tts = obj.textTrackSettings;
            if (isRecord(tts) && hasFn(tts, 'setValues')) {
              const underscored = property.replace(/([A-Z])/g, '_$1').toLowerCase();
              (tts.setValues as (v: unknown) => void)({ [property]: value, [underscored]: value });
              if (hasFn(tts, 'updateDisplay')) {
                (tts.updateDisplay as () => void)(); // Force CC update in Video.js
              }
            }
          } catch (e) {
            console.warn('[CSS-STYL] VideoJS wrapper err:', e);
          }
        },
        disableTextTrack(): void {
          const tracksFn = obj.textTracks;
          const tracks =
            typeof tracksFn === 'function' ? (tracksFn as () => unknown[])() : tracksFn;
          if (Array.isArray(tracks)) {
            for (const track of tracks) {
              if (isRecord(track) && track.mode === 'showing') track.mode = 'hidden';
            }
          }
        },
        enableTextTrack(lang: string, kind: string): void {
          const tracksFn = obj.textTracks;
          const tracks =
            typeof tracksFn === 'function' ? (tracksFn as () => unknown[])() : tracksFn;
          if (Array.isArray(tracks)) {
            for (const track of tracks) {
              if (isRecord(track) && track.language === lang && track.kind === kind) {
                track.mode = 'showing';
                break;
              }
            }
          }
        },
      };
    };

    // 1. Explicit Global Candidates
    const videojs = isRecord(win.videojs) ? win.videojs : null;
    const vjs = isRecord(win.vjs) ? win.vjs : null;

    const vjsPlayers = videojs
      ? Object.values((videojs.players as AnyRecord | undefined) ?? {})
      : [];
    const plainVjsPlayers = vjs ? Object.values((vjs.players as AnyRecord | undefined) ?? {}) : [];
    const getPlayersRes =
      videojs && hasFn(videojs, 'getPlayers') ? (videojs.getPlayers as () => AnyRecord)() : {};

    const globalCandidates = [
      win.player,
      win.vimeoPlayer,
      win.__vimeoPlayer,
      win.__player,
      win.ottPlayer,
      win.vhxPlayer,
      isRecord(win.VHX) ? win.VHX.player : null,
      win.vjsPlayer,
      win.VjsPlayer,
      win.VimeoPlayer,
      isRecord(win.Vimeo) ? win.Vimeo.Player : null,
      win._player,
      win._vjs_player,
      win._vjs,
      win._vimeo,
      ...vjsPlayers,
      ...plainVjsPlayers,
      ...Object.values(getPlayersRes),
    ];

    for (const candidate of globalCandidates) {
      if (checkIsPlayer(candidate)) {
        console.log('[CSS-STYL] Found player via global candidate!');
        return wrapPlayer(candidate);
      }
    }

    // 2. High-Broad Window Scan
    for (const key in win) {
      try {
        const val = win[key];
        if (isRecord(val) && key !== 'window' && key !== 'top' && key !== 'self') {
          if (checkIsPlayer(val)) {
            console.log(`[CSS-STYL] Found player via broad window scan [key: ${key}]`);
            return wrapPlayer(val);
          }
        }
      } catch {
        /* ignore */
      }
    }

    // 3. Recursive DOM / React Fiber Scan
    const videoEl = document.querySelector('video');
    if (videoEl) {
      console.log('[CSS-STYL] Found <video>, scanning ancestors and Fiber...');
      let cur: HTMLElement | null = videoEl;
      while (cur) {
        const anyCur = cur as unknown as AnyRecord;
        const playerKeys = [
          'player',
          '_player',
          'vjsPlayer',
          '_vjs_player',
          'vimeoPlayer',
          'api',
          'controller',
          'tech',
        ];
        for (const pk of playerKeys) {
          if (checkIsPlayer(anyCur[pk])) {
            console.log(`[CSS-STYL] Found player via DOM property scan [key: ${pk}]`);
            return wrapPlayer(anyCur[pk]);
          }
        }

        // Scan React Fiber
        const fiberKey = Object.keys(cur).find(
          (k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps'),
        );
        if (fiberKey) {
          const fiber = anyCur[fiberKey];
          const seen = new Set();

          const deepScan = (obj: unknown, depth = 0): unknown => {
            if (!isRecord(obj) || depth > 5 || seen.has(obj)) return null;
            seen.add(obj);
            if (checkIsPlayer(obj)) return obj;

            // Check common sub-properties
            const subKeys = [
              'player',
              'controller',
              'api',
              'vimeo',
              'vjs',
              'delegate',
              'val',
              'value',
            ];
            for (const sk of subKeys) {
              if (checkIsPlayer(obj[sk])) return obj[sk];
            }

            for (const k in obj) {
              try {
                const v = obj[k];
                if (isRecord(v)) {
                  const res = deepScan(v, depth + 1);
                  if (res) return res;
                }
              } catch {
                /* ignore */
              }
            }
            return null;
          };

          if (isRecord(fiber)) {
            const found =
              deepScan(fiber.memoizedProps) ??
              deepScan(fiber.memoizedState) ??
              deepScan(fiber.stateNode);
            if (found) {
              console.log('[CSS-STYL] Found player via Deep Fiber Scan!');
              return wrapPlayer(found);
            }
          }
        }
        cur = cur.parentElement;
      }
    }

    // 4. Fallback: Scan every React Root in the document
    const roots = findAllReactRoots(document);
    for (const root of roots) {
      const containerKey = Object.keys(root).find((k) => k.startsWith('__reactContainer'));
      if (!containerKey) continue;
      const rootFiber = (root as unknown as AnyRecord)[containerKey];

      let foundInRoot: unknown = null;
      const walk = (fiber: unknown, depth = 0): void => {
        if (!isRecord(fiber) || foundInRoot || depth > 500) return;

        if (checkIsPlayer(fiber.stateNode)) {
          foundInRoot = fiber.stateNode;
          return;
        }
        if (checkIsPlayer(fiber.memoizedProps)) {
          foundInRoot = fiber.memoizedProps;
          return;
        }

        // Look into props/state for player objects
        const p = fiber.memoizedProps;
        if (isRecord(p)) {
          if (checkIsPlayer(p.player)) {
            foundInRoot = p.player;
            return;
          }
          if (checkIsPlayer(p.api)) {
            foundInRoot = p.api;
            return;
          }
          if (checkIsPlayer(p.vjs)) {
            foundInRoot = p.vjs;
            return;
          }
        }

        if (fiber.child) walk(fiber.child, depth + 1);
        if (fiber.sibling) walk(fiber.sibling, depth);
      };
      walk(rootFiber);
      if (foundInRoot) {
        console.log('[CSS-STYL] Found player via Exhaustive React Walk!');
        return wrapPlayer(foundInRoot);
      }
    }

    // 5. Ultimate Fallback: Return a Dummy Player that triggers PostMessage
    console.log('[CSS-STYL] API missing. Returning postMessage fallback adapter.');
    return {
      setCaptionStyle(property: string, value: string): void {
        try {
          // Broadblast to the window to invoke Vimeo SDK listeners if they exist globally
          window.postMessage({ method: 'setCaptionStyle', value: [property, value] }, '*');
          window.postMessage({ method: 'setCaptionStyle', value: { property, value } }, '*');
        } catch {
          /* silent */
        }
      },
    };
  } catch (error) {
    console.error(
      '[CSS-STYL] Discovery Error:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

function pokeCaptions(): void {
  console.log('[CSS-STYL] pokeCaptions cycle starting...');

  if (Object.keys(currentValues).length === 0) {
    console.log('[CSS-STYL] Poke skipped: currentValues is empty');
    return;
  }

  // Step 1: Write to localStorage (Always do this for persistence)
  syncLocalStorage(currentValues);

  const player = getVimeoPlayer();
  if (!player) {
    console.warn('[CSS-STYL] Poke: Player object NOT found. Skipping JS-based styling.');
    return;
  }

  // Step 2: Identification and Track Toggling
  let trackLanguage: string | null = null;
  let trackKind: string | null = null;
  try {
    const rawPlayer = player as unknown as AnyRecord;
    const tracksFn = rawPlayer.textTracks ?? rawPlayer.getTextTracks;
    const tracksRes =
      typeof tracksFn === 'function' ? (tracksFn as () => unknown[])() : rawPlayer.textTracks;

    if (Array.isArray(tracksRes)) {
      for (const t of tracksRes) {
        if (isRecord(t) && (t.mode === 'showing' || t.showing === true)) {
          trackLanguage =
            (t.language as string | undefined) ??
            (t.srclang as string | undefined) ??
            (t.label as string | undefined) ??
            'en';
          trackKind = (t.kind as string | undefined) ?? 'captions';
          break;
        }
      }
    }
  } catch {
    /* silent */
  }

  if (trackLanguage && trackKind) {
    console.log(`[CSS-STYL] Poke Step 2: Toggling track ${trackLanguage} to refresh styles...`);
    try {
      if (typeof player.disableTextTrack === 'function') player.disableTextTrack();

      setTimeout(() => {
        if (typeof player.enableTextTrack === 'function') {
          player.enableTextTrack(trackLanguage, trackKind);
        }

        // Step 4: Final push
        setTimeout(() => {
          if (typeof player.setCaptionStyle === 'function') {
            const count = String(Object.keys(currentValues).length);
            console.log(`[CSS-STYL] Poke Step 4: Pushing ${count} properties...`);
            for (const [k, v] of Object.entries(currentValues)) {
              const val = String(v);
              try {
                player.setCaptionStyle(k, val);
                const underscored = k.replace(/([A-Z])/g, '_$1').toLowerCase();
                if (underscored !== k) player.setCaptionStyle(underscored, val);
                console.log(`[CSS-STYL] -> setCaptionStyle(${k}, ${val}) -> OK`);
              } catch (e) {
                console.warn(
                  `[CSS-STYL] -> setCaptionStyle(${k}, ${val}) -> FAIL:`,
                  e instanceof Error ? e.message : String(e),
                );
              }
            }
          }
        }, 400); // Increased delay
      }, 150);
    } catch (e) {
      console.warn('[CSS-STYL] Poke Step 2/3 failed:', e);
    }
  } else {
    // If no track to toggle, just try direct push
    console.log('[CSS-STYL] Poke: No active track to toggle, using direct push.');
    if (typeof player.setCaptionStyle === 'function') {
      for (const [k, v] of Object.entries(currentValues)) {
        player.setCaptionStyle(k, String(v));
      }
    }
  }
}

function applyVjsSetting(values: Record<string, string | null>): SettingApplicationReport {
  console.log('[CSS-STYL] applyVjsSetting called with:', JSON.stringify(values));

  for (const [k, v] of Object.entries(values)) {
    currentValues[k] = v;
  }

  // Sycn to localStorage IMMEDIATELY (Synchronously)
  syncLocalStorage(values);

  const player = getVimeoPlayer();
  if (player && typeof player.setCaptionStyle === 'function') {
    for (const [k, v] of Object.entries(values)) {
      try {
        player.setCaptionStyle(k, String(v));
      } catch {
        /* ignore */
      }
    }
  }

  if (pokeTimer) clearTimeout(pokeTimer);
  pokeTimer = setTimeout(() => {
    pokeTimer = null;
    pokeCaptions();
  }, 300);

  return { success: true, message: 'Styles queued' };
}

// ── Platform config ──────────────────────────────────────────────────────────

export const dropout: PlatformConfig = {
  name: 'Dropout',

  baselineCss: {
    subtitle: '',
  },
  // The Dropout/VHX embed player uses a React CaptionsRenderer, NOT VideoJS.
  // Class names are CSS modules (hashed), so we match on stable prefixes with [class*=].
  //   .vp-captions                                = stable root container
  //   CaptionsRenderer_module_captionsLine__*      = individual subtitle text (has its own bg)
  //   CaptionsRenderer_module_captionsWindow__*    = the box/window around cues
  css: {
    subtitleContainerSelector: '.vp-captions',
    selectors: {
      subtitle: '[class*="CaptionsRenderer_module_captionsLine"]',
      background: '[class*="CaptionsRenderer_module_captionsLine"]',
      window: '[class*="CaptionsRenderer_module_captionsWindow"]',
    },
  },

  detectNativeCapabilities(): boolean {
    const isVimeoHost =
      window.location.hostname.includes('vhx.tv') ||
      window.location.hostname.includes('dropout.tv');
    return isVimeoHost || !!document.querySelector('video');
  },

  nativeSettings: {
    fontColor: {
      getCurrentValue(): StorageSettings['fontColor'] {
        const color = currentValues['color'];
        return ((color != null ? REVERSE_COLOR_MAP[color] : undefined) ??
          'auto') as StorageSettings['fontColor'];
      },
      applySetting(value: string): SettingApplicationReport {
        const color = COLOR_HEX_MAP[value];
        if (!color) return { success: false, message: `Unknown color: ${value}` };
        return applyVjsSetting({ color });
      },
    },

    fontOpacity: {
      getCurrentValue(): StorageSettings['fontOpacity'] {
        return 'auto';
      },
      applySetting(value: string): SettingApplicationReport {
        const fontOpacity = TEXT_OPACITY_MAP[value];
        if (fontOpacity === undefined)
          return { success: false, message: `Unknown opacity: ${value}` };
        return applyVjsSetting({ fontOpacity });
      },
    },

    backgroundColor: {
      getCurrentValue(): StorageSettings['backgroundColor'] {
        const color = currentValues['bgColor'];
        return ((color != null ? REVERSE_COLOR_MAP[color] : undefined) ??
          'auto') as StorageSettings['backgroundColor'];
      },
      applySetting(value: string): SettingApplicationReport {
        const bgColor = COLOR_NAME_MAP[value];
        if (!bgColor) return { success: false, message: `Unknown color: ${value}` };
        return applyVjsSetting({ bgColor });
      },
    },

    backgroundOpacity: {
      getCurrentValue(): StorageSettings['backgroundOpacity'] {
        return 'auto';
      },
      applySetting(value: string): SettingApplicationReport {
        const bgOpacity = BG_OPACITY_MAP[value];
        if (bgOpacity === undefined)
          return { success: false, message: `Unknown opacity: ${value}` };
        return applyVjsSetting({ bgOpacity });
      },
    },

    windowColor: {
      getCurrentValue(): StorageSettings['windowColor'] {
        return 'auto';
      },
      applySetting(value: string): SettingApplicationReport {
        const windowColor = COLOR_HEX_MAP[value];
        if (!windowColor) return { success: false, message: `Unknown color: ${value}` };
        return applyVjsSetting({ windowColor });
      },
    },

    windowOpacity: {
      getCurrentValue(): StorageSettings['windowOpacity'] {
        return 'auto';
      },
      applySetting(value: string): SettingApplicationReport {
        const windowOpacity = BG_OPACITY_MAP[value];
        if (windowOpacity === undefined)
          return { success: false, message: `Unknown opacity: ${value}` };
        return applyVjsSetting({ windowOpacity });
      },
    },

    characterEdgeStyle: {
      getCurrentValue(): StorageSettings['characterEdgeStyle'] {
        const edgeStyle = currentValues['edgeStyle'];
        return ((edgeStyle != null ? REVERSE_EDGE_STYLE_MAP[edgeStyle] : undefined) ??
          'auto') as StorageSettings['characterEdgeStyle'];
      },
      applySetting(value: string): SettingApplicationReport {
        const edgeStyle = EDGE_STYLE_MAP[value];
        if (!edgeStyle) return { success: false, message: `Unknown style: ${value}` };
        return applyVjsSetting({ edgeStyle });
      },
    },

    fontFamily: {
      getCurrentValue(): StorageSettings['fontFamily'] {
        const fontFamily = currentValues['fontFamily'];
        return ((fontFamily != null ? REVERSE_FONT_FAMILY_MAP[fontFamily] : undefined) ??
          'auto') as StorageSettings['fontFamily'];
      },
      applySetting(value: string): SettingApplicationReport {
        const fontFamily = FONT_FAMILY_MAP[value];
        if (!fontFamily) return { success: false, message: `Unknown family: ${value}` };
        return applyVjsSetting({ fontFamily });
      },
    },

    fontSize: {
      getCurrentValue(): StorageSettings['fontSize'] {
        const fontSize = currentValues['fontSize'];
        return ((fontSize != null ? REVERSE_FONT_SIZE_MAP[fontSize] : undefined) ??
          'auto') as StorageSettings['fontSize'];
      },
      applySetting(value: string): SettingApplicationReport {
        const fontSize = FONT_SIZE_MAP[value];
        if (!fontSize) return { success: false, message: `Unknown size: ${value}` };
        return applyVjsSetting({ fontSize });
      },
    },
  },
};
