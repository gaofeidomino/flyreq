import { createServer, type Server } from 'node:http'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { createFetchRequestor } from '../src/index'
import { createAxiosRequestor } from '../../axios/src/index'
let server: Server;let baseURL: string
beforeAll(async()=>{
 server=createServer((req,res)=>{
  if(req.url==='/slow'){setTimeout(()=>{res.setHeader('Content-Type','application/json');res.end('{}')},80);return}
  if(req.url==='/empty'){res.statusCode=204;res.setHeader('Content-Type','application/json');res.end();return}
  if(req.method==='HEAD'){res.setHeader('Content-Type','application/json');res.end();return}
  if(req.url==='/string'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify('123'));return}
  if(req.url==='/text'){res.end('hello');return}
  if(req.url==='/fail'){res.statusCode=503;res.end('{}');return}
  let body='';req.on('data',chunk=>{body+=String(chunk)});req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:req.url,method:req.method,body,auth:req.headers.authorization}))})
 });await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
 const address=server.address();if(!address||typeof address==='string')throw new Error('No port');baseURL=`http://127.0.0.1:${address.port}`
})
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))})
describe.each([['fetch',createFetchRequestor],['axios',createAxiosRequestor]] as const)('%s against real local HTTP server',(_name,create)=>{
 it.each(['GET','POST','PUT','PATCH','DELETE','OPTIONS'] as const)('sends %s',async method=>{
  const req=create({baseURL});const resp=await req.request({method,url:'/echo',params:{q:'a b'},body:method==='GET'?undefined:{id:1}})
  expect(resp.status).toBe(200);expect(await resp.json()).toMatchObject({method,url:'/echo?q=a+b'})
 })
 it.each(['HEAD','GET'] as const)('handles empty %s',async method=>{
  const req=create({baseURL});const resp=await req.request({method,url:method==='HEAD'?'/head':'/empty'});expect(resp.data == null || resp.data === '').toBe(true)
 })
 it('preserves JSON string primitives',async()=>{const req=create({baseURL});expect(await (await req.get('/string')).json()).toBe('123')})
 it('handles text and non-success status',async()=>{
  const req=create({baseURL});expect(await (await req.get('/text')).text()).toBe('hello');expect((await req.get('/fail')).ok).toBe(false)
 })
 it('keeps timeout active with external signal',async()=>{
  await expect(create({baseURL}).get('/slow',{timeout:10,signal:new AbortController().signal})).rejects.toThrow()
 })
 it('supports caller cancellation alongside timeout',async()=>{
  const controller=new AbortController();const promise=create({baseURL}).get('/slow',{timeout:1000,signal:controller.signal});controller.abort()
  await expect(promise).rejects.toThrow()
 })
 it('rejects already aborted requests',async()=>{
  const controller=new AbortController();controller.abort();await expect(create({baseURL}).get('/echo',{signal:controller.signal,timeout:100})).rejects.toThrow()
 })
})
