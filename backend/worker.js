// MAX AI 5.0 — Cloudflare Worker (backend privado)
// Segredos: GEMINI_API_KEY e MAX_ACCESS_TOKEN (nunca no GitHub).
const ORIGIN = "https://mateusc7eber.github.io";
const MODEL = "gemini-2.5-flash";
function headers(origin) {
  return {"Access-Control-Allow-Origin":origin===ORIGIN?ORIGIN:"null","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Vary":"Origin","Cache-Control":"no-store"};
}
export default {
  async fetch(request, env) {
    const origin=request.headers.get("Origin")||"";
    if(origin!==ORIGIN) return new Response("Origem não autorizada",{status:403});
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:headers(origin)});
    if(request.method!=="POST") return new Response("Método inválido",{status:405,headers:headers(origin)});
    const token=request.headers.get("Authorization")||"";
    if(!env.MAX_ACCESS_TOKEN || token!==`Bearer ${env.MAX_ACCESS_TOKEN}`) return new Response("Acesso não autorizado",{status:401,headers:headers(origin)});
    if(!env.GEMINI_API_KEY) return new Response("Serviço não configurado",{status:503,headers:headers(origin)});
    if(Number(request.headers.get("content-length")||0)>12000) return new Response("Mensagem muito grande",{status:413,headers:headers(origin)});
    let data;
    try {data=await request.json()}catch{return new Response("JSON inválido",{status:400,headers:headers(origin)})}
    const message=String(data.message||"").trim().slice(0,1200);
    const history=Array.isArray(data.history)?data.history.slice(-8).filter(x=>x&&["user","model"].includes(x.role)&&typeof x.text==="string").map(x=>({role:x.role,parts:[{text:x.text.slice(0,1200)}]})):[];
    if(!message)return new Response("Mensagem vazia",{status:400,headers:headers(origin)});
    try {
      const upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
        method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
        body:JSON.stringify({systemInstruction:{parts:[{text:"Você é MAX AI, um assistente pessoal cordial, prático e objetivo. Responda em português do Brasil. Não finja executar ações que não executou."}]},contents:[...history,{role:"user",parts:[{text:message}]}],generationConfig:{maxOutputTokens:500,temperature:0.7}})
      });
      if(!upstream.ok)return new Response(JSON.stringify({error:"Falha no serviço de IA",status:upstream.status}),{status:502,headers:{...headers(origin),"Content-Type":"application/json"}});
      const result=await upstream.json();
      const reply=(result.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("").trim()||"Não consegui formular uma resposta.";
      return new Response(JSON.stringify({reply}),{headers:{...headers(origin),"Content-Type":"application/json"}});
    } catch {return new Response(JSON.stringify({error:"Serviço indisponível"}),{status:502,headers:{...headers(origin),"Content-Type":"application/json"}})}
  }
};