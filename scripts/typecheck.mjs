import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
let failed=false
for(const name of readdirSync('packages')) {
 const result=spawnSync('pnpm',['exec','tsc','--noEmit','-p',`packages/${name}/tsconfig.json`],{stdio:'inherit'})
 if(result.status!==0)failed=true
}
process.exitCode=failed?1:0
