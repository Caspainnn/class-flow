'use strict';
const path=require('node:path'),fs=require('node:fs');
const project=path.resolve(__dirname,'../..'),output=path.join(project,'server/public/vendor');
fs.mkdirSync(output,{recursive:true});
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'element-upload-entry.js')],bundle:true,minify:true,format:'iife',target:['es2020'],outfile:path.join(output,'element-upload.js'),legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'}});
for(const [pkg,name] of [['vue','Vue-LICENSE'],['element-plus','ElementPlus-LICENSE']])fs.copyFileSync(path.join(__dirname,'node_modules',pkg,'LICENSE'),path.join(output,name));
console.log('Built local Vue + Element Plus Upload assets.');
