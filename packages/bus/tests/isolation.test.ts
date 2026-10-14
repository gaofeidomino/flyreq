import { beforeEach, describe, it, expect } from 'vitest'
import { defineRequestor, createHttpResponse } from '@flyreq/core'
import { bootstrapRequestor, configureBus, flyreq, resetFlyreqClient, setRequestToken } from '../src/index'
beforeEach(()=>{resetFlyreqClient();configureBus({baseURL:'https://a.test',token:'',getRequestToken:undefined})})
describe('user and origin isolation',()=>{
 it.each(['cache','idempotent'] as const)('isolates %s across token changes',async feature=>{
  let n=0;bootstrapRequestor(defineRequestor(async c=>{n++;return createHttpResponse({status:200,statusText:'OK',url:c.url,headers:{},data:{code:0,data:c.headers?.Authorization,message:''}})}))
  setRequestToken('alice');expect(await flyreq.post('/profile',{id:1},{[feature]:true})).toBe('Bearer alice')
  setRequestToken('bob');expect(await flyreq.post('/profile',{id:1},{[feature]:true})).toBe('Bearer bob');expect(n).toBe(2)
 })
 it('isolates cached origins',async()=>{
  let n=0;bootstrapRequestor(defineRequestor(async c=>{n++;return createHttpResponse({status:200,statusText:'OK',url:c.url,headers:{},data:{origin:c.baseURL}})}))
  expect(await flyreq.get('/x',{cache:true})).toEqual({origin:'https://a.test'});configureBus({baseURL:'https://b.test'})
  expect(await flyreq.get('/x',{cache:true})).toEqual({origin:'https://b.test'});expect(n).toBe(2)
 })
 it('switches token getter to static token',async()=>{
  configureBus({token:()=> 'old'});configureBus({token:'new'})
  bootstrapRequestor(defineRequestor(async c=>createHttpResponse({status:200,statusText:'OK',url:c.url,headers:{},data:c.headers})))
  expect(await flyreq.get('/x')).toEqual({Authorization:'Bearer new'})
 })
 it('respects lowercase authorization override',async()=>{
  setRequestToken('default');bootstrapRequestor(defineRequestor(async c=>createHttpResponse({status:200,statusText:'OK',url:c.url,headers:{},data:c.headers})))
  expect(await flyreq.get('/x',{headers:{authorization:'Bearer explicit'}})).toEqual({authorization:'Bearer explicit'})
 })
})
