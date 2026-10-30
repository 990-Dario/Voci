import {env,rpc} from '../_shared/server.ts';

function base64url(text: string) {
  return btoa(Array.from(new TextEncoder().encode(text),b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
Deno.serve(async(request: Request)=>{
  if(request.method!=='POST')return new Response('POST required',{status:405});
  if(request.headers.get('authorization')!==`Bearer ${env('VOCI_MAIL_WORKER_SECRET')}`)return new Response('Unauthorized',{status:401});
  try {
    // A refresh token must have been explicitly authorized by the sender account.
    const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:env('GMAIL_CLIENT_ID'),client_secret:env('GMAIL_CLIENT_SECRET'),refresh_token:env('GMAIL_REFRESH_TOKEN')}),signal:AbortSignal.timeout(15000)});
    const token=await tokenResponse.json();
    if(!tokenResponse.ok||!token.access_token)throw new Error('Gmail authorization failed');
    const messages=await rpc('voci_claim_mail',{batch_size:10});let sent=0;
    for(const mail of messages) {
      try {
        if(!/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(mail.email))throw new Error('Invalid recipient');
        const encodedSubject=btoa(Array.from(new TextEncoder().encode(mail.subject),(b:number)=>String.fromCharCode(b)).join(''));
        const content=`From: Voci <fuerschule65@gmail.com>\r\nTo: ${mail.email}\r\nSubject: =?UTF-8?B?${encodedSubject}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${mail.body}\r\n\r\n${env('VOCI_APP_URL')}\r\nOptionale E-Mails kannst du in Voci unter Konto einzeln ausschalten.`;
        const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:base64url(content)}),signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error(`Gmail rejected message (${response.status})`);
        await rpc('voci_finish_mail',{mail_id:mail.id,failure:null});sent++;
      } catch {await rpc('voci_finish_mail',{mail_id:mail.id,failure:'Versand fehlgeschlagen; erneuter Versuch nach Ablauf der Reservierung.'});}
    }
    return Response.json({sent});
  } catch {return Response.json({error:'E-Mail-Versand nicht bereit.'},{status:503});}
});
