import { it,expect } from 'vitest'
import { appendParams,joinURL } from '../src/url'
it.each([[undefined,'/x','/x'],['https://a.test/','/x','https://a.test/x'],['https://a.test','https://b.test/x','https://b.test/x']])('joins URL', (base,path,expected)=>expect(joinURL(base,path!)).toBe(expected))
it('appends encoded params, retains query and ignores null',()=>expect(appendParams('/x?q=old',{q:'a b',n:1,missing:null})).toBe('/x?q=a+b&n=1'))
