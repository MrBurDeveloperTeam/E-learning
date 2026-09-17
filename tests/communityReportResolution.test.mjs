import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Exercise the real API wrapper without writing to Supabase.
const source = readFileSync(new URL('../src/features/community/api/communityReportApi.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const client = { rpc: async () => ({ data: 1, error: null }) }
globalThis.__reportTestClient = client
const api = await import(`data:text/javascript;base64,${Buffer.from('const supabase = globalThis.__reportTestClient;\n' + js).toString('base64')}`)

test('each button submits its actual decision and group report ID', async () => {
  for (const decision of ['dismiss', 'resolve', 'hide']) {
    client.rpc = async (name, args) => {
      assert.equal(name, 'community_resolve_report')
      assert.deepEqual(args, { target_report_id: 'report-id', decision })
      return { data: 3, error: null }
    }
    await api.resolveCommunityReport('report-id', decision)
  }
})

test('database failures and missing deployment do not report success', async () => {
  client.rpc = async () => ({ data: null, error: { code: '42501', message: 'Administrator access required' } })
  await assert.rejects(api.resolveCommunityReport('report-id', 'hide'), /Administrator access required/)
  client.rpc = async () => ({ data: null, error: { code: 'PGRST202' } })
  await assert.rejects(api.resolveCommunityReport('report-id', 'resolve'), /not configured/)
})

test('empty or invalid acknowledgements cannot produce a success toast', async () => {
  for (const data of [0, null, undefined, '1', -1]) {
    client.rpc = async () => ({ data, error: null })
    await assert.rejects(api.resolveCommunityReport('report-id', 'dismiss'), /No pending reports/)
  }
})
