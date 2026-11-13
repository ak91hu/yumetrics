import { createHash } from 'node:crypto';

export const hashText = value => createHash('sha256').update(value).digest('hex');
export function archiveText(value, env = {}, limit = 65536) {
  if (value == null) return {text:null,truncated:false};
  let text = String(value);
  for (const secret of Object.entries(env).filter(([key,value])=>/SECRET|TOKEN|API_KEY|DATABASE_URL|PRIVATE_KEY/i.test(key)&&typeof value==='string'&&value.length>=4).flatMap(([,value])=>[value,JSON.stringify(value).slice(1,-1)]).sort((a,b)=>b.length-a.length)) text=text.replaceAll(secret,'[TITOK ELHAGYVA]');
  text=text.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+/gi,'[KÉPADAT ELHAGYVA]')
    .replace(/("(?:data|image|api[_-]?key|password|secret|authorization|access[_-]?token|refresh[_-]?token)"\s*:\s*")(?:\\.|[^"\\])*"/gi,'$1[ADAT ELHAGYVA]"')
    .replace(/\bBearer\s+[a-z0-9._~+/=-]+/gi,'Bearer [TITOK ELHAGYVA]')
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi,'[ADATBÁZIS-KAPCSOLAT ELHAGYVA]')
    .replace(/\b(?:sk|ak|as|wk|ws)[-_][a-z0-9._-]{8,}/gi,'[TITOK ELHAGYVA]')
    .replace(/[a-z0-9+/=_-]{256,}/gi,'[HOSSZÚ ADAT ELHAGYVA]');
  const bytes=Buffer.from(text);return {text:new TextDecoder('utf-8',{ignoreBOM:true}).decode(bytes.subarray(0,limit),{stream:true}),truncated:bytes.length>limit,redacted:text!==String(value)};
}
export function archiveJson(value, env = {}) {
  const clean=(item,depth=0)=>{
    if(depth>12)return '[MÉLY ADAT ELHAGYVA]';
    if(typeof item==='string')return archiveText(item,env).text;
    if(Array.isArray(item))return item.slice(0,100).map(value=>clean(value,depth+1));
    if(item&&typeof item==='object')return Object.fromEntries(Object.entries(item).map(([key,value])=>[key,/^(?:authorization|headers|api[_-]?key|password|secret|access[_-]?token|refresh[_-]?token|inlineData|image|images|data)$/i.test(key)?'[ADAT ELHAGYVA]':clean(value,depth+1)]));
    return item;
  };
  const serialized=JSON.stringify(clean(value));const bytes=Buffer.from(serialized??'null');const safe={text:bytes.subarray(0,65536).toString('utf8'),truncated:bytes.length>65536};
  return safe.truncated ? JSON.stringify({truncated:true,preview:safe.text}) : safe.text;
}
export function imageHashes(images) {
  return images.map(image=>hashText(Buffer.from(image.slice(image.indexOf(',')+1),'base64')));
}
export async function readAiResponse(response, env, provider) {
  const chunks=[];let bytes=0,wireTruncated=false,readError=false;
  const reader=response.body?.getReader();
  if(reader)try{
    for(;;){const {done,value}=await reader.read();if(done)break;const room=1048576-bytes;chunks.push(Buffer.from(value.subarray(0,room)));bytes+=Math.min(value.length,room);if(value.length>room){wireTruncated=true;await reader.cancel();break;}}
  }catch{readError=true;}finally{reader.releaseLock();}
  const raw=Buffer.concat(chunks).toString('utf8');let payload;
  try{if(!wireTruncated&&!readError)payload=JSON.parse(raw);}catch{}
  const candidate=payload?.candidates?.[0];
  const visible=provider==='modal'?payload?.answer:Array.isArray(payload?.content)?payload.content.filter(part=>part?.type==='text'&&typeof part?.text==='string').map(part=>part.text).join(''):Array.isArray(candidate?.content?.parts)?candidate.content.parts.filter(part=>part?.thought!==true&&typeof part?.text==='string').map(part=>part.text).join(''):undefined;
  const error=payload?.error;
  const fallback=payload?JSON.stringify({error:error?{code:error.code,status:error.status,message:error.message}:undefined,promptFeedback:payload.promptFeedback?{blockReason:payload.promptFeedback.blockReason}:undefined,format:'no_visible_answer'}):/"(?:thought|thinking|signature|content|candidates|parts)"\s*:/i.test(raw)?'[HIBÁS VÁLASZ: NEM KÜLÖNÍTHETŐ EL A NYILVÁNOS VÁLASZSZÖVEG]':raw;
  const saved=archiveText(visible ?? fallback,env);
  const meta={provider,wireTruncated,readError,redacted:saved.redacted,responseHash:hashText(saved.text||''),finishReason:candidate?.finishReason??payload?.stop_reason??null,responseId:payload?.responseId??payload?.id??null,modelVersion:payload?.modelVersion??payload?.model??null};
  if(provider==='modal')for(const key of ['revision','prompt_version','prompt_hash','max_new_tokens','truncated','inference_seconds','container_load_seconds','compute_seconds','peak_vram_gib'])if(payload?.[key]!=null)meta[key]=payload[key];
  return {payload,wireTruncated,readError,archive:{responseText:saved.text,responseMeta:meta,responseTruncated:saved.truncated||wireTruncated||readError||candidate?.finishReason==='MAX_TOKENS'||payload?.stop_reason==='max_tokens'||payload?.truncated===true}};
}
