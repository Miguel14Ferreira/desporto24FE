import {copyFileSync,existsSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const source=resolve('src/.well-known/assetlinks.json');
const output=resolve('dist/desporto24/.well-known/assetlinks.json');
const expectedPackage='com.jynlo.app';
const expectedFingerprint='21:11:17:14:2E:29:3C:87:EF:AF:75:9B:E9:60:0D:F1:13:07:C9:F1:62:6F:7D:00:BE:87:BF:97:EF:20:8E:DF';
const entries=JSON.parse(readFileSync(source,'utf8'));
if(!Array.isArray(entries)||!entries.some(entry=>
  entry?.relation?.includes('delegate_permission/common.handle_all_urls') &&
  entry?.target?.namespace==='android_app' &&
  entry?.target?.package_name===expectedPackage &&
  entry?.target?.sha256_cert_fingerprints?.includes(expectedFingerprint)
))throw new Error('Android assetlinks.json não contém a associação verificada da Jynlo');
if(!existsSync(resolve('dist/desporto24/index.html')))
 throw new Error('A pasta de publicação Angular ainda não existe');
mkdirSync(resolve('dist/desporto24/.well-known'),{recursive:true});
copyFileSync(source,output);
console.log('Android Digital Asset Links incluído no diretório publicado');
