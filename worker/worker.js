/**
 * AI Repo Agent — Cloudflare Worker proxy
 *
 * Deploy this Worker and set secrets:
 *   OPENROUTER_API_KEY
 *   GITHUB_TOKEN
 *
 * The PWA can POST:
 *   /ai       -> OpenRouter
 *   /github   -> GitHub API proxy
 *
 * Keep CORS restricted to your GitHub Pages origin in production.
 */
const ALLOWED_ORIGIN = "https://yalangisexter-ux.github.io";

function cors(request) {
  const origin = request.headers.get("Origin") || "";
  const allow = origin === ALLOWED_ORIGIN || origin === "http://localhost:8787";
  return {
    "Access-Control-Allow-Origin": allow ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GitHub-Api-Version, Accept",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Vary": "Origin"
  };
}

function response(body, status, request, extra={}) {
  return new Response(body, {
    status,
    headers: {
      ...cors(request),
      "Content-Type": "application/json; charset=utf-8",
      ...extra
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS")
      return new Response(null, {status:204, headers:cors(request)});

    const url = new URL(request.url);

    try {
      if (url.pathname === "/ai") {
        if (request.method !== "POST") return response(JSON.stringify({error:"POST required"}),405,request);
        if (!env.OPENROUTER_API_KEY) return response(JSON.stringify({error:"OPENROUTER_API_KEY secret is not configured"}),500,request);

        const payload = await request.json();
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            "Authorization":`Bearer ${env.OPENROUTER_API_KEY}`,
            "HTTP-Referer":ALLOWED_ORIGIN,
            "X-Title":"AI Repo Agent"
          },
          body:JSON.stringify(payload)
        });
        return response(await r.text(),r.status,request);
      }

      if (url.pathname === "/github") {
        if (!env.GITHUB_TOKEN) return response(JSON.stringify({error:"GITHUB_TOKEN secret is not configured"}),500,request);

        const target = url.searchParams.get("url");
        if (!target || !target.startsWith("https://api.github.com/"))
          return response(JSON.stringify({error:"url must be a GitHub API URL"}),400,request);

        const headers = new Headers(request.headers);
        headers.set("Authorization",`Bearer ${env.GITHUB_TOKEN}`);
        headers.set("Accept","application/vnd.github+json");
        headers.set("X-GitHub-Api-Version","2022-11-28");
        headers.delete("Host");
        headers.delete("Origin");

        const body = ["GET","HEAD"].includes(request.method) ? undefined : await request.text();
        const r = await fetch(target,{method:request.method,headers,body});
        return response(await r.text(),r.status,request);
      }

      return response(JSON.stringify({
        ok:true,
        service:"AI Repo Agent Worker",
        routes:["POST /ai","GET|POST|PATCH|DELETE /github?url=https://api.github.com/..."]
      }),200,request);
    } catch (e) {
      return response(JSON.stringify({error:e.message || String(e)}),500,request);
    }
  }
};
