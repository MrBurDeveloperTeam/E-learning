import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source = readFileSync(new URL('../src/features/subtitles/subtitleApi.ts', import.meta.url), 'utf8').replaceAll('import.meta.env.VITE_SUBTITLE_API_URL', 'undefined')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
const { youtubeVideoId } = await import('data:text/javascript,' + encodeURIComponent(outputText))
const id = 'IOHvw54rsw4'
for (const url of [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?si=ignored`, `youtube.com/shorts/${id}`, `https://m.youtube.com/watch?v=${id}`]) assert.equal(youtubeVideoId(url), id)
for (const url of [`https://youtube.com.evil.test/watch?v=${id}`, `https://youtube.com@127.0.0.1/watch?v=${id}`, 'https://youtube.com/playlist?list=test', 'https://youtube.com:8765/watch?v=' + id, 'javascript:alert(1)', `https://youtube.com/watch?v=${id}&v=${id}`]) assert.equal(youtubeVideoId(url), null)
console.log('Frontend YouTube URL validation passed (10 cases).')
