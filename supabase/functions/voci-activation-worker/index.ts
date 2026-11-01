import {env,rpc} from '../_shared/server.ts';
import {processActivation} from '../_shared/activation.ts';

Deno.serve(async(request:Request)=>{
  if(request.method!=='POST')return new Response('POST required',{status:405});
  if(request.headers.get('authorization')!==`Bearer ${env('VOCI_ACTIVATION_WORKER_SECRET')}`)return new Response('Unauthorized',{status:401});
  try {
    const jobs=await rpc('voci_claim_activations',{batch_size:5});let processed=0;
    for(const job of jobs){
      const outcome=await processActivation(job);
      await rpc('voci_finish_activation',{school_id:job.school_id,outcome:{...outcome,lease_id:job.lease_id}});processed++;
    }
    return Response.json({processed});
  } catch {return Response.json({error:'Aktivierung konnte nicht vollständig bestätigt werden.'},{status:503});}
});
