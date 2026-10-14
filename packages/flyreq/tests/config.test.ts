import { mkdtempSync,writeFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it,expect } from 'vitest'
import { loadFlyreqConfig,writeFlyreqConfig } from '../src/config'
import { setupFlyreqFromConfig } from '../src/node'
import { getBusConfig } from '@flyreq/bus'
it('reads, merges and overrides Node configuration',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'flyreq-config-'))
 try {expect(loadFlyreqConfig(cwd)).toBeUndefined();writeFlyreqConfig({backend:'fetch',baseURL:'https://a.test'},cwd);writeFlyreqConfig({successCode:200},cwd)
 expect(loadFlyreqConfig(cwd)).toMatchObject({backend:'fetch',successCode:200});setupFlyreqFromConfig({cwd,baseURL:'https://b.test'});expect(getBusConfig().baseURL).toBe('https://b.test')
 writeFileSync(join(cwd,'flyreq.config.json'),'{invalid');expect(loadFlyreqConfig(cwd)).toBeUndefined()
 }finally{rmSync(cwd,{recursive:true,force:true})}
})
