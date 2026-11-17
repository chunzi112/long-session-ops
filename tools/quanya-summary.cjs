// 全压摘要：把这条会话压成一份可以直接贴进新会话的 Brief
// 用法：node 全压摘要.cjs [会话目录]
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const zlib = require('node:zlib')

const sessionDir = process.argv[2] || path.join(os.homedir(), '.dsh', 'sessions', '--D-~9C7C--', 'session-233f6524-82f8-45b7-8222-5475d937de54')
const logFile = path.join(sessionDir, 'session.v4.jsonl.zstd')
const outFile = path.join('D:', '鱼的家', '全压摘要.md')

if (!fs.existsSync(logFile)) {
  console.error('找不到会话日志：' + logFile)
  process.exit(1)
}

// 会话日志是多个 zstd 帧拼起来的，逐帧解
const buf = fs.readFileSync(logFile)
const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const offsets = []
let i = 0
while (true) {
  const idx = buf.indexOf(magic, i)
  if (idx === -1) break
  offsets.push(idx)
  i = idx + 4
}
let text = ''
for (let k = 0; k < offsets.length; k++) {
  const start = offsets[k]
  const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length
  try { text += zlib.zstdDecompressSync(buf.subarray(start, end)).toString('utf8') } catch {}
}
const lines = text.split('\n').filter((l) => l.startsWith('{'))

let lastSummary = null
let summaryAt = 0
const userMsgs = []
for (const l of lines) {
  let o
  try { o = JSON.parse(l) } catch { continue }
  if (o.type === 'compaction/summary' && o.data && Array.isArray(o.data.summary)) {
    const t = o.data.summary.map((p) => p.text || '').join('\n').trim()
    if (t) { lastSummary = t; summaryAt = o.time }
  }
  if (o.type === 'user/message' && o.data && o.data.content) {
    const c = o.data.content
    const t = Array.isArray(c) ? c.map((p) => p.text || '').join(' ') : String(c || '')
    if (t.trim()) userMsgs.push({ time: o.time, text: t.trim() })
  }
}

const afterSummary = lastSummary ? userMsgs.filter((m) => m.time > summaryAt) : userMsgs
const recent = afterSummary.slice(-20)

const now = new Date()
const head = [
  '# 全压摘要',
  '',
  `生成时间：${now.toLocaleString('zh-CN', { hour12: false })}`,
  `会话：${path.basename(sessionDir)}`,
  `消息总数：${userMsgs.length}；上次压缩在：${lastSummary ? new Date(summaryAt).toLocaleString('zh-CN', { hour12: false }) : '（没有压缩记录）'}`,
  '',
  '## 一、上次压缩时的摘要（原文）',
  '',
  lastSummary || '（这条会话还没压过，下面的「压缩之后的对话」就是全部）',
  '',
  '## 二、压缩之后，他又说了什么（最近 20 条）',
  '',
  ...recent.map((m) => `- ${new Date(m.time).toLocaleString('zh-CN', { hour12: false })}｜${m.text.replace(/\s+/g, ' ').slice(0, 200)}`),
  '',
  '## 三、现在该从哪儿接（贴进新会话之前自己补两句）',
  '',
  '- 现在在做：',
  '- 下一步：',
  '- 别忘的：',
  '',
]

fs.writeFileSync(outFile, head.join('\n'), 'utf8')
console.log('写好：' + outFile)
console.log(`摘要 ${lastSummary ? lastSummary.length : 0} 字；压缩后消息 ${afterSummary.length} 条，取最近 ${recent.length} 条`)
