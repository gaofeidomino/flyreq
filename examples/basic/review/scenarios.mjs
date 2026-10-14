import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { flyreq, setupFlyreq, setRequestToken, resetFlyreqClient, createFetchRequestor, createParallelRequestor, createSerialRequestor } from 'flyreq'
import { createAxiosRequestor } from 'flyreq/axios'
const hits=new Map();let active=0;let peak=0
const server=createServer((req,res)=>{
 const key=new URL(req.url,'http://local').pathname;hits.set(key,(hits.get(key)??0)+1)
 if(key==='/retry'&&hits.get(key)<3){res.statusCode=503;res.end('{}');return}
 if(key==='/empty'){res.statusCode=204;res.end();return}
 const reply=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:0,data:{path:key,user:req.headers.authorization,count:hits.get(key)},message:'ok'}))}
 if(key==='/slow'){active++;peak=Math.max(peak,active);setTimeout(()=>{active--;reply()},50);return}reply()
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const baseURL=`http://127.0.0.1:${server.address().port}`
const results=[]
async function scenario(name,run){await run();results.push(name);console.log('PASS',name)}
try {
 setupFlyreq({baseURL,backend:'fetch',token:'',getRequestToken:undefined,retry:false})
 await scenario('基本 GET / POST',async()=>{assert.equal((await flyreq.get('/basic')).path,'/basic');assert.equal((await flyreq.post('/post',{title:'hello'})).path,'/post')})
 await scenario('缓存与请求合并',async()=>{await Promise.all([flyreq.get('/cache',{cache:1000}),flyreq.get('/cache',{cache:1000})]);await flyreq.get('/cache',{cache:1000});assert.equal(hits.get('/cache'),1)})
 await scenario('切换用户后缓存隔离',async()=>{setRequestToken('alice');await flyreq.get('/profile',{cache:true});setRequestToken('bob');assert.equal((await flyreq.get('/profile',{cache:true})).user,'Bearer bob');assert.equal(hits.get('/profile'),2)})
 await scenario('提交防重',async()=>{await Promise.all([flyreq.post('/order',{id:1},{idempotent:true}),flyreq.post('/order',{id:1},{idempotent:true})]);assert.equal(hits.get('/order'),1)})
 await scenario('503 重试至成功',async()=>{await flyreq.get('/retry',{retry:{maxCount:3,delay:5}});assert.equal(hits.get('/retry'),3)})
 await scenario('超时与外部信号组合',async()=>{await assert.rejects(flyreq.get('/slow',{timeout:5,signal:new AbortController().signal}))})
 await scenario('空响应',async()=>{assert.equal(await flyreq.get('/empty'),undefined);assert.equal(await flyreq.head('/head'),undefined)})
 // Let the deliberately timed-out server response finish before measuring parallelism.
 await new Promise(resolve=>setTimeout(resolve,70));peak=0
 await scenario('限制并发为 2',async()=>{const req=createParallelRequestor({maxCount:2,base:createFetchRequestor({baseURL})});await Promise.all([1,2,3,4].map(n=>req.get('/slow',{params:{n}})));assert.equal(peak,2)})
 peak=0
 await scenario('串行请求',async()=>{const req=createSerialRequestor({base:createFetchRequestor({baseURL})});await Promise.all([req.get('/slow'),req.get('/slow')]);assert.equal(peak,1)})
 await scenario('切换 Axios 适配器',async()=>{resetFlyreqClient();setupFlyreq({baseURL,backend:createAxiosRequestor(),retry:false});assert.equal((await flyreq.get('/axios')).path,'/axios')})
 console.log(JSON.stringify({passed:results.length,scenarios:results},null,2))
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
