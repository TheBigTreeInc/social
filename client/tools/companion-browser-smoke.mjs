/** Optional Chromium browser-level post-source check. Requires local chromium.
 * No account or network access: self-contained HTTP server on loopback.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const shell=process.env.CHROMIUM_BIN||(process.platform==='win32'?`${process.env.PROGRAMFILES||'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`:'/usr/bin/chromium');
const mimetype={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=createServer(async(req,res)=>{
 try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mimetype[extname(path)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 const url=`http://127.0.0.1:${server.address().port}/client/tests/browser/companion-preview-086.html`;
 const cmd=spawn(shell,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--virtual-time-budget=5000','--dump-dom',url],{stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';cmd.stdout.on('data',v=>stdout+=v.toString());cmd.stderr.on('data',v=>stderr+=v.toString());
 const status=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cmd.kill('SIGKILL');reject(Error('Chromium did not complete the local browser test in 15 seconds'));},15000);cmd.on('error',error=>{clearTimeout(timer);reject(error)});cmd.on('exit',code=>{clearTimeout(timer);resolve(code)});});
 if(status!==0||!stdout.includes('data-result="PASS"'))throw Error(`Browser Companion iframe smoke failed (${status}): ${stdout.slice(-900)} ${stderr.slice(-500)}`);
 console.log('TAVI_COMPANION_BROWSER_PASS: sandboxed iframe published painted 80px preview, saved scoped image, and returned Home');
}finally{server.close();}
