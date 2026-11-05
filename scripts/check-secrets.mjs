// commit 前的機密檢查
// 檢查「這次準備 commit 的內容」裡，有沒有金鑰、Gmail 地址或環境變數檔。
// 有找到就停下來，commit 不會成功。
//
// 自動執行：.githooks/pre-commit 會在每次 commit 前呼叫它。
// 手動執行：npm run check-secrets

import { execSync } from 'node:child_process'

const run = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })

// 1. 不能被 commit 的檔案
const stagedFiles = run('git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMR')
  .split('\n')
  .filter(Boolean)

const forbiddenFiles = stagedFiles.filter((file) => {
  const name = file.split('/').pop()
  if (name === '.env.example') return false
  return name === '.env' || name.startsWith('.env.') || file.startsWith('backups/')
})

// 2. 不能出現在內容裡的字串
const rules = [
  { name: 'Gmail 地址', pattern: /[A-Za-z0-9._%+-]+@(gmail|googlemail)\.com/i },
  { name: 'Google OAuth client secret', pattern: /GOCSPX-[A-Za-z0-9_-]{10,}/ },
  { name: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'JWT 金鑰（舊版 service_role／anon key）', pattern: /eyJhbGciOi[A-Za-z0-9_-]{10,}/ },
  { name: '私密金鑰檔', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]

// 只檢查這次「新增」的行，不檢查刪掉的行
const diff = run('git -c core.quotepath=false diff --cached -U0 --no-color')
const findings = []
let currentFile = ''

for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) {
    currentFile = line.replace(/^\+\+\+ (b\/)?/, '')
    continue
  }
  if (!line.startsWith('+')) continue
  for (const rule of rules) {
    if (rule.pattern.test(line)) {
      findings.push(`  - ${currentFile}：疑似 ${rule.name}`)
    }
  }
}

if (forbiddenFiles.length === 0 && findings.length === 0) {
  console.log('機密檢查通過：沒有發現金鑰、Gmail 地址或環境變數檔。')
  process.exit(0)
}

console.error('\n機密檢查沒有通過，這次 commit 已經被擋下來：')
for (const file of forbiddenFiles) console.error(`  - ${file}：環境變數檔或備份檔不能 commit`)
for (const finding of findings) console.error(finding)
console.error('\n請把上面的內容移除（或改放到 .env.local），再重新 commit。\n')
process.exit(1)
