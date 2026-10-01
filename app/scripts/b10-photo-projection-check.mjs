import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {photoRegistryProjection} from './photo-registry-plugin.ts';
// Execute the actual compiled registry, both with and without the B10 build transform.
// Compare every exposed field of all images and the synchronous API, including embedded images.
async function registry(projected){
 const result=await build({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,logLevel:'error',
  plugins:projected?[photoRegistryProjection()]:[],
  build:{write:false,minify:true,lib:{entry:fileURLToPath(new URL('../src/data/place-images.ts',import.meta.url)),formats:['es']}}});
 const chunk=(Array.isArray(result)?result[0]:result).output.find(c=>c.type==='chunk');
 return import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
}
const original=await registry(false),projected=await registry(true);
assert.deepEqual(projected.placeImages,original.placeImages);
const ids=Object.keys(original.placeImages);
for(const id of [...ids,'missing-place']){
 for(const embedded of [undefined,[],[{url:'local/embedded.webp',alt:'Embedded',credit:'Preserved'}]])
  assert.deepEqual(projected.resolvePlaceImages(id,embedded),original.resolvePlaceImages(id,embedded));
}
assert.equal(projected.CARD_IMAGE_WIDTH,original.CARD_IMAGE_WIDTH);
for(const images of Object.values(original.placeImages))for(const image of images){
 assert.equal(projected.cardImageUrl(image.url),original.cardImageUrl(image.url));

}
console.log(`B10 projection PASS: ${ids.length} places / ${Object.values(original.placeImages).flat().length} images; exact registry, embedded, missing, card API preserved.`);
