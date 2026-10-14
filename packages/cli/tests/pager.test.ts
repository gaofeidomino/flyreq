import { it,expect } from 'vitest'
import { generateResourceFile } from '../src/generate'
it.each(['POST','PUT','PATCH'])('generates correct %s pager argument slots',method=>{
 const code=generateResourceFile('search',{search:{method,path:'/search',pager:true}})
 expect(code).toContain(`flyreq.${method.toLowerCase()}('/search', undefined, { params: { page, size }, ...options })`)
})
it('encodes path parameter values',()=>{
 expect(generateResourceFile('x',{get:{method:'GET',path:'/x/{id}'}})).toContain('${encodeURIComponent(id)}')
})
