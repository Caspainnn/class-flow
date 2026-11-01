'use strict';
const assert=require('node:assert/strict'),{recommend,features,distance}=require('../server/ppt/layout-similarity');
const box=(kind,x,y,w,h)=>({kind,x,y,w,h}),header=box('title',.06,.06,.88,.10);
const layouts=[
 [box('title',.15,.3,.7,.2),box('text',.25,.6,.5,.12)],
 [header,box('text',.08,.24,.84,.58)],
 [header,box('text',.08,.24,.39,.58),box('text',.53,.24,.39,.58)],
 [header,box('text',.06,.24,.26,.58),box('text',.37,.24,.26,.58),box('text',.68,.24,.26,.58)],
 [header,box('image',.08,.24,.4,.58),box('text',.55,.24,.36,.58)],
 [header,box('table',.08,.24,.84,.58)],
 [header,box('chart',.08,.24,.84,.58)]
];
const groups=layouts.flatMap((shapes,i)=>Array.from({length:4},(_,j)=>({id:`layout-${i}-${j}`,name:'Layout',representativeSlide:i*4+j+1,sourceSlides:[i*4+j+1],style:['different text-run styling '+j],shapes:shapes.map(s=>({...s,x:s.x+j*.001,y:s.y+j*.001})).concat(j?[box('line',0,.99,1,.001)]:[])})));
const result=recommend(groups);assert.equal(result.representatives.length,layouts.length);const covered=result.representatives.flatMap(r=>r.sourceSlides).sort((a,b)=>a-b);assert.deepEqual(covered,Array.from({length:28},(_,i)=>i+1));
for(let i=0;i<layouts.length;i++){const representative=result.representatives.find(r=>r.candidateIds.includes(`layout-${i}-0`));assert.equal(representative.candidateIds.length,4);assert.ok(representative.candidateIds.every(id=>id.startsWith(`layout-${i}-`)));}
assert.equal(distance(features(groups[0]),features({...groups[0],shapes:[...groups[0].shapes].reverse()})),0);
assert.deepEqual(recommend(groups),result);assert.equal(recommend([]).selectedIds.length,0);assert.equal(recommend([{id:'unknown1',representativeSlide:1,sourceSlides:[1],shapes:[]},{id:'unknown2',representativeSlide:2,sourceSlides:[2],shapes:[]}]).selectedIds.length,2);
const a=features(groups[0]),b=features(groups[4]);assert.equal(distance(a,b),distance(b,a));
 const panels=[2,3].map(n=>({id:'panels-'+n,representativeSlide:n,sourceSlides:[n],shapes:[header,...Array.from({length:n},(_,j)=>box('shape',.05+j*(.9/n),.24,.8/n,.58))]}));assert.equal(recommend(panels).selectedIds.length,2,'blank body panels must distinguish two and three columns even when a title exists');
 assert.equal(recommend([1,2].map(n=>({id:'unknown-group-'+n,representativeSlide:n,sourceSlides:[n],shapes:[header,box('group-'+n,.1,.2,.8,.6)]}))).selectedIds.length,2);
console.log('PASS: near layouts merge despite style/position/decorative noise; cover, one/two/three columns, image, table and chart retained; complete coverage, deterministic selection, unknown geometry conservative');
