// NFR-06 ачааллын шалгалт: 10 зэрэг сесс, нийт 100 хүсэлт илгээж p50/p95 хугацааг хэмжинэ.
// Хэрэглээ: сервер ажиллаж байхад (жишээ өгөгдөлтэй)  node scripts/load-test.js
// Анхаар: туршилтын 100 хүсэлт өгөгдлийн санд нэмэгдэнэ — дараа нь npm run db:seed
const B='http://localhost:3000/api';
(async()=>{
 const sessions=[];
 for(let i=0;i<10;i++){const r=await fetch(B+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:'99000001',password:'Demo12345'})});sessions.push(r.headers.get('set-cookie').split(';')[0]);}
 const addr=(await (await fetch(B+'/addresses',{headers:{cookie:sessions[0]}})).json());
 const a=Array.isArray(addr)?addr[0].id:1;
 const times=[];let ok=0,bad=0;
 async function worker(i){for(let k=0;k<10;k++){const t=performance.now();
   const r=await fetch(B+'/requests',{method:'POST',headers:{'content-type':'application/json',cookie:sessions[i],'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({addressId:a,wasteTypeId:1,description:'ачаалал '+i+'-'+k})});
   times.push(performance.now()-t); r.status===201?ok++:(bad++,console.log(r.status,await r.text()));}}
 const t0=performance.now(); await Promise.all([...Array(10).keys()].map(worker)); const tot=performance.now()-t0;
 times.sort((x,y)=>x-y); const p=q=>times[Math.ceil(q*times.length)-1].toFixed(0);
 console.log(`илгээлт=${times.length} амжилттай=${ok} алдаа=${bad} нийт=${(tot/1000).toFixed(2)}s p50=${p(.5)}ms p95=${p(.95)}ms max=${p(1)}ms`);
})();
