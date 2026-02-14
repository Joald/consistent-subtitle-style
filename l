warning: in the working copy of 'src/main.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/platforms/index.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/types/index.ts', LF will be replaced by CRLF the next time Git touches it
[1;33mdiff --git a/src/main.ts b/src/main.ts[m
[1;33mindex e1a7875..39416a2 100644[m
[1;33m--- a/src/main.ts[m
[1;33m+++ b/src/main.ts[m
[1;35m@@ -72,16 +72,14 @@[m [masync function applyStyles(platform: PlatformConfig): Promise<void> {[m
 }[m
 [m
 function startSubtitleObserver(platform: PlatformConfig): void {[m
[1;31m-  const observer = new MutationObserver(() => {[m
[1;31m-    applyStyles(platform);[m
[1;31m-  });[m
[1;31m-[m
[1;31m-  observer.observe(document.body, {[m
[1;31m-    childList: true,[m
[1;31m-    subtree: true,[m
[1;31m-    attributes: true,[m
[1;31m-    attributeFilter: ['data-subtitles-container'][m
[1;31m-  });[m
[1;32m+[m[1;32m  const selector = platform.css?.subtitleContainerSelector;[m
[1;32m+[m[1;32m  if (!selector) return;[m
[1;32m+[m
[1;32m+[m[1;32m  const container = document.querySelector(selector);[m
[1;32m+[m[1;32m  if (container) {[m
[1;32m+[m[1;32m    const observer = new MutationObserver(() => applyStyles(platform));[m
[1;32m+[m[1;32m    observer.observe(container, { childList: true, subtree: true, attributes: true });[m
[1;32m+[m[1;32m  }[m
 }[m
 [m
 async function initialize(): Promise<void> {[m
[1;35m@@ -99,7 +97,7 @@[m [masync function initialize(): Promise<void> {[m
 [m
     await applyStyles(platform);[m
 [m
[1;31m-    if (platform.usesCssStyling) {[m
[1;32m+[m[1;32m    if (platform.css) {[m
       startSubtitleObserver(platform);[m
     }[m
 [m
[1;33mdiff --git a/src/platforms/index.ts b/src/platforms/index.ts[m
[1;33mindex 83e36ad..3d68537 100644[m
[1;33m--- a/src/platforms/index.ts[m
[1;33m+++ b/src/platforms/index.ts[m
[1;35m@@ -9,7 +9,7 @@[m [mfunction applyCharacterEdgeStyle(elements: NodeListOf<Element>, value: StorageSe[m
       if (element instanceof HTMLElement) {[m
         switch (value) {[m
           case 'dropshadow':[m
[1;31m-            element.style.textShadow = '3px 3px 6px rgba(0,0,0,0.8)';[m
[1;32m+[m[1;32m            element.style.textShadow = '2px 2px 4px rgba(0,0,0,0.95)';[m
             break;[m
           case 'none':[m
             element.style.textShadow = 'none';[m
[1;35m@@ -82,10 +82,11 @@[m [mfunction applyWindowOpacity(elements: NodeListOf<Element>, value: StorageSetting[m
 [m
 export const PLATFORMS: { [platformName: string]: PlatformConfig } = {[m
   youtube,[m
[1;31m-[m
   nebula: {[m
     name: 'Nebula',[m
[1;31m-    usesCssStyling: true,[m
[1;32m+[m[1;32m    css: {[m
[1;32m+[m[1;32m      subtitleContainerSelector: '#video-player [data-subtitles-container]'[m
[1;32m+[m[1;32m    },[m
     settings: {[m
       characterEdgeStyle: {[m
         getCurrentValue() { return undefined; },[m
[1;33mdiff --git a/src/types/index.ts b/src/types/index.ts[m
[1;33mindex 507de5e..03e2f01 100644[m
[1;33m--- a/src/types/index.ts[m
[1;33m+++ b/src/types/index.ts[m
[1;35m@@ -18,12 +18,16 @@[m [mexport interface PlatformSettingConfig {[m
   applySetting(value: StorageSettings[keyof StorageSettings]): SettingApplicationReport;[m
 }[m
 [m
[1;32m+[m[1;32mexport interface CssConfig {[m
[1;32m+[m[1;32m  subtitleContainerSelector: string;[m
[1;32m+[m[1;32m}[m
[1;32m+[m
 export interface PlatformConfig {[m
   name: string;[m
   settings: {[m
     [K in keyof StorageSettings]: PlatformSettingConfig;[m
   };[m
[1;31m-  usesCssStyling?: boolean;[m
[1;32m+[m[1;32m  css?: CssConfig;[m
   detectNativeCapabilities?(): boolean;[m
   getCurrentNativeSettings?(): Partial<StorageSettings> | null;[m
   applyNativeSetting?(setting: keyof StorageSettings, value: string): boolean;[m
