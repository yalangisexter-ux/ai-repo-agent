const $=id=>document.getElementById(id);
const state={files:[],loaded:{},actions:[],repo:"",branch:""};

const sourceExt=new Set(["py","js","mjs","cjs","ts","tsx","jsx","java","kt","kts","swift","go","rs","rb","php","c","h","cc","cpp","cxx","hpp","cs","dart","scala","sh","bash","zsh","fish","html","htm","css","scss","sass","less","xml","svg","json","jsonc","yaml","yml","toml","ini","cfg","conf","properties","gradle","md","txt","sql","graphql","gql","proto"]);
function isTextPath(p){
  const base=p.split("/").pop().toLowerCase();
  if(["dockerfile","makefile",".gitignore",".gitattributes",".editorconfig"].includes(base)) return true;
  const i=base.lastIndexOf(".");
  return i>0 && sourceExt.has(base.slice(i+1));
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function apiHeaders(token){return {"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28"};}
function parseRepo(){
  const v=$("repo").value.trim().replace(/^https?:\/\/github\.com\//,"").replace(/\/$/,"");
  const m=v.match(/^([^/]+)\/([^/]+)$/); if(!m) throw new Error("Repository must be owner/repository");
  return {owner:m[1],repo:m[2]};
}
async function gh(url,opt={}){
  const worker=$("workerUrl").value.trim();
  let target=url, headers={...(opt.headers||{})};
  if(worker){
    target=worker.replace(/\/$/,"")+"/github?url="+encodeURIComponent(url);
  }else{
    const token=$("githubToken").value.trim(); if(!token) throw new Error("GitHub token is required");
    headers={...apiHeaders(token),...headers};
  }
  const r=await fetch(target,{...opt,headers});
  const t=await r.text(); let d; try{d=JSON.parse(t)}catch{d=t}
  if(!r.ok) throw new Error("GitHub "+r.status+": "+(d.message||d.error||t));
  return d;
}
function saveSettings(){
  localStorage.setItem("repoAgentRepo",$("repo").value);
  localStorage.setItem("repoAgentBranch",$("branch").value);
  localStorage.setItem("repoAgentModel",$("model").value);
  localStorage.setItem("repoAgentWorker",$("workerUrl").value.trim());
}
function loadSettings(){
  $("repo").value=localStorage.getItem("repoAgentRepo")||"";
  $("branch").value=localStorage.getItem("repoAgentBranch")||"main";
  $("model").value=localStorage.getItem("repoAgentModel")||"minimax/minimax-m3:free";
  $("workerUrl").value=localStorage.getItem("repoAgentWorker")||"";
}
async function loadRepo(){
  try{
    saveSettings(); const {owner,repo}=parseRepo(); state.repo=repo; state.branch=$("branch").value.trim()||"main";
    $("status").textContent="Loading repository tree…"; $("files").innerHTML="";
    const branch=encodeURIComponent(state.branch);
    const tree=await gh(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    const candidates=tree.tree.filter(x=>x.type==="blob"&&isTextPath(x.path));
    state.files=[]; state.loaded={};
    $("status").textContent=`Found ${candidates.length} source/config files. Loading…`;
    for(let i=0;i<candidates.length;i++){
      const x=candidates[i];
      const blob=await gh(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${x.sha}`);
      if(blob.encoding!=="base64") continue;
      const bin=atob(blob.content.replace(/\s/g,""));
      if(bin.includes("\0")) continue;
      const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
      const text=new TextDecoder().decode(bytes);
      state.files.push({path:x.path,sha:x.sha,size:x.size,content:text});
      state.loaded[x.path]=text;
    }
    renderFiles(); setButtons(true);
    $("status").textContent=`Loaded ${state.files.length} source/config files. Select files for the agent.`;
  }catch(e){$("status").textContent=e.message}
}
function renderFiles(){
  $("files").innerHTML=state.files.map((f,i)=>`<label class="file"><input type="checkbox" data-i="${i}"><span>${esc(f.path)} <span class="badge">${f.size} B</span></span></label>`).join("");
}
function setButtons(on){$("selectAll").disabled=!on;$("clear").disabled=!on;$("analyze").disabled=!on}
function selected(){
  return [...$("files").querySelectorAll("input:checked")].map(x=>state.files[+x.dataset.i]);
}
$("selectAll").onclick=()=>{$("files").querySelectorAll("input").forEach(x=>x.checked=true)};
$("clear").onclick=()=>{$("files").querySelectorAll("input").forEach(x=>x.checked=false)};
async function openRouter(messages){
  const worker=$("workerUrl").value.trim();
  const model=$("model").value.trim(); if(!model) throw new Error("OpenRouter model is required");
  const payload={model,messages,temperature:0.1,response_format:{type:"json_object"}};
  let r;
  if(worker){
    r=await fetch(worker.replace(/\/$/,"")+"/ai",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
    });
  }else{
    const key=$("openrouterKey").value.trim(); if(!key) throw new Error("OpenRouter API key is required");
    r=await fetch("https://openrouter.ai/api/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+key,"HTTP-Referer":location.href,"X-Title":"AI Repo Agent"},
      body:JSON.stringify(payload)
    });
  }
  const t=await r.text(); let d; try{d=JSON.parse(t)}catch{d={}};
  if(!r.ok) throw new Error("OpenRouter "+r.status+": "+(d.error?.message||d.message||t));
  const content=d.choices?.[0]?.message?.content;
  if(!content) throw new Error("OpenRouter returned no content");
  try{return JSON.parse(content)}catch{throw new Error("Model did not return valid JSON")}
}
function promptFor(files){
  const bundle=files.map(f=>`\n--- FILE: ${f.path} ---\n${f.content}`).join("\n");
  return `You are a repository coding agent. Analyze the supplied files and propose only necessary changes to improve correctness, reliability, security, maintainability, or requested behavior. Return ONLY valid JSON with this shape:
{"summary":"...","actions":[{"type":"modify|create|delete","path":"relative/path","reason":"...","content":"complete file contents for modify/create; omit content for delete"}],"validation":["test or validation steps"]}.
Rules: preserve unrelated behavior; use relative POSIX paths; never use absolute paths or ..; do not invent files unless needed; for modify, content must be the COMPLETE replacement file; delete only when clearly justified. Do not claim tests were run. If no change is justified, actions must be [].
FILES:${bundle}`;
}
function validateActions(a){
  if(!a||!Array.isArray(a.actions)) throw new Error("Invalid agent response: missing actions");
  for(const x of a.actions){
    if(!["modify","create","delete"].includes(x.type)||!x.path) throw new Error("Invalid action");
    if(x.path.startsWith("/")||x.path.includes("..")||x.path.includes("\\")||x.path.includes("\0")) throw new Error("Unsafe path: "+x.path);
    if(x.type==="delete"&&!state.loaded[x.path]) throw new Error("Refusing to delete unloaded file: "+x.path);
    if((x.type==="modify"||x.type==="create")&&typeof x.content!=="string") throw new Error("Missing complete content for "+x.path);
  }
}
async function analyze(){
  const files=selected(); if(!files.length){$("status").textContent="Select at least one file.";return}
  try{
    $("analyze").disabled=true; $("status").textContent="OpenRouter is analyzing…";
    state.actions=[]; const a=await openRouter([{role:"system",content:"You are a careful software engineer. Output JSON only."},{role:"user",content:promptFor(files)}]);
    validateActions(a); state.actions=a.actions;
    renderReview(a); $("reviewCard").classList.remove("hidden");
    $("status").textContent=`Plan ready: ${state.actions.length} proposed change(s).`;
  }catch(e){$("status").textContent=e.message}finally{$("analyze").disabled=false}
}
function renderReview(a){
  const html=`<p><b>Summary:</b> ${esc(a.summary||"No summary")}</p>
  <p class="muted">Validation plan: ${esc((a.validation||[]).join(" · ")||"No validation plan")}</p>
  ${a.actions.map((x,i)=>`<div class="change ${x.type}"><b>${esc(x.type.toUpperCase())}</b> — ${esc(x.path)}<p>${esc(x.reason||"")}</p><details><summary>Proposed content</summary>${x.content?`<pre>${esc(x.content)}</pre>`:"<p class='muted'>File will be deleted.</p>"}</details></div>`).join("")}
  <p class="muted">Review the proposed changes before committing. A backup branch is created first.</p>`;
  $("review").innerHTML=html;
}
async function commit(){
  if(!state.actions.length){$("status").textContent="No changes to commit.";return}
  try{
    const {owner,repo}=parseRepo(), branch=state.branch, base=await gh(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const baseSha=base.object.sha, commitObj=await gh(`https://api.github.com/repos/${owner}/${repo}/git/commits/${baseSha}`);
    const backup=`ai-agent-backup/${branch.replace(/[^A-Za-z0-9._/-]/g,"-")}-${Date.now()}`;
    await gh(`https://api.github.com/repos/${owner}/${repo}/git/refs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ref:"refs/heads/"+backup,sha:baseSha})});
    $("status").textContent=`Backup created: ${backup}. Creating commit…`;
    const blobs={};
    for(const a of state.actions){
      if(a.type==="delete") continue;
      const b=await gh(`https://api.github.com/repos/${owner}/${repo}/git/blobs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:a.content,encoding:"utf-8"})});
      blobs[a.path]=b.sha;
    }
    const treeItems=Object.entries(blobs).map(([path,sha])=>({path,mode:"100644",type:"blob",sha}));
    for(const a of state.actions.filter(x=>x.type==="delete")) treeItems.push({path:a.path,mode:"100644",type:"blob",sha:null});
    const tree=await gh(`https://api.github.com/repos/${owner}/${repo}/git/trees`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({base_tree:commitObj.tree.sha,tree:treeItems})});
    const newCommit=await gh(`https://api.github.com/repos/${owner}/${repo}/git/commits`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"AI Repo Agent: apply approved changes",tree:tree.sha,parents:[baseSha]})});
    await gh(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha:newCommit.sha,force:false})});
    $("status").textContent=`Committed successfully. Backup: ${backup}`;
  }catch(e){$("status").textContent=e.message}
}

function addChat(role,text){
  const div=document.createElement("div");
  div.className="msg "+(role==="user"?"user":"agent");
  if(role==="agent"){
    const h=document.createElement("h3"); h.textContent="AI Repo Agent"; div.appendChild(h);
  }
  const p=document.createElement("div"); p.textContent=text; div.appendChild(p);
  $("chat").appendChild(div); $("chat").scrollTop=$("chat").scrollHeight;
}
function selectedOrRelevant(){
  const s=selected();
  if(s.length) return s;
  return state.files.slice(0,60);
}
async function sendPrompt(){
  const prompt=$("prompt").value.trim();
  if(!prompt){return}
  if(!state.files.length){
    addChat("agent","Load a GitHub repository first so I can inspect its files.");
    return;
  }
  addChat("user",prompt);
  $("sendPrompt").disabled=true;
  $("status").textContent="Agent is thinking…";
  try{
    const files=selectedOrRelevant();
    const context=files.map(f=>`\n--- FILE: ${f.path} ---\n${f.content}`).join("\n");
    const instruction=`You are an interactive repository coding agent. The user has given you a request.
Analyze the supplied repository files in context of the request.

Return ONLY valid JSON:
{
  "reply":"A concise natural-language answer to the user, including findings and suggestions.",
  "summary":"Short change summary",
  "actions":[
    {"type":"modify|create|delete","path":"relative/path","reason":"why","content":"COMPLETE file content for modify/create"}
  ],
  "validation":["specific tests/checks to run"]
}

Rules:
- Follow the user's request.
- If they only ask a question or suggestions, actions may be [].
- If proposing code changes, provide complete replacement content.
- Use relative POSIX paths only; never absolute paths or .. .
- Do not claim tests were executed.
- Preserve unrelated behavior.
USER REQUEST:
${prompt}

REPOSITORY FILES:
${context}`;
    const a=await openRouter([
      {role:"system",content:"You are a careful senior software engineer and repository agent. JSON only."},
      {role:"user",content:instruction}
    ]);
    validateActions({actions:a.actions||[]});
    if(a.reply) addChat("agent",a.reply);
    if(a.summary) addChat("agent","Proposed plan: "+a.summary);
    if(Array.isArray(a.validation)&&a.validation.length) addChat("agent","Validation plan:\n• "+a.validation.join("\n• "));
    state.actions=a.actions||[];
    if(state.actions.length){
      renderReview({summary:a.summary||"Changes proposed from your request.",actions:state.actions,validation:a.validation||[]});
      $("reviewCard").classList.remove("hidden");
    } else {
      $("reviewCard").classList.add("hidden");
    }
    $("status").textContent=state.actions.length?`${state.actions.length} proposed change(s) ready for review.`:"No file changes proposed.";
    $("prompt").value="";
  }catch(e){
    addChat("agent","Error: "+e.message);
    $("status").textContent=e.message;
  }finally{
    $("sendPrompt").disabled=false;
  }
}
$("sendPrompt").onclick=sendPrompt;
$("clearChat").onclick=()=>{$("chat").innerHTML=""};
$("prompt").addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key==="Enter") sendPrompt();
});

$("load").onclick=loadRepo;
$("analyze").onclick=analyze;
$("commit").onclick=commit;
loadSettings();
