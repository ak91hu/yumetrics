// Test-only process: injected providers are never enabled by the production entry point.
import { createApp } from '../server.mjs';
import { openPostgresDatabase } from '../lib/database.mjs';
import { startJobRunner } from '../lib/jobs.mjs';
import { aiPayloadFor, testGoogleClient } from './fixtures.mjs';

const image = Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]);
const db = await openPostgresDatabase(process.env.TEST_DATABASE_URL);
const env = { GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',OPENCODE_API_KEY:'test-ai',CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'test-key',CLOUDINARY_API_SECRET:'test-secret' };
const googleClient = testGoogleClient({ sub:process.env.TEST_GOOGLE_SUB });
const fetcher = async (url, options) => {
  if(url.startsWith('https://res.cloudinary.com/')) return new Response(image,{headers:{'Content-Type':'image/jpeg'}});
  if(url.endsWith('/upload')) return Response.json({public_id:options.body.get('public_id'),secure_url:`https://res.cloudinary.com/test-cloud/image/upload/v1/${options.body.get('public_id')}.jpg`,width:100,height:80});
  if(url.endsWith('/destroy')) return Response.json({result:'ok'});
  if(url.startsWith('https://opencode.ai/'))return Response.json(aiPayloadFor({name:'Újraindítási teszt',confidence:'medium',assumptions:'Teszt',ingredients:[{name:'Hús',grams:150,calories:200,protein:25,carbs:0,fat:11,fiber:0,sugar:0,sodium:70}]},options));
  throw new Error('Unexpected test provider');
};
let runner;
const server=createApp({db,env,fetcher,googleClient,wake:()=>runner?.wake()});
server.listen(0,'127.0.0.1',()=>{
  env.APP_ORIGIN=`http://127.0.0.1:${server.address().port}`;googleClient.callbackOrigin=env.APP_ORIGIN;
  if(process.env.TEST_RUNNER==='yes')runner=startJobRunner({db,env,fetcher});
  process.send({origin:env.APP_ORIGIN});
});
