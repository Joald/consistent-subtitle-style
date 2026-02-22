<p align="center">
  <img src="images/logo-512.png" alt="Consistent Subtitle Style Logo" width="512">
</p>

## Overview

This Chrome extension provides persistent subtitle styling across streaming platforms with TypeScript-based architecture. Features hybrid styling approach using native YouTube API with CSS fallback for platforms that don't offer a native support. Supports YouTube, Nebula, and more to come.

## Quick Start

### Installation

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```
2. Load extension in Chrome:
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder (not the source directory)

### Usage

1. Navigate to any supported streaming service
2. Click the extension icon to open settings
3. Customize your subtitle styles
4. Styles persist across all videos and platforms

### Quick Test

Navigate to any streaming video with subtitles enabled and verify your custom styles are applied automatically.

## Supported Platforms

| Platform | Status | Support Type |
| -------- | ------ | ------------ |
| YouTube  | ✅     | Native API   |
| Nebula   | ✅     | CSS Only     |
