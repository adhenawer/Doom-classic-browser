import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';

// Inject transport failures at the origin. Playwright page.route cannot reliably
// intercept requests handled by Service Workers, particularly in WebKit.
export async function contentServer(mount:string, intercept:(path:string,request:IncomingMessage,response:ServerResponse)=>boolean|Promise<boolean>) {
  const root=process.env.QA_DIST ? pathToFileURL(process.env.QA_DIST.replace(/\/$/,'')+'/') : new URL('../../dist/',import.meta.url);
  const server=createServer(async(request,response)=>{
    try {
      const path=new URL(request.url!,'http://localhost').pathname;
      if(!path.startsWith(mount)){response.writeHead(404).end();return;}
      const relative=path.slice(mount.length)||'index.html',file=new URL(relative,root);
      if(!file.href.startsWith(root.href)){response.writeHead(403).end();return;}
      if(await intercept(relative,request,response))return;
      const metadata=await stat(file);
      if(!metadata.isFile()){response.writeHead(404).end();return;}
      const extension=file.pathname.slice(file.pathname.lastIndexOf('.'));
      const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
      response.writeHead(200,{'Content-Type':types[extension]??'application/octet-stream','Content-Length':metadata.size,'Cache-Control':'no-store'});
      const stream=createReadStream(file);stream.on('error',()=>response.destroy());stream.pipe(response);
    } catch {
      if(response.headersSent)response.destroy();else response.writeHead(404).end();
    }
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  return {
    url:`http://127.0.0.1:${(server.address() as {port:number}).port}${mount}`,
    close:()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections();}),
  };
}
