'use strict';
// Geometry only: independent of lesson wording, font-run counts and shape order.
const THRESHOLD=.22;
const area=s=>s.w*s.h;
function features(group){
 let boxes=group.shapes.filter(s=>['title','text','image','table','chart'].includes(s.kind)&&area(s)>.005&&!(s.y>.92&&s.h<.07));
 const panels=group.shapes.filter(s=>s.kind==='shape'&&area(s)>.015&&area(s)<.75&&!boxes.some(b=>{const intersection=Math.max(0,Math.min(s.x+s.w,b.x+b.w)-Math.max(s.x,b.x))*Math.max(0,Math.min(s.y+s.h,b.y+b.h)-Math.max(s.y,b.y));return intersection/(area(s)+area(b)-intersection)>.65;}));
 boxes=boxes.concat(panels);
 boxes=[...boxes].sort((a,b)=>area(b)-area(a));
 boxes=boxes.filter((s,i)=>!boxes.slice(0,i).some(b=>{const intersection=Math.max(0,Math.min(s.x+s.w,b.x+b.w)-Math.max(s.x,b.x))*Math.max(0,Math.min(s.y+s.h,b.y+b.h)-Math.max(s.y,b.y));return b.kind===s.kind&&(intersection/(area(s)+area(b)-intersection)>.7||s.kind==='text'&&intersection/area(s)>.95&&area(b)>area(s)*1.3);})).slice(0,40);
 const grid=new Set();for(const s of boxes)for(let y=0;y<9;y++)for(let x=0;x<16;x++)if((x+.5)/16>=s.x&&(x+.5)/16<=s.x+s.w&&(y+.5)/9>=s.y&&(y+.5)/9<=s.y+s.h)grid.add(`${s.kind}:${x}:${y}`);
 return {boxes,grid,background:group.background,unknown:group.shapes.some(s=>s.kind.startsWith('group-'))};
}
function distance(a,b){
 if(a.unknown||b.unknown||!a.boxes.length||!b.boxes.length)return 1;
 let overlap=0;for(const key of a.grid)if(b.grid.has(key))overlap++;
 const raster=1-overlap/Math.max(1,a.grid.size+b.grid.size-overlap),pairs=[];
 for(let i=0;i<a.boxes.length;i++)for(let j=0;j<b.boxes.length;j++){const x=a.boxes[i],y=b.boxes[j];if(x.kind===y.kind)pairs.push({i,j,cost:Math.min(1,(Math.abs(x.x-y.x)+Math.abs(x.y-y.y)+Math.abs(x.w-y.w)+Math.abs(x.h-y.h))*1.5)});}
 pairs.sort((x,y)=>x.cost-y.cost||x.i-y.i||x.j-y.j);const left=new Set(),right=new Set();let cost=0;for(const p of pairs)if(!left.has(p.i)&&!right.has(p.j)){left.add(p.i);right.add(p.j);cost+=p.cost;}
 const shape=(cost+Math.max(a.boxes.length-left.size,b.boxes.length-right.size))/Math.max(a.boxes.length,b.boxes.length);
 const background=a.background&&b.background&&a.background.toUpperCase()!==b.background.toUpperCase()?.trim()? .25:0;
 return Math.min(1,.55*raster+.45*shape+background);
}
function recommend(groups){
 if(!groups.length)return {algorithm:'geometry-cover-v2',threshold:THRESHOLD,selectedIds:[],representatives:[]};
 const data=groups.map(features),matrix=groups.map(()=>[]);for(let i=0;i<groups.length;i++){matrix[i][i]=0;for(let j=0;j<i;j++)matrix[i][j]=matrix[j][i]=distance(data[i],data[j]);}
 // Start at the weighted medoid, then retain the most different uncovered layout.
 const weights=groups.map(g=>Math.max(1,g.sourceSlides.length)),score=i=>matrix[i].reduce((sum,d,j)=>sum+d*weights[j],0);
 let first=0;for(let i=1;i<groups.length;i++)if(score(i)<score(first))first=i;
 const chosen=[first];while(chosen.length<groups.length){let next=-1,worst=THRESHOLD;for(let i=0;i<groups.length;i++){if(chosen.includes(i))continue;const nearest=Math.min(...chosen.map(j=>matrix[i][j]));if(nearest>worst+1e-9){next=i;worst=nearest;}}if(next<0)break;chosen.push(next);}
 chosen.sort((a,b)=>groups[a].representativeSlide-groups[b].representativeSlide);
 const representatives=chosen.map(i=>({id:groups[i].id,candidateIds:[],sourceSlides:[],minSimilarity:1}));
 for(let i=0;i<groups.length;i++){let at=0;for(let j=1;j<chosen.length;j++)if(matrix[i][chosen[j]]<matrix[i][chosen[at]])at=j;const r=representatives[at];r.candidateIds.push(groups[i].id);r.sourceSlides.push(...groups[i].sourceSlides);r.minSimilarity=Math.min(r.minSimilarity,1-matrix[i][chosen[at]]);}
 for(const r of representatives)r.sourceSlides.sort((a,b)=>a-b);
 return {algorithm:'geometry-cover-v2',threshold:THRESHOLD,selectedIds:representatives.map(r=>r.id),representatives};
}
module.exports={recommend,features,distance};
