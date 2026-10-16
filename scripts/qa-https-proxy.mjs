// Local CI transport only: exercises real __Host- secure browser cookies over TLS.
import {createServer} from 'node:https';
import {request} from 'node:http';
import {readFileSync} from 'node:fs';
const server=createServer({key:readFileSync(process.env.QA_TLS_KEY),cert:readFileSync(process.env.QA_TLS_CERT)},(req,res)=>{
 const upstream=request({hostname:'127.0.0.1',port:8080,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https'}},response=>{
  res.writeHead(response.statusCode??502,response.headers);response.pipe(res);
 });
 upstream.on('error',()=>{res.writeHead(502);res.end('Local candidate unavailable');});req.pipe(upstream);
});
server.listen(8443,'127.0.0.1');
