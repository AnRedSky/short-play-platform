import {afterEach,describe,expect,it,vi} from 'vitest'
import {apiRequest,configureApiMock,configureApiTokenProvider} from '../../src/api'
afterEach(()=>{vi.restoreAllMocks();configureApiMock(undefined);configureApiTokenProvider(undefined)})
describe('API request pipeline',()=>{
it('injects bearer token and returns JSON response',async()=>{configureApiTokenProvider(()=>'test-token');const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({data:{ok:true}}),{status:200}));const result=await apiRequest<{ok:boolean}>('/health',{mock:false});expect(result).toEqual({data:{ok:true}});expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get('Authorization')).toBe('Bearer test-token')})
it('normalizes documented API errors',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({error:{code:'PERMISSION_DENIED',message:'Forbidden',request_id:'req-1'}}),{status:403}));await expect(apiRequest('/private',{mock:false})).rejects.toMatchObject({name:'ApiError',status:403,code:'PERMISSION_DENIED',requestId:'req-1'})})
it('supports an explicitly requested mock adapter',async()=>{configureApiMock(async path=>({data:{path}}));await expect(apiRequest('/mocked',{mock:true})).resolves.toEqual({data:{path:'/mocked'}})})
it('returns undefined for no-content responses',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:204}));await expect(apiRequest<void>('/resource',{mock:false,method:'DELETE'})).resolves.toBeUndefined()})

it('passes AbortSignal to fetch so project switches can cancel network requests',async()=>{
const controller=new AbortController()
const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({data:{ok:true}}),{status:200}))
await apiRequest('/project-data',{mock:false,signal:controller.signal})
expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
})
it('does not return a mock response after its request context was aborted',async()=>{
const controller=new AbortController()
configureApiMock(async()=>{controller.abort();return {data:{project:'stale'}}})
await expect(apiRequest('/project-data',{mock:true,signal:controller.signal})).rejects.toMatchObject({name:'AbortError'})
})
})
