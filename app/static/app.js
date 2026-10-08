const $=id=>document.getElementById(id);
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
 document.querySelectorAll(".pane").forEach(x=>x.classList.remove("active"));
 b.classList.add("active"); $(b.dataset.tab+"Pane").classList.add("active");
});
const drop=$("drop"), file=$("file");
drop.onclick=()=>file.click();
file.onchange=()=>{$("filename").textContent=file.files[0]?file.files[0].name:""};
drop.ondragover=e=>{e.preventDefault();drop.style.borderColor="#8b7cff"};
drop.ondrop=e=>{e.preventDefault();file.files=e.dataTransfer.files;$("filename").textContent=file.files[0]?.name||""};

let lastOutput="", lastName="worker.obfuscated.js";
$("run").onclick=async()=>{
 const btn=$("run"), status=$("status");
 btn.disabled=true; status.textContent="Validating source and building protected output…";
 const fd=new FormData();
 const active=document.querySelector(".tab.active").dataset.tab;
 if(active==="url") fd.append("url",$("url").value);
 if(active==="paste") fd.append("source",$("source").value);
 if(active==="file"&&file.files[0]) fd.append("file",file.files[0]);
 ["identifier_names","string_array","dead_code","control_flow","self_defending","disable_console","compact"].forEach(k=>fd.append(k,$(k).checked));
 fd.append("string_encoding",$("string_encoding").value);
 try{
  const r=await fetch("/api/obfuscate",{method:"POST",body:fd});
  const data=await r.json();
  if(!r.ok) throw new Error(data.detail||"Obfuscation failed");
  lastOutput=data.output;lastName=data.filename;
  $("orig").textContent=`${data.originalLines.toLocaleString()} lines`;
  $("out").textContent=`${data.outputLines.toLocaleString()} lines`;
  $("ratio").textContent=`${(data.outputBytes/data.originalBytes*100).toFixed(0)}%`;
  $("output").value=data.output;$("result").classList.remove("hidden");
  status.textContent="✓ Obfuscation completed and output syntax validation passed.";
  $("result").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){status.textContent="✕ "+e.message}
 finally{btn.disabled=false}
};
$("download").onclick=()=>{
 const blob=new Blob([lastOutput],{type:"text/javascript;charset=utf-8"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=lastName;a.click();URL.revokeObjectURL(a.href);
};
