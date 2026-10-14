// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createStorageStore, createCookieStore, createIndexedDBStore } from '../src/index'
describe.each([['storage',createStorageStore],['cookie',createCookieStore],['indexeddb',createIndexedDBStore]] as const)('%s store',(_name,create)=>{
 it('persists, expires, deletes and clears entries',async()=>{
  const store=create();await store.clear();await store.set('live',{id:1});expect(await store.has('live')).toBe(true);expect(await store.get('live')).toEqual({id:1})
  await store.set('expired',1,{expireAt:Date.now()-1000});expect(await store.has('expired')).toBe(false);expect(await store.get('expired')).toBeUndefined()
  await store.delete('live');expect(await store.has('live')).toBe(false);await store.set('x',1);await store.clear();expect(await store.has('x')).toBe(false)
 })
})
