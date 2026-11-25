/* Satu pilihan tim untuk tutorial, persiapan Easy, dan ketiga match. */
(() => {
  "use strict";
  const R=window.EasyRules, KEY="dapurMacet.easy.team.v1";
  let saved;
  try{saved=JSON.parse(localStorage.getItem(KEY));}catch(_){saved=null;}
  let draft=R.cleanTeam(saved?.team);if(!draft.length)draft=["koki","puput"];
  let team=R.pairTeam(draft),item=["Wajan","Panci","Kompor"].includes(saved?.item)?saved.item:"Wajan";
  const idFor=value=>Object.keys(R.CHARACTERS).find(id=>id===value||R.CHARACTERS[id].name===value);
  function store(){try{localStorage.setItem(KEY,JSON.stringify({team,item}));}catch(_){}}
  function status(message){document.querySelectorAll('[data-team-status],#tutorial-character-status').forEach(el=>el.textContent=message);}
  function sync(){
    document.querySelectorAll('[data-easy-character],.tutorial-option[data-choice-group="character"]').forEach(button=>{
      const id=idFor(button.dataset.easyCharacter||button.dataset.label),index=draft.indexOf(id);
      button.setAttribute("aria-pressed",String(index>=0));
      let badge=button.querySelector(".easy-team-badge");
      if(!badge){badge=document.createElement("span");badge.className="easy-team-badge";button.append(badge);}
      badge.textContent=index>=0?`KOKI ${index===0?"A":"B"}`:"";badge.hidden=index<0;
    });
    document.querySelectorAll('[data-team-confirm],[data-tutorial-confirm="character"]').forEach(b=>b.disabled=!draft.length);
    document.querySelectorAll('[data-easy-item],.tutorial-option[data-choice-group="item"]').forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.easyItem||b.dataset.label)===item)));
  }
  function toggle(id){const res=R.toggleTeam(draft,idFor(id));draft=res.team;sync();status(res.message);return res;}
  function confirm(){
    if(!draft.length){status("Pilih minimal satu karakter dulu!");return false;}
    const auto=draft.length===1;team=R.pairTeam(draft);draft=[...team];sync();store();
    status(`${auto?"Koki kedua default ditambahkan. ":""}${R.CHARACTERS[team[0]].name} (Koki A) & ${R.CHARACTERS[team[1]].name} (Koki B) siap digunakan!`);
    return true;
  }
  function setItem(value){if(["Wajan","Panci","Kompor"].includes(value)){item=value;store();sync();}}
  window.EasySelection={toggle,confirm,sync,setItem,get draft(){return [...draft];},get team(){return [...team];},get item(){return item;}};
  sync();
})();
