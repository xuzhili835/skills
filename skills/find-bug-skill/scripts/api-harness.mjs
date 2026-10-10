// find-bug-skill 配套 API 测试助手（骨架）
// 用法：复制本文件到临时测试目录并改名 h.mjs，改好下面三个配置项，然后
//       import { call, login, gjson, wait, ok, summary } from './h.mjs'
//
// 配置项（可直接改死成你的值，或用环境变量覆盖）：
const BASE   = process.env.HARNESS_BASE   || 'http://localhost:8080' // 入口地址（网关/服务/CLI 包一层皆可）
const PREFIX = process.env.HARNESS_PREFIX || '/api/v1'               // API 统一前缀；没有就设为 ''
// login() 里的端点路径和响应形状按你的项目改（见下方注释）。

/** 发请求。GET 自动不带 body（undici 限制）；params 对象自动拼 querystring。 */
export async function call(method, path, bodyOrParams, token) {
  const isGet = method.toUpperCase() === 'GET'
  const url = BASE + PREFIX + path + (isGet && bodyOrParams ? '?' + new URLSearchParams(bodyOrParams) : '')
  const headers = { 'Content-Type': 'application/json; charset=utf-8' }
  if (token) headers.Authorization = 'Bearer ' + token
  const res = await fetch(url, {
    method,
    headers,
    body: isGet || bodyOrParams === undefined ? undefined : JSON.stringify(bodyOrParams)
  })
  let j = null
  try { j = await res.json() } catch (e) { /* 空体/HTML 错误页 */ }
  return { status: res.status, code: j && j.code, msg: j && j.message, data: j && j.data, raw: j }
}

/** 按你的项目修改：端点路径、成功判定、token 字段名。 */
export async function login(username, password) {
  const r = await call('POST', '/auth/login', { username, password })
  return r.data && r.data.token   // ← 响应形状不同就改这行
}

/** 带原始 querystring 的 GET（pathWithQuery 含 PREFIX 之后的部分），适合直接写完整路径。 */
export async function gjson(pathWithQuery, token) {
  const headers = token ? { Authorization: 'Bearer ' + token } : {}
  return fetch(BASE + pathWithQuery, { headers }).then(r => r.json()).catch(() => null)
}

export const wait = ms => new Promise(r => setTimeout(r, ms))

const PASS = []
const FAIL = []
export function ok(name, cond, detail = '') {
  ;(cond ? PASS : FAIL).push(name)
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name, cond ? '' : '<-- ' + detail)
}
export function summary() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`)
  if (FAIL.length) { console.log('failed:', FAIL.join(' ; ')); process.exitCode = 1 }
}
