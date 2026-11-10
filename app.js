/* Inbox Cleaner AI MVP
 * Gmail OAuth uses Google Identity Services. Configure a Web OAuth Client ID.
 * Classification in this starter is local heuristic triage, not a remote LLM.
 */
const $ = (s) => document.querySelector(s);
let accessToken = null;
let tokenClient = null;
let messages = [];
let selectedIds = new Set();
let includeSpam = false;

const emailsDemonstracao = [
  {
    id: "demo-1",
    remetente: "Ofertas da Loja",
    assunto: "Promoção especial de tênis",
    categoria: "Promoções"
  },
  {
    id: "demo-2",
    remetente: "Banco Exemplo",
    assunto: "Comprovante de pagamento",
    categoria: "Bancos e pagamentos"
  },
  {
    id: "demo-3",
    remetente: "Rede Social",
    assunto: "Novidades da semana",
    categoria: "Redes sociais"
  }
];

const categories = [
  ["Promoções","megaphone","Promoções, newsletters e marketing"],
  ["Empresas","building-2","Comunicados e serviços"],
  ["Redes sociais","users","Alertas de redes sociais"],
  ["Compras e comprovantes","receipt","Pedidos, notas e recibos"],
  ["Bancos e pagamentos","landmark","Assuntos financeiros"],
  ["Pessoais","user","Conversas e contatos"],
  ["Não classificados","folder","Mensagens sem categoria clara"]
];

function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function config(){return localStorage.getItem("inboxCleanerClientId")||""}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

$("#settingsBtn").onclick=()=>{$("#clientId").value=config();$("#includeSpam").checked=includeSpam;$("#settingsDialog").showModal()};
$("#navSettings").onclick=(e)=>{e.preventDefault();$("#settingsBtn").click()};
$("#closeSettings").onclick=()=>$("#settingsDialog").close();
$("#saveSettings").onclick=()=>{localStorage.setItem("inboxCleanerClientId",$("#clientId").value.trim());includeSpam=$("#includeSpam").checked;$("#settingsDialog").close();toast("Configurações salvas neste aparelho.")};

function initGoogle(){
  const id=config();
  if(!id){toast("Adicione seu Google OAuth Client ID em Ajustes.");return}
  if(!window.google?.accounts?.oauth2){toast("O serviço de login do Google ainda está carregando. Tente novamente.");return}
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:id,
    scope:"https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify",
    callback: async (resp)=>{
      if(resp.error){toast("Não foi possível autorizar a conta: "+resp.error);return}
      accessToken=resp.access_token;
      $("#connectionStatus").textContent="CONECTADO";
      $("#connectionStatus").style.color="#51d69a";
      $("#accountSub").textContent="Conta Google autorizada nesta sessão";
      $("#connectBtn").textContent="Conta conectada";
      $("#scanBtn").disabled=false;
      toast("Gmail conectado. Você já pode analisar.");
    }
  });
  tokenClient.requestAccessToken({prompt:"consent"});
}
$("#connectBtn").onclick=initGoogle;

async function gmailFetch(path, options={}){
  const r=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{
    ...options,headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json",...(options.headers||{})}
  });
  if(!r.ok){const body=await r.text();throw new Error("Gmail API "+r.status+": "+body.slice(0,220))}
  return r.status===204?null:r.json();
}
function header(payload,name){return (payload?.headers||[]).find(h=>h.name.toLowerCase()===name.toLowerCase())?.value||""}
function decodeBase64Url(data=""){
  try{const binary=atob(data.replace(/-/g,"+").replace(/_/g,"/"));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}catch{return ""}
}
function extractText(part){
  if(!part)return "";
  if(part.mimeType==="text/plain"&&part.body?.data)return decodeBase64Url(part.body.data);
  return (part.parts||[]).map(extractText).join(" ") || (part.mimeType==="text/html"&&part.body?.data?decodeBase64Url(part.body.data).replace(/<[^>]*>/g," "):"");
}
function classify(m){
  const from=m.from.toLowerCase(), subject=m.subject.toLowerCase(), body=m.body.toLowerCase().slice(0,12000), text=from+" "+subject+" "+body;
  const domain=(from.match(/@([^>\s]+)/)||[])[1]||"remetente desconhecido";
  const protectedTerms=/banco|bank|pix|pagamento|fatura|boleto|nota fiscal|pedido|compra|recibo|comprovante|senha|segurança|security|código|verification|verificação|recuperação|password|invoice|receipt|order|pedido|contrato|documento|consulta|exame|médic|saúde|health/i;
  const personalTerms=/\b(oi|olá|querido|querida|saudade|família|amigo|amiga|reunião|convite)\b/i;
  const socialTerms=/facebook|instagram|linkedin|tiktok|twitter|x\.com|pinterest|reddit|discord/i;
  const promoTerms=/unsubscribe|cancelar inscrição|descadastre|oferta|promoção|desconto|sale|newsletter|marketing|novidades|black friday/i;
  const receiptTerms=/pedido confirmado|pedido enviado|nota fiscal|comprovante|recibo|compra aprovada|payment received/i;
  const financeTerms=/banco|bank|cartão|cartao|fatura|pix|pagamento|boleto|financeiro/i;
  let category="Não classificados", reason="A IA ainda não encontrou sinais suficientes para classificar.";
  let suggested=false, protectedMsg=false;
  if(protectedTerms.test(text)){protectedMsg=true;category=financeTerms.test(text)?"Bancos e pagamentos":receiptTerms.test(text)?"Compras e comprovantes":"Não classificados";reason="Possui possíveis dados pessoais, financeiros, documentos ou informações sensíveis. Protegido por segurança."}
  else if(personalTerms.test(subject+" "+body)){category="Pessoais";reason="A mensagem pode conter conversa ou contato pessoal."}
  else if(receiptTerms.test(text)){category="Compras e comprovantes";reason="Identificamos sinais de pedido, compra ou comprovante.";protectedMsg=true}
  else if(financeTerms.test(text)){category="Bancos e pagamentos";reason="Identificamos sinais de assunto financeiro.";protectedMsg=true}
  else if(socialTerms.test(text)){category="Redes sociais";reason="Remetente ou conteúdo associado a uma rede social.";suggested=true}
  else if(promoTerms.test(text)){category="Promoções";reason="Contém termos de marketing, oferta ou newsletter.";suggested=true}
  else if(/noreply|no-reply|notifications|notify|mailer-daemon/.test(from)){category="Empresas";reason="Remetente automático ou notificações recorrentes.";suggested=true}
  return {...m,domain,category,reason,suggested,protectedMsg};
}
async function scanAll(){
  if(!accessToken)return;
  $("#scanBtn").disabled=true;$("#scanBtn").textContent="Analisando…";messages=[];selectedIds.clear();render();
  try{
    let pageToken=null, ids=[];
    do{
      const q=includeSpam?"":"-in:spam -in:trash";
      const url=new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
      url.searchParams.set("maxResults","100");if(q)url.searchParams.set("q",q);if(pageToken)url.searchParams.set("pageToken",pageToken);
      const list=await fetch(url,{headers:{Authorization:"Bearer "+accessToken}}).then(async r=>{if(!r.ok)throw new Error("Falha ao listar mensagens: "+r.status);return r.json()});
      ids.push(...(list.messages||[]).map(x=>x.id));pageToken=list.nextPageToken||null;
      $("#scannedCount").textContent=ids.length.toLocaleString("pt-BR");
      // UI progress: continue through every page; full-message detail requests are batched below.
    }while(pageToken);
    for(let i=0;i<ids.length;i+=10){
      const batch=await Promise.all(ids.slice(i,i+10).map(async id=>{
        const d=await gmailFetch("messages/"+id+"?format=full");
        const p=d.payload, from=header(p,"From"), subject=header(p,"Subject")||"(sem assunto)";
        const body=extractText(p);
        const parsed=classify({id,from,subject,body,date:header(p,"Date")});
        return parsed;
      }));
      messages.push(...batch);
      $("#scannedCount").textContent=messages.length.toLocaleString("pt-BR");
      render();
    }
    toast("Análise concluída. Revise cada sugestão antes de agir.");
  }catch(e){toast(e.message||"Erro ao analisar Gmail.")}
  finally{$("#scanBtn").disabled=false;$("#scanBtn").textContent="Analisar novamente ↗";render()}
}
$("#scanBtn").onclick=scanAll;

function render(){
  const counts={};categories.forEach(c=>counts[c[0]]=0);messages.forEach(m=>counts[m.category]=(counts[m.category]||0)+1);
  $("#categories").innerHTML=categories.map(([name,icon,desc])=>`<div class="category"><div class="cat-icon">${icon==="megaphone"?"♢":icon==="building-2"?"▦":icon==="users"?"♧":icon==="receipt"?"▤":icon==="landmark"?"▥":icon==="user"?"◉":"□"}</div><div class="cat-copy"><b>${name}</b><small>${desc}</small></div><span class="cat-count">${counts[name]||0}</span></div>`).join("");
  $("#reviewCount").textContent=messages.filter(m=>m.suggested&&!m.protectedMsg).length.toLocaleString("pt-BR");
  $("#selectedCount").textContent=selectedIds.size+" selecionados";
  $("#selectSuggestedBtn").disabled=!messages.length;
  $("#trashBtn").disabled=!selectedIds.size;
  if(!messages.length){$("#emailList").innerHTML='<div class="empty">Nenhuma mensagem carregada.</div>';return}
  $("#emailList").innerHTML=messages.map(m=>{
    const safe=m.protectedMsg;
    return `<div class="email-row"><input type="checkbox" data-id="${escapeHtml(m.id)}" ${selectedIds.has(m.id)?"checked":""} ${safe?"disabled":""}><div class="email-copy"><div class="email-top"><b>${escapeHtml(m.from||"Remetente desconhecido")}</b><time>${escapeHtml(m.date||"")}</time></div><div class="subject">${escapeHtml(m.subject)}</div><div class="reason">${escapeHtml(m.reason)}</div><span class="tag ${safe?"protected":""}">${safe?"PROTEGIDO":escapeHtml(m.category)}</span></div></div>`;
  }).join("");
  $("#emailList").querySelectorAll("input[data-id]").forEach(cb=>cb.addEventListener("change",()=>{if(cb.checked)selectedIds.add(cb.dataset.id);else selectedIds.delete(cb.dataset.id);render()}));
}
$("#selectSuggestedBtn").onclick=()=>{messages.filter(m=>m.suggested&&!m.protectedMsg).forEach(m=>selectedIds.add(m.id));render();toast("Sugestões selecionadas. Confira a lista antes de enviar à lixeira.")};
$("#trashBtn").onclick=async()=>{
  const ids=[...selectedIds];
  if(!ids.length)return;
  if(!confirm(`Enviar ${ids.length} e-mail(s) para a lixeira do Gmail? Esta ação foi selecionada por você e pode ser revertida pela lixeira durante o prazo do Gmail.`))return;
  $("#trashBtn").disabled=true;
  try{
    for(const id of ids)await gmailFetch("messages/"+encodeURIComponent(id)+"/trash",{method:"POST"});
    messages=messages.filter(m=>!selectedIds.has(m.id));selectedIds.clear();render();toast(ids.length+" mensagem(ns) enviada(s) à lixeira.");
  }catch(e){toast("Algumas mensagens podem não ter sido movidas. "+e.message)}
  finally{$("#trashBtn").disabled=!selectedIds.size}
};
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));

function carregarDemonstracao() {
  messages = emailsDemonstracao.map(email => ({
    id: email.id,
    from: email.remetente,
    subject: email.assunto,
    category: email.categoria,
    snippet: "E-mail fictício para demonstração",
    suggested: false,
    protectedMsg: true
  }));
  selectedIds.clear();
  render();
}

carregarDemonstracao();
