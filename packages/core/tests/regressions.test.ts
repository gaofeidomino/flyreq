import { describe, it, expect } from 'vitest'
import { hashRequest, createCacheRequestor, defineRequestor, createHttpResponse, createRetryRequestor, createParallelRequestor, createSerialRequestor, createMemoryStore, createEventfulRequestor } from '../src/index'
import type { RequestConfig } from '../src/index'
const config = (body: unknown): RequestConfig => ({ method: 'POST', url: '/order', body })
const ok = () => createHttpResponse({ status: 200, statusText: 'OK', headers: {}, data: {}, url: '/' })
describe('request identity regressions', () => {
 it.each([[1, '1'], [true, 'true'], [null, undefined], [['a,b'], ['a', 'b']], [{v: 1}, {v: '1'}], [new Date(0), {}], [new Uint8Array([1]), new Uint8Array([2])]])('distinguishes typed bodies %j / %j', (a,b) => {
  expect(hashRequest(config(a))).not.toBe(hashRequest(config(b)))
 })
 it('includes origin and headers', () => {
  expect(hashRequest({...config({}), baseURL: 'https://a.test'})).not.toBe(hashRequest({...config({}), baseURL: 'https://b.test'}))
  expect(hashRequest({...config({}), headers:{Authorization:'a'}})).not.toBe(hashRequest({...config({}), headers:{Authorization:'b'}}))
 })
 it('rejects cyclic and unsupported bodies rather than merging them', () => {
  const body: Record<string, unknown> = {}; body.self = body
  expect(() => hashRequest(config(body))).toThrow(/cyclic/)
  expect(() => hashRequest(config(new FormData()))).toThrow(/custom key/)
 })
 it('separates cached POST bodies', async () => {
  let n=0; const req = createCacheRequestor({base: defineRequestor(async () => {n++;return ok()})})
  await req.post('/search',{q:'a'});await req.post('/search',{q:'b'});await req.post('/search',{q:'a'})
  expect(n).toBe(2)
 })
})
describe('scheduling and retry boundaries', () => {
 it.each([-1, NaN, Infinity, 0.5])('rejects invalid retry count %s', maxCount => {
  expect(() => createRetryRequestor({maxCount,base:defineRequestor(async()=>ok())})).toThrow(RangeError)
 })
 it.each([0, -1, NaN, Infinity, 1.5])('rejects invalid parallel count %s', maxCount => {
  expect(() => createParallelRequestor({maxCount,base:defineRequestor(async()=>ok())})).toThrow(RangeError)
 })
 it('does not retry cancellation', async () => {
  let n=0;const req=createRetryRequestor({base:defineRequestor(async()=>{n++;throw new DOMException('aborted','AbortError')})})
  await expect(req.get('/')).rejects.toThrow('aborted');expect(n).toBe(1)
 })
 it('continues serial work after a rejection', async () => {
  let n=0;const req=createSerialRequestor({base:defineRequestor(async()=>{if(++n===1)throw new Error('fail');return ok()})})
  await expect(req.get('/1')).rejects.toThrow('fail');await expect(req.get('/2')).resolves.toMatchObject({status:200})
 })
})

it('dedupes throughout asynchronous cache writes',async()=>{
 const store=createMemoryStore();const originalSet=store.set.bind(store);let writing!:()=>void;let release!:()=>void
 const started=new Promise<void>(resolve=>{writing=resolve});const blocked=new Promise<void>(resolve=>{release=resolve})
 store.set=async(...args)=>{writing();await blocked;await originalSet(...args)}
 let n=0;const req=createCacheRequestor({store,base:defineRequestor(async()=>{n++;return ok()})})
 const first=req.get('/');await started;const second=req.get('/');await new Promise(resolve=>setTimeout(resolve,5));expect(n).toBe(1);release();await Promise.all([first,second])
})
it('reports beforeRequest failures through error hooks',async()=>{
 const req=createEventfulRequestor(defineRequestor(async()=>ok()));let reported=false
 req.on('beforeRequest',()=>{throw new Error('hook failed')});req.on('error',()=>{reported=true})
 await expect(req.get('/')).rejects.toThrow('hook failed');expect(reported).toBe(true)
})
it('cancels during retry delay without waiting for the next attempt',async()=>{
 let n=0;const controller=new AbortController();const req=createRetryRequestor({delay:10000,base:defineRequestor(async()=>{n++;throw new Error('network')})})
 const result=req.get('/',{signal:controller.signal});setTimeout(()=>controller.abort(),5)
 await expect(result).rejects.toMatchObject({name:'AbortError'});expect(n).toBe(1)
})

it.each(['hello','123','true'])('preserves already parsed JSON string %s',async data=>{
 const response=createHttpResponse({status:200,statusText:'OK',headers:{},url:'/',data});expect(await response.json()).toBe(data)
})
it('rejects an aborted request even when cache is warm',async()=>{
 const req=createCacheRequestor({base:defineRequestor(async()=>ok())});await req.get('/');const controller=new AbortController();controller.abort()
 await expect(req.get('/',{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'})
})
