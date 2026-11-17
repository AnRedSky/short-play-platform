export interface ApiEnvelope<T> { data: T; meta?: Record<string, unknown> }
export interface ApiErrorBody { error?: { code?: string; message?: string; details?: unknown; request_id?: string } }
export class ApiError extends Error {
 readonly status:number; readonly code?:string; readonly details?:unknown; readonly requestId?:string
 constructor(status:number,body?:ApiErrorBody){super(body?.error?.message??`API request failed (${status})`);this.name='ApiError';this.status=status;this.code=body?.error?.code;this.details=body?.error?.details;this.requestId=body?.error?.request_id}
}
export interface ApiRequestOptions extends RequestInit {mock?:boolean;auth?:boolean}
type MockHandler=(path:string,init:RequestInit)=>Promise<unknown>
const API_BASE_URL=(import.meta.env.VITE_API_BASE_URL??'/api/v1').replace(/\/$/,'')
let mockHandler:MockHandler|undefined;let tokenProvider:(()=>string|null)|undefined
export function configureApiMock(handler?:MockHandler){mockHandler=handler}
export function configureApiTokenProvider(provider?:()=>string|null){tokenProvider=provider}
function buildHeaders(init:RequestInit,auth:boolean){const headers=new Headers(init.headers);if(init.body&&!(init.body instanceof FormData)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');headers.set('Accept','application/json');const token=auth?tokenProvider?.():null;if(token)headers.set('Authorization',`Bearer ${token}`);return headers}
async function parseError(response:Response){let body:ApiErrorBody|undefined;try{body=await response.json() as ApiErrorBody}catch{/* non-JSON gateway response */}return new ApiError(response.status,body)}
export async function apiRequest<T>(path:string,options:ApiRequestOptions={}):Promise<T>{const{mock=import.meta.env.DEV&&Boolean(mockHandler),auth=true,...init}=options;if(mock){if(!mockHandler)throw new Error('Mock mode was requested but no mock adapter is configured.');return await mockHandler(path,init) as T}const response=await fetch(`${API_BASE_URL}${path.startsWith('/')?path:`/${path}`}`,{...init,headers:buildHeaders(init,auth)});if(!response.ok)throw await parseError(response);if(response.status===204)return undefined as T;return await response.json() as T}
export const apiGet=<T>(path:string)=>apiRequest<ApiEnvelope<T>>(path)
export const apiPost=<T,B>(path:string,body:B)=>apiRequest<ApiEnvelope<T>>(path,{method:'POST',body:JSON.stringify(body)})
export const apiPatch=<T,B>(path:string,body:B)=>apiRequest<ApiEnvelope<T>>(path,{method:'PATCH',body:JSON.stringify(body)})
