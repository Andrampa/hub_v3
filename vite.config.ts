import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

/**
 * The vendored FAO theme opens with five Google Fonts `@import`s. An `@import`
 * inside a render-blocking stylesheet is a second serial round trip before
 * first paint, and three of the five families are never rendered here:
 * Montserrat and Noto Sans JP have no `font-family` rule in the theme at all,
 * and Cairo is reached only through `html[lang=ar|fa|sf]`, which this
 * English-only Hub never sets. Open Sans is the body face and Merriweather is
 * used by the theme's blockquote and story-card rules, so both stay.
 *
 * Stripping them here rather than in the file keeps `fao-theme.min.css` a
 * byte-exact vendor snapshot, so a theme upgrade drops in unchanged and is
 * still trimmed. If an upgrade starts using one of these families the rule
 * survives and only the webfont is missing, which is a fallback, not a break.
 */
const UNUSED_THEME_FONTS = ['Montserrat', 'Cairo', 'Noto+Sans+JP']

function dropUnusedThemeFonts(): Plugin {
  return {
    name: 'diem-drop-unused-theme-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (id.indexOf('fao-theme.min.css') === -1) return null
      const trimmed = code.replace(
        /@import url\("https:\/\/fonts\.googleapis\.com\/css2\?family=([^"&:]+)[^"]*"\);/g,
        (statement, family: string) => (UNUSED_THEME_FONTS.indexOf(family) !== -1 ? '' : statement),
      )
      return trimmed === code ? null : { code: trimmed, map: null }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), dropUnusedThemeFonts(), ...(mode === 'http-test' ? [] : [basicSsl()])],
  server: {
    host: mode === 'http-test' ? '127.0.0.1' : 'localhost',
    port: mode === 'http-test' ? 4174 : 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: ['index.html', 'oauth-callback.html'],
    },
  },
}))
