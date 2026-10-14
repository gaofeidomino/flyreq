import { it,expect,vi } from 'vitest'
import ts from 'typescript'
import { generateResourceFile } from '../src/generate'
it('generated POST pager actually calls the correct argument positions',async()=>{
 const code=generateResourceFile('search',{search:{method:'POST',path:'/search',pager:true}})
 const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
 const post=vi.fn().mockResolvedValue({ok:true});const exported:Record<string,(...args:unknown[])=>Promise<unknown>>={}
 new Function('require','exports',js)(()=>({flyreq:{post}}),exported)
 await exported.search(2,10,{timeout:100});expect(post).toHaveBeenCalledWith('/search',undefined,{params:{page:2,size:10},timeout:100})
})
it('generated path params encode slash and query characters',async()=>{
 const code=generateResourceFile('user',{user:{method:'GET',path:'/users/{id}'}})
 const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
 const get=vi.fn().mockResolvedValue({});const exported:Record<string,(...args:unknown[])=>Promise<unknown>>={}
 new Function('require','exports',js)(()=>({flyreq:{get}}),exported)
 await exported.user('a/b?x=1');expect(get).toHaveBeenCalledWith('/users/a%2Fb%3Fx%3D1',undefined)
})
