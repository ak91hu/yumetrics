import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { signedPhotoUrl, storedPhotoData, modelImageTransformation } from '../lib/photos.mjs';

const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 'secret' };
const photo = { publicId: 'yumetrics/abc-123', type: 'authenticated', url: 'https://res.cloudinary.com/test-cloud/image/authenticated/v17/yumetrics/abc-123.jpg' };
const jpeg = Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200)]);
const sign = text => createHash('sha1').update(text + 'secret').digest('base64url').slice(0, 8);

test('the model copy is a signed Cloudinary transformation; the signature covers transformation and public id, not the version', () => {
  assert.equal(modelImageTransformation({}), 'c_limit,w_1600,h_1600,q_85,f_jpg');
  assert.equal(modelImageTransformation({ MODEL_IMAGE_MAX_SIDE: '1024' }), 'c_limit,w_1024,h_1024,q_85,f_jpg');
  assert.equal(modelImageTransformation({ MODEL_IMAGE_MAX_SIDE: '99999' }), 'c_limit,w_1600,h_1600,q_85,f_jpg');
  const transformation = modelImageTransformation({});
  assert.equal(signedPhotoUrl(photo, env, transformation).href, `https://res.cloudinary.com/test-cloud/image/authenticated/s--${sign(transformation + '/yumetrics/abc-123.jpg')}--/${transformation}/v17/yumetrics/abc-123.jpg`);
  assert.equal(signedPhotoUrl(photo, env).href, `https://res.cloudinary.com/test-cloud/image/authenticated/s--${sign('yumetrics/abc-123.jpg')}--/v17/yumetrics/abc-123.jpg`);
  assert.throws(() => signedPhotoUrl(photo, env, 'c_limit/../x'));
});

test('a failed derived copy falls back to the stored original instead of failing the analysis', async () => {
  const calls = [];
  const data = await storedPhotoData(photo, async url => { calls.push(url); return url.includes('c_limit') ? new Response('nope', { status: 420 }) : new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } }); }, env, { transformation: modelImageTransformation({}) });
  assert.ok(data.startsWith('data:image/jpeg;base64,'));
  assert.equal(calls.length, 2); assert.ok(calls[0].includes('/c_limit,w_1600,h_1600,q_85,f_jpg/')); assert.ok(!calls[1].includes('c_limit'));
});
