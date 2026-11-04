(()=>{
 const ID='inc.thebigtree.ziprunner.review',CHANNEL='tavi.extension/v1';
 const byId=id=>document.getElementById(id),pending=new Map();let next=0,epoch=0,ready=false,connection=null,busy=false;
 function status(text){byId('status').textContent=text;}
 function clearLocal(){epoch++;connection=null;byId('model').hidden=true;byId('detail-section').hidden=true;for(const id of ['jobs','projects','detail','workload'])byId(id).replaceChildren();byId('connection').textContent='Locked. Load your ZipRunner web-connection authentication file inside Tavi.';byId('refresh').disabled=byId('disconnect').disabled=true;}
 function request(method,args={}){
  if(window.parent===window)return Promise.reject(Error('Open this extension inside Tavi'));
  return new Promise((resolve,reject)=>{
   const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Tavi host unavailable'));},12000);
   pending.set(id,{resolve,reject,timer});window.parent.postMessage({channel:CHANNEL,direction:'request',id,method,...args},'*');
  });
 }
 window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.data?.channel!==CHANNEL||event.data.direction!=='response')return;
  const item=pending.get(event.data.id);if(!item)return;pending.delete(event.data.id);clearTimeout(item.timer);
  event.data.ok?item.resolve(event.data.result):item.reject(Error(event.data.error||'Tavi request rejected'));
 });
 function cell(row,value){const td=document.createElement('td');td.textContent=String(value??'—');row.append(td);return td;}
 function render(data){
  const queue=data.build_queue||{},active=queue.active||[],queued=queue.queued||[];
  byId('workload').textContent=`${active.length} active · ${queued.length} waiting · ${queue.cached_jobs||0} cached jobs (${Number(queue.cached_bytes||0).toLocaleString()} bytes of work state)`;
  byId('jobs').replaceChildren();for(const [kind,rows] of [['Active',active],['Waiting',queued],['Needs review',queue.needs_review||[]],['Recent',queue.recent||[]]])for(const job of rows){const tr=document.createElement('tr');cell(tr,job.project);cell(tr,kind);cell(tr,job.stage);byId('jobs').append(tr);}
  byId('projects').replaceChildren();for(const project of data.projects||[]){const tr=document.createElement('tr');cell(tr,project.key);cell(tr,project.version);cell(tr,project.build_state);cell(tr,`${project.qa_state} · ${project.qa_passed||0} passed / ${project.qa_failed||0} failed`);const td=cell(tr,'');const button=document.createElement('button');button.textContent='Review';button.onclick=()=>detail(project.key);td.append(button);byId('projects').append(tr);}
  byId('model').hidden=false;
 }
 async function detail(project){const current=epoch;try{const data=await request('ziprunner.review',{project});if(current!==epoch||!connection)return;byId('detail').textContent=JSON.stringify(data,null,2);byId('detail-section').hidden=false;}catch{if(current===epoch){clearLocal();status('Connection unavailable. Load a current authentication file.');}}}
 async function refresh(){if(!ready||!connection||busy)return;const current=epoch;busy=true;try{const data=await request('ziprunner.review');if(current!==epoch||!connection)return;render(data);status('Updated. Read-only review.');}catch{if(current===epoch){clearLocal();status('Authorization unavailable. Load a current authentication file.');}}finally{busy=false;}}
 byId('credential').onchange=async event=>{
  const file=event.target.files?.[0];event.target.value='';clearLocal();const current=epoch;if(!file||!ready)return;
  status('Validating the selected authentication file…');let bytes;
  try{
   if(file.size>16384)throw Error('Authentication file is too large');
   await request('ziprunner.clear');bytes=new Uint8Array(await file.arrayBuffer());
   if(current!==epoch)return;
   const result=await request('ziprunner.importCredential',{bytes:Array.from(bytes)});
   if(current!==epoch)return;
   connection={origin:result.origin,expires:result.expires};byId('connection').textContent=`Connected to ${result.origin} · file expires ${new Date(result.expires*1000).toLocaleString()}`;
   byId('refresh').disabled=byId('disconnect').disabled=false;render(result.data);status('Authentication file accepted. Read-only review.');
  }catch{if(current===epoch){clearLocal();status('File not accepted. Use a current .zrmobile web-connection file and the matching ZipRunner server.');}}
  finally{bytes?.fill(0);}
 };
 byId('refresh').onclick=refresh;
 byId('disconnect').onclick=()=>{clearLocal();status('Connection cleared.');request('ziprunner.clear').catch(()=>{});};
 setInterval(()=>{if(connection&&Date.now()>=connection.expires*1000){clearLocal();status('Authentication file expired.');request('ziprunner.clear').catch(()=>{});}},1000);
 setInterval(refresh,30000);
 window.addEventListener('pagehide',()=>{clearLocal();request('ziprunner.clear').catch(()=>{});});
 request('host.info').then(info=>{if(info.extensionId!==ID||info.standard!=='tavix/1.0'||!info.features?.includes('ziprunner.review/v1'))throw Error('Unsupported host');ready=true;byId('credential').disabled=false;clearLocal();status('Load your ZipRunner authentication file to begin.');}).catch(()=>{clearLocal();status('Requires Tavi 0.3.119 or later with the ZipRunner review bridge.');});
})();
