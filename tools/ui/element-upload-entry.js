import {createApp,h,ref} from 'vue';
import {ElUpload} from 'element-plus/es/components/upload/index.mjs';
import {ElConfigProvider} from 'element-plus/es/components/config-provider/index.mjs';
import zhCn from 'element-plus/es/locale/lang/zh-cn.mjs';
import 'element-plus/es/components/upload/style/css.mjs';

// A small Vue island. The host page owns persistence and validation; click and drop
// both enter ElUpload's selection flow, with no duplicate native file control.
window.InclassUpload={mount(container,options){
 let disposed=false,timer=null,pending=[];
 const list=ref(options.files||[]),disabled=ref(false);
 const app=createApp({setup(){
  async function flush(){timer=null;const files=pending;pending=[];if(disposed||!files.length)return;disabled.value=true;
   try{await options.onSelect(files);}catch(error){options.onError?.(error.message);}
   finally{if(!disposed){list.value=options.getFiles();disabled.value=false;}}
  }
  const icon=h('svg',{viewBox:'0 0 24 24',width:40,height:40,fill:'none',stroke:'currentColor','stroke-width':1.5,'aria-hidden':'true'},[h('path',{d:'M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5'})]);
  return ()=>h(ElConfigProvider,{locale:zhCn},{default:()=>h(ElUpload,{
   drag:true,multiple:options.multiple??true,autoUpload:false,limit:options.limit??12,disabled:disabled.value,
   accept:options.accept||'.pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg',fileList:list.value,
   'onUpdate:fileList':files=>{list.value=files;},
   onChange:file=>{if(file.status==='ready'&&file.raw){pending.push(file.raw);clearTimeout(timer);timer=setTimeout(flush,0);}},
   onExceed:()=>options.onError(options.exceedText||'最多上传12份参考资料，请先移除不需要的文件。'),
   onPreview:file=>options.onPreview?.(file),
   beforeRemove:async file=>{if(disabled.value)return false;disabled.value=true;try{await options.onRemove(file);}catch(error){options.onError?.(error.message);}finally{if(!disposed)disabled.value=false;}return false;}
  },{default:()=>[h('div',{class:'reference-upload-icon'},[icon]),h('div',{class:'el-upload__text'},[options.label||'将参考资料拖到此处，或',h('em','点击上传')]),h('div',{class:'reference-upload-types'},options.types||'PDF、Word、PPTX、文本、图片 · 每份不超过20MB，最多12份')]})});
 }});
 app.mount(container);
 return ()=>{disposed=true;clearTimeout(timer);app.unmount();};
}};
