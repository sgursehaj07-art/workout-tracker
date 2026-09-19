const STORAGE_KEY = "gursehajWorkoutTracker_v3";
const PRE_RESTORE_KEY = "gursehajWorkoutTracker_preRestore_v5";
const APP_VERSION = 5;
const BACKUP_REMINDER_DAYS = 7;
const BACKUP_REMINDER_WORKOUTS = 3;

const DEFAULT_TEMPLATES = [
  { id: "tpl_push", name: "Push Day", emoji: "🏋️", exercises: ["ISMP","CF","LR","TPD","SC","CD"] },
  { id: "tpl_pull", name: "Pull Day", emoji: "💪", exercises: ["DL","PU","LPD","SCR","RDM","PC","IDC"] },
  { id: "tpl_cardio", name: "Cardio + Abs", emoji: "🏃", exercises: ["KR","DS","MC","Regular Sit-ups","Hollow Body Hold"], cardio: true },
  { id: "tpl_legs", name: "Legs Day", emoji: "🦵", exercises: ["LP","LE","LC","CR","AD"] }
];

const TRACKING_DEFAULTS = {
  PU: "reps", KR: "reps", "Regular Sit-ups": "reps", "Hollow Body Hold": "time", Plank: "time"
};
const timedNames = new Set(["hollow body hold", "plank"]);
const legacyBestSeeds = {
  "Push Day": { ISMP:"90 x 6", CF:"80 x 12", LR:"15 x 16", TPD:"47.5 x 7", SC:"30 x 12", CD:"10 x 6" },
  "Pull Day": { DL:"120 x 8", PU:"7 reps", LPD:"85 x 12", SCR:"85 x 8", RDM:"70 x 10", PC:"60 x 11", IDC:"15 x 7" },
  "Cardio + Abs": { KR:"7(H)&10", DS:"45 x 8", MC:"120 x 10" },
  "Legs Day": { LP:"360 x 9", LE:"130 x 10", LC:"80 x 10", CR:"120 x 10", AD:"140 x 5" }
};

const $ = id => document.getElementById(id);
const logScreen = $("logScreen"), historyScreen = $("historyScreen"), progressScreen = $("progressScreen"), backupScreen = $("backupScreen");
const navButtons = document.querySelectorAll(".nav-button");
const workoutGrid = $("workoutGrid"), manageWorkoutsButton = $("manageWorkoutsButton"), newWorkoutButton = $("newWorkoutButton");
const sessionArea = $("sessionArea"), currentWorkoutTitle = $("currentWorkoutTitle"), exerciseJumpNav = $("exerciseJumpNav");
const bestSoFarList = $("bestSoFarList"), bestLocationLabel = $("bestLocationLabel");
const workoutDate = $("workoutDate"), bodyWeight = $("bodyWeight"), sessionLocation = $("sessionLocation"), recentLocationChips = $("recentLocationChips");
const sessionNote = $("sessionNote"), overallWorkoutNote = $("overallWorkoutNote"), countWorkoutForPr = $("countWorkoutForPr");
const cardioSection = $("cardioSection"), cardioType = $("cardioType"), calories = $("calories"), distance = $("distance"), cardioTime = $("cardioTime"), pace = $("pace"), speed = $("speed"), feetClimbed = $("feetClimbed"), steps = $("steps"), spm = $("spm"), cardioNote = $("cardioNote");
const exerciseList = $("exerciseList"), addExerciseButton = $("addExerciseButton"), newSessionButton = $("newSessionButton"), repeatLastButton = $("repeatLastButton"), saveWorkoutButton = $("saveWorkoutButton"), saveDock = $("saveDock"), topSaveStatus = $("topSaveStatus");
const historyFilters = $("historyFilters"), historyList = $("historyList");
const progressSummary = $("progressSummary"), weightTrendLabel = $("weightTrendLabel"), weightStats = $("weightStats"), weightChart = $("weightChart"), progressExerciseSelect = $("progressExerciseSelect"), progressLocationSelect = $("progressLocationSelect"), exerciseProgressStats = $("exerciseProgressStats"), exerciseProgressChart = $("exerciseProgressChart"), exerciseProgressHistory = $("exerciseProgressHistory");
const backupReminder = $("backupReminder"), backupReminderTitle = $("backupReminderTitle"), backupReminderText = $("backupReminderText"), backupReminderButton = $("backupReminderButton"), backupStatusCard = $("backupStatusCard"), backupStatusText = $("backupStatusText"), exportBackupButton = $("exportBackupButton"), mergeBackupButton = $("mergeBackupButton"), importBackupButton = $("importBackupButton"), importBackupInput = $("importBackupInput"), undoRestoreButton = $("undoRestoreButton"), exportTextButton = $("exportTextButton"), exportCsvButton = $("exportCsvButton");
const modalOverlay = $("modalOverlay"), modalCard = $("modalCard"), toast = $("toast");

let appData = loadAppData();
let currentTemplateId = "";
let currentWorkoutType = "";
let currentDraft = null;
let historyFilter = "All";
let autosaveTimer = null;
let toastTimer = null;
let importMode = "merge";

function uid(prefix="id") { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function todayValue() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function dateFromValue(value) { const p=String(value||"").split("-").map(Number); return p.length===3 && p.every(Number.isFinite) ? new Date(p[0],p[1]-1,p[2]) : null; }
function formatDate(value, short=false) { const d=dateFromValue(value); return d ? d.toLocaleDateString("en-US", short?{month:"short",day:"numeric"}:{month:"long",day:"numeric",year:"numeric"}) : "No Date"; }
function formatDateTime(value) { const d=new Date(value||""); return Number.isFinite(d.getTime()) ? d.toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}) : "Never"; }
function workoutTimestamp(w) { const d=dateFromValue(w?.date); if (d) return d.getTime() + (new Date(w?.savedAt||"").getTime()%86400000||0); const s=new Date(w?.savedAt||"").getTime(); return Number.isFinite(s)?s:0; }
function sortNewest(list) { return [...list].sort((a,b)=>workoutTimestamp(b)-workoutTimestamp(a)); }
function daysSince(iso) { if(!iso) return Infinity; const t=new Date(iso).getTime(); return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/86400000)):Infinity; }
function normText(v) { return String(v||"").trim().replace(/\s+/g," "); }
function locationKey(v) { return normText(v).toLowerCase(); }
function sameLocation(a,b) { return locationKey(a)===locationKey(b); }
function emptySet(){ return {entry:"",note:""}; }

function defaultLibrary() {
  const names=[]; DEFAULT_TEMPLATES.forEach(t=>t.exercises.forEach(n=>{ if(!names.includes(n)) names.push(n); }));
  return names.map(name=>({id:`ex_${slug(name)}`,name,tracking:TRACKING_DEFAULTS[name]||"weighted"}));
}
function slug(v){ return normText(v).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")||Math.random().toString(36).slice(2,8); }
function defaultTemplates(library) {
  return DEFAULT_TEMPLATES.map(t=>({ id:t.id,name:t.name,emoji:t.emoji,cardio:Boolean(t.cardio),exerciseIds:t.exercises.map(n=>findExerciseByNameIn(library,n)?.id).filter(Boolean) }));
}
function findExerciseByNameIn(library,name){ const k=normText(name).toLowerCase(); return library.find(e=>normText(e.name).toLowerCase()===k) || null; }

function blankAppData(){ const exerciseLibrary=defaultLibrary(); return {version:APP_VERSION,workouts:[],templates:defaultTemplates(exerciseLibrary),exerciseLibrary,drafts:{},lastBackupAt:null,lastBackupWorkoutCount:0,backupHistory:[],settings:{locationNames:{}}}; }

function normalizeAppData(data){
  const base=blankAppData();
  const out={...base,...(data&&typeof data==="object"?data:{}),version:APP_VERSION};
  out.workouts=Array.isArray(data?.workouts)?data.workouts:[];
  out.exerciseLibrary=Array.isArray(data?.exerciseLibrary)&&data.exerciseLibrary.length ? data.exerciseLibrary.map(e=>({id:e.id||uid("ex"),name:normText(e.name)||"Exercise",tracking:["weighted","reps","time","free"].includes(e.tracking)?e.tracking:"weighted"})) : defaultLibrary();

  // Grow the exercise library from every historical exercise so old data remains usable.
  out.workouts.forEach(w=>(w.exercises||[]).forEach(ex=>{
    let lib=ex.exerciseId ? out.exerciseLibrary.find(e=>e.id===ex.exerciseId) : null;
    if(!lib) lib=findExerciseByNameIn(out.exerciseLibrary,ex.name);
    if(!lib){ lib={id:uid("ex"),name:normText(ex.name)||"Exercise",tracking:inferTracking(ex.name)}; out.exerciseLibrary.push(lib); }
    ex.exerciseId=lib.id;
  }));

  if(Array.isArray(data?.templates)&&data.templates.length){
    out.templates=data.templates.map(t=>({id:t.id||uid("tpl"),name:normText(t.name)||"Workout",emoji:t.emoji||"🏋️",cardio:Boolean(t.cardio),exerciseIds:Array.isArray(t.exerciseIds)?t.exerciseIds.filter(id=>out.exerciseLibrary.some(e=>e.id===id)):[]}));
  } else {
    out.templates=defaultTemplates(out.exerciseLibrary);
    // If old history contains a custom workout type, make a template for it.
    [...new Set(out.workouts.map(w=>w.workoutType).filter(Boolean))].forEach(name=>{
      if(out.templates.some(t=>t.name.toLowerCase()===name.toLowerCase())) return;
      const latest=sortNewest(out.workouts.filter(w=>w.workoutType===name))[0];
      out.templates.push({id:uid("tpl"),name,emoji:"🏋️",cardio:name.toLowerCase().includes("cardio"),exerciseIds:(latest?.exercises||[]).map(ex=>ex.exerciseId).filter(Boolean)});
    });
  }
  out.drafts=data?.drafts&&typeof data.drafts==="object"?data.drafts:{};
  out.lastBackupAt=data?.lastBackupAt||null;
  out.lastBackupWorkoutCount=Number.isFinite(Number(data?.lastBackupWorkoutCount))?Number(data.lastBackupWorkoutCount):(out.lastBackupAt?out.workouts.length:0);
  out.backupHistory=Array.isArray(data?.backupHistory)?data.backupHistory.slice(0,12):[];
  out.settings=data?.settings&&typeof data.settings==="object"?data.settings:{locationNames:{}};
  if(!out.settings.locationNames) out.settings.locationNames={};
  migrateWorkoutTemplateIds(out);
  return out;
}

function migrateWorkoutTemplateIds(data){
  data.workouts.forEach(w=>{
    if(!w.templateId){ const t=data.templates.find(t=>t.name.toLowerCase()===String(w.workoutType||"").toLowerCase()); if(t) w.templateId=t.id; }
  });
}
function inferTracking(name){ const n=normText(name); if(timedNames.has(n.toLowerCase())) return "time"; return TRACKING_DEFAULTS[n]||"weighted"; }
function loadAppData(){ try{ const raw=localStorage.getItem(STORAGE_KEY); return raw?normalizeAppData(JSON.parse(raw)):blankAppData(); }catch{return blankAppData();} }
function saveAppData(){ appData.version=APP_VERSION; localStorage.setItem(STORAGE_KEY,JSON.stringify(appData)); updateBackupReminder(); }

function getExercise(id){ return appData.exerciseLibrary.find(e=>e.id===id)||null; }
function ensureExercise(name,tracking="weighted"){
  let ex=findExerciseByNameIn(appData.exerciseLibrary,name); if(ex) return ex;
  ex={id:uid("ex"),name:normText(name)||"Exercise",tracking}; appData.exerciseLibrary.push(ex); return ex;
}
function currentTemplate(){ return appData.templates.find(t=>t.id===currentTemplateId)||null; }
function templateByName(name){ return appData.templates.find(t=>t.name.toLowerCase()===String(name||"").toLowerCase())||null; }

function freshDraft(template){
  return {templateId:template.id,workoutType:template.name,date:todayValue(),bodyWeight:"",location:recentLocations()[0]||"",sessionNote:"",overallWorkoutNote:"",excludeFromPR:false,cardio:{type:"Treadmill",calories:"",distance:"",time:"",pace:"",speed:"",feetClimbed:"",steps:"",spm:"",note:""},exercises:template.exerciseIds.map(id=>{const e=getExercise(id); return {exerciseId:id,name:e?.name||"Exercise",note:"",excludeFromPR:false,sets:[emptySet()]};}),existingWorkoutId:null,savedAt:null};
}
function normalizeDraft(template,stored){
  if(!stored) return freshDraft(template);
  const blank=freshDraft(template);
  return {...blank,...stored,templateId:template.id,workoutType:template.name,cardio:{...blank.cardio,...(stored.cardio||{})},exercises:Array.isArray(stored.exercises)&&stored.exercises.length?stored.exercises.map(ex=>normalizeExerciseRecord(ex)):blank.exercises};
}
function syncDraftToTemplateStructure(template,stored){
  const draft=normalizeDraft(template,stored);
  const existing=new Map((draft.exercises||[]).map(ex=>{const n=normalizeExerciseRecord(ex);return [n.exerciseId,n];}));
  draft.exercises=(template.exerciseIds||[]).map(id=>existing.get(id)||(()=>{const e=getExercise(id);return {exerciseId:id,name:e?.name||"Exercise",note:"",excludeFromPR:false,sets:[emptySet()]};})());
  return draft;
}
function normalizeExerciseRecord(ex){
  let lib=ex?.exerciseId?getExercise(ex.exerciseId):findExerciseByNameIn(appData.exerciseLibrary,ex?.name);
  if(!lib) lib=ensureExercise(ex?.name||"Exercise",inferTracking(ex?.name));
  return {exerciseId:lib.id,name:normText(ex?.name)||lib.name,note:ex?.note||"",excludeFromPR:Boolean(ex?.excludeFromPR),sets:Array.isArray(ex?.sets)&&ex.sets.length?ex.sets.map(s=>({entry:s?.entry||"",note:s?.note||""})):[emptySet()]};
}
function draftHasData(d){ return Boolean(d&&(d.bodyWeight||d.sessionNote||d.overallWorkoutNote||Object.entries(d.cardio||{}).some(([k,v])=>k!=="type"&&normText(v))||(d.exercises||[]).some(ex=>ex.note||(ex.sets||[]).some(s=>normText(s.entry)||normText(s.note))))); }

function showScreen(name){
  [logScreen,historyScreen,progressScreen,backupScreen].forEach(s=>s.classList.remove("active-screen"));
  navButtons.forEach(b=>b.classList.remove("active-nav"));
  const map={log:logScreen,history:historyScreen,progress:progressScreen,backup:backupScreen}; (map[name]||logScreen).classList.add("active-screen"); document.querySelector(`[data-screen="${name}"]`)?.classList.add("active-nav");
  if(name==="history") renderHistory(); if(name==="progress") renderProgress(); if(name==="backup") updateBackupStatus();
  saveDock.classList.toggle("hidden",!(name==="log"&&currentTemplateId)); window.scrollTo(0,0);
}
navButtons.forEach(b=>b.addEventListener("click",()=>{saveCurrentDraft();showScreen(b.dataset.screen);}));

function renderWorkoutGrid(){
  workoutGrid.innerHTML="";
  appData.templates.forEach(t=>{
    const b=document.createElement("button"); b.type="button"; b.className="workout-choice"+(t.id===currentTemplateId?" selected-workout":"");
    b.innerHTML=`<span class="workout-emoji">${escapeHtml(t.emoji||"🏋️")}</span><span>${escapeHtml(t.name)}</span>`;
    b.addEventListener("click",()=>selectTemplate(t.id)); workoutGrid.appendChild(b);
  });
  renderHistoryFilters();
}
function selectTemplate(id,draftOverride=null){
  saveCurrentDraft(); const t=appData.templates.find(x=>x.id===id); if(!t) return;
  currentTemplateId=t.id; currentWorkoutType=t.name; currentDraft=draftOverride||normalizeDraft(t,appData.drafts[t.id]||appData.drafts[t.name]); appData.drafts[t.id]=currentDraft; saveAppData(); renderWorkoutGrid(); renderDraft();
}

function renderDraft(){
  if(!currentDraft) return; const t=currentTemplate(); if(!t) return;
  sessionArea.classList.remove("hidden"); saveDock.classList.remove("hidden"); currentWorkoutTitle.textContent=t.name;
  workoutDate.value=currentDraft.date||todayValue(); bodyWeight.value=currentDraft.bodyWeight||""; sessionLocation.value=currentDraft.location||""; sessionNote.value=currentDraft.sessionNote||""; overallWorkoutNote.value=currentDraft.overallWorkoutNote||""; countWorkoutForPr.checked=!currentDraft.excludeFromPR;
  cardioSection.classList.toggle("hidden",!t.cardio);
  const c=currentDraft.cardio||{}; cardioType.value=c.type||"Treadmill"; calories.value=c.calories||""; distance.value=c.distance||""; cardioTime.value=c.time||""; pace.value=c.pace||""; speed.value=c.speed||""; feetClimbed.value=c.feetClimbed||""; steps.value=c.steps||""; spm.value=c.spm||""; cardioNote.value=c.note||"";
  exerciseList.innerHTML=""; (currentDraft.exercises||[]).forEach((ex,i)=>exerciseList.appendChild(createExerciseCard(ex,i)));
  saveWorkoutButton.textContent=currentDraft.existingWorkoutId?"Update Workout":"Save Workout";
  renderLocationChips(); renderExerciseJumpNav(); renderBestSoFar(); updateRepeatLastButton();
}

function trackingPlaceholder(exerciseId,name){
  const mode=getExercise(exerciseId)?.tracking||inferTracking(name);
  if(mode==="reps") return "Reps — e.g. 8";
  if(mode==="time") return "Time — e.g. 1:30 or 90 sec";
  if(mode==="free") return "Result — e.g. distance, reps, or notes";
  return "Weight × reps — e.g. 80 × 10";
}

function createExerciseCard(exercise,index){
  const ex=normalizeExerciseRecord(exercise); const card=document.createElement("section"); card.className="exercise-card"; card.dataset.exerciseId=ex.exerciseId; card.id=`exercise_${ex.exerciseId}_${index}`;
  const inner=document.createElement("div"); inner.className="exercise-inner";
  const head=document.createElement("div"); head.className="exercise-heading";
  const title=document.createElement("h3"); title.textContent=ex.name||getExercise(ex.exerciseId)?.name||"Exercise";
  const tools=document.createElement("div"); tools.className="exercise-tools";
  const edit=iconButton("✎","Edit exercise"),up=iconButton("↑","Move up"),down=iconButton("↓","Move down"),remove=iconButton("×","Remove exercise");remove.classList.add("remove-button");
  tools.append(edit,up,down,remove);head.append(title,tools);
  const name=document.createElement("input");name.type="text";name.className="exercise-name";name.value=ex.name||"";name.placeholder="Exercise name";name.readOnly=true;name.setAttribute("aria-label","Exercise name");
  const note=document.createElement("textarea"); note.className="exercise-note"; note.value=ex.note||""; note.placeholder="Exercise note — form, machine setup, reminder...";
  const toggle=document.createElement("label"); toggle.className="toggle-row"; toggle.innerHTML=`<input class="pr-toggle" type="checkbox" ${ex.excludeFromPR?"":"checked"}><span>Count this exercise toward PRs</span>`;
  const insights=createExerciseInsights(ex.exerciseId,ex.name);
  const sets=document.createElement("div"); sets.className="sets-container"; (ex.sets?.length?ex.sets:[emptySet()]).forEach((s,i)=>sets.appendChild(createSetCard(s,i+1,card)));
  const add=document.createElement("button"); add.type="button"; add.className="add-set-button"; add.textContent="＋ Add Set"; add.addEventListener("click",()=>{sets.appendChild(createSetCard(emptySet(),sets.children.length+1,card)); queueAutosave(); updateJumpState();});
  edit.addEventListener("click",()=>{saveCurrentDraft();openExerciseEditor(card.dataset.exerciseId);});
  name.addEventListener("click",()=>{saveCurrentDraft();openExerciseEditor(card.dataset.exerciseId);});
  note.addEventListener("input",queueAutosave);toggle.querySelector("input").addEventListener("change",queueAutosave);
  up.addEventListener("click",()=>moveExerciseCard(card,-1));down.addEventListener("click",()=>moveExerciseCard(card,1));
  remove.addEventListener("click",()=>{
    if(!confirm(`Remove ${name.value||"this exercise"} from this session?`))return;
    const t=currentTemplate(),id=card.dataset.exerciseId;
    card.remove();
    if(t?.exerciseIds.includes(id)&&confirm(`Also remove ${name.value||"this exercise"} from future ${t.name} workouts?`)){t.exerciseIds=t.exerciseIds.filter(x=>x!==id);saveAppData();}
    queueAutosave();renderExerciseJumpNav();renderBestSoFar();
  });
  inner.append(head,name,note,toggle,insights,sets,add); card.append(inner); return card;
}
function iconButton(text,label){ const b=document.createElement("button"); b.type="button"; b.className="icon-button"; b.textContent=text; b.setAttribute("aria-label",label); return b; }
function moveExerciseCard(card,dir){ const sibling=dir<0?card.previousElementSibling:card.nextElementSibling; if(!sibling)return; if(dir<0)exerciseList.insertBefore(card,sibling); else exerciseList.insertBefore(sibling,card); queueAutosave(); renderExerciseJumpNav(); }

function createSetCard(set,number,exerciseCard){
  const card=document.createElement("div"); card.className="set-card";
  const head=document.createElement("div"); head.className="set-heading"; const label=document.createElement("span"); label.className="set-number"; label.textContent=`Set ${number}`; const rem=iconButton("×","Remove set"); rem.classList.add("remove-button"); head.append(label,rem);
  const entry=document.createElement("input"); entry.type="text"; entry.className="set-entry"; entry.value=set?.entry||""; entry.placeholder=trackingPlaceholder(exerciseCard.dataset.exerciseId,exerciseCard.querySelector(".exercise-name")?.value);
  const smart=document.createElement("div"); smart.className="smart-suggestions";
  const note=document.createElement("textarea"); note.className="set-note"; note.value=set?.note||""; note.placeholder="Optional set note";
  const tags=document.createElement("div"); tags.className="quick-tags"; [["SS","(SS)"],["SA","(SA)"],["+ partials","+ partials"],["failed","(failed)"]].forEach(([l,t])=>{const b=document.createElement("button");b.type="button";b.className="quick-tag";b.textContent=l;b.addEventListener("click",()=>appendTag(entry,t));tags.appendChild(b);});
  const refreshSuggestions=()=>renderSmartSuggestions(smart,exerciseCard,number,entry.value,entry);
  entry.addEventListener("focus",refreshSuggestions); entry.addEventListener("input",()=>{queueAutosave();refreshSuggestions();updateJumpState();}); note.addEventListener("input",queueAutosave);
  rem.addEventListener("click",()=>{const parent=card.parentElement;card.remove();renumberSets(parent);queueAutosave();updateJumpState();});
  card.append(head,entry,smart,note,tags); setTimeout(refreshSuggestions,0); return card;
}
function appendTag(input,tag){ const cur=normText(input.value); if(cur.toLowerCase().includes(tag.toLowerCase()))return; input.value=cur?`${cur} ${tag}`:tag; input.dispatchEvent(new Event("input",{bubbles:true})); input.focus(); }
function renumberSets(parent){ [...(parent?.querySelectorAll(".set-card")||[])].forEach((c,i)=>{const l=c.querySelector(".set-number");if(l)l.textContent=`Set ${i+1}`;}); }

function renderExerciseJumpNav(){
  exerciseJumpNav.innerHTML=""; [...exerciseList.querySelectorAll(".exercise-card")].forEach((card,i)=>{
    const b=document.createElement("button"); b.type="button"; b.className="jump-chip"; b.dataset.target=card.id; b.textContent=card.querySelector(".exercise-name")?.value||`Exercise ${i+1}`; b.addEventListener("click",()=>card.scrollIntoView({behavior:"smooth",block:"start"})); exerciseJumpNav.appendChild(b);
  }); updateJumpState();
}
function updateJumpState(){ [...exerciseJumpNav.querySelectorAll(".jump-chip")].forEach(b=>{const card=$(b.dataset.target); const filled=card&&[...card.querySelectorAll(".set-entry")].some(i=>normText(i.value)); b.classList.toggle("done",Boolean(filled)); if(filled&&!b.textContent.startsWith("✓ "))b.textContent=`✓ ${b.textContent}`; if(!filled&&b.textContent.startsWith("✓ "))b.textContent=b.textContent.slice(2);}); }

function recentLocations(){
  const seen=new Set(),arr=[]; sortNewest(appData.workouts).forEach(w=>{const k=locationKey(w.location);if(k&&!seen.has(k)){seen.add(k);arr.push(normText(w.location));}}); return arr.slice(0,8);
}
function renderLocationChips(){
  recentLocationChips.innerHTML=""; recentLocations().slice(0,5).forEach(loc=>{const b=document.createElement("button");b.type="button";b.className="location-chip"+(sameLocation(loc,sessionLocation.value)?" active":"");b.textContent=loc;b.addEventListener("click",()=>{sessionLocation.value=loc;sessionLocation.dispatchEvent(new Event("input",{bubbles:true}));});recentLocationChips.appendChild(b);});
}
sessionLocation.addEventListener("input",()=>{queueAutosave();renderLocationChips();renderBestSoFar();refreshAllInsightsAndSuggestions();});

function filledSets(ex){ return (ex?.sets||[]).filter(s=>normText(s.entry)); }
function exerciseIdentityMatches(ex,exerciseId,name){ if(exerciseId&&ex?.exerciseId===exerciseId)return true; return normText(ex?.name).toLowerCase()===normText(name).toLowerCase(); }
function getExerciseSessions(exerciseId,name,{location=null,excludeWorkoutId=null,requireFilled=false,includeExcluded=false}={}){
  const sessions=[];
  for(const w of appData.workouts){
    if(w.id===excludeWorkoutId||(!includeExcluded&&w.excludeFromPR))continue;
    if(location!==null&&!sameLocation(w.location,location))continue;
    for(const ex of w.exercises||[]){
      if((!includeExcluded&&ex.excludeFromPR)||!exerciseIdentityMatches(ex,exerciseId,name))continue;
      if(requireFilled&&!filledSets(ex).length)continue;
      sessions.push({workout:w,exercise:ex,performance:bestPerformanceForExercise(ex)});
    }
  }
  return sessions.sort((a,b)=>workoutTimestamp(b.workout)-workoutTimestamp(a.workout));
}
function mostRecentFilledSession(exerciseId,name,location){
  // "Use Last Filled Sets" is logging help, not a PR calculation. A workout
  // excluded from PRs should still be available as the most recent filled log.
  const same=getExerciseSessions(exerciseId,name,{location,excludeWorkoutId:currentDraft?.existingWorkoutId||null,requireFilled:true,includeExcluded:true});
  if(same.length)return same[0];
  return getExerciseSessions(exerciseId,name,{excludeWorkoutId:currentDraft?.existingWorkoutId||null,requireFilled:true,includeExcluded:true})[0]||null;
}
function createExerciseInsights(exerciseId,name){
  const d=document.createElement("details");d.className="exercise-insights";const s=document.createElement("summary");const body=document.createElement("div");body.className="exercise-insights-body";d.append(s,body);
  const render=()=>{
    body.innerHTML="";
    const loc=normText(sessionLocation.value);
    const sessions=getExerciseSessions(exerciseId,name,{location:loc||null,excludeWorkoutId:currentDraft?.existingWorkoutId||null,includeExcluded:true});
    const usingOtherLocations=Boolean(loc&&!sessions.length);
    const fallback=usingOtherLocations?getExerciseSessions(exerciseId,name,{excludeWorkoutId:currentDraft?.existingWorkoutId||null,includeExcluded:true}):sessions;
    s.textContent=fallback.length
      ? (usingOtherLocations?`History · no ${loc} entries · showing other gyms`:`History · ${fallback.length} logged${loc?` · ${loc}`:""}`)
      : "History · No previous data";
    const best=bestForExercise(exerciseId,name,loc||null,currentDraft?.existingWorkoutId||null); if(best){const b=document.createElement("div");b.className="insight-best";b.textContent=`🏆 Best${loc?` at ${loc}`:""}: ${best.display}`;body.appendChild(b);}
    const last=mostRecentFilledSession(exerciseId,name,loc); if(last){const use=document.createElement("button");use.type="button";use.className="use-last-button";use.textContent=`Use Last Filled Sets${loc&&!sameLocation(last.workout.location,loc)?` · ${last.workout.location||"other gym"}`:""}`;use.addEventListener("click",()=>{const card=d.closest(".exercise-card"),container=card.querySelector(".sets-container");container.innerHTML="";filledSets(last.exercise).forEach((set,i)=>container.appendChild(createSetCard({...set},i+1,card))); if(!container.children.length)container.appendChild(createSetCard(emptySet(),1,card));queueAutosave();updateJumpState();showToast(`Copied ${last.exercise.name||name} from ${formatDate(last.workout.date,true)}.`);});body.appendChild(use);}
    fallback.slice(0,5).forEach(x=>{const r=document.createElement("div");r.className="insight-session";const strong=document.createElement("strong");strong.textContent=`${formatDate(x.workout.date,true)}${x.workout.location?` · ${x.workout.location}`:""}`;const pre=document.createElement("pre");pre.textContent=filledSets(x.exercise).map((set,i)=>`Set ${i+1}: ${set.entry}${set.note?` — ${set.note}`:""}`).join("\n")||"No sets recorded";r.append(strong,pre);body.appendChild(r);});
    if(!fallback.length){const e=document.createElement("div");e.className="best-empty";e.textContent="No saved performance for this exercise yet.";body.appendChild(e);}
  }; d._rerender=render; render(); return d;
}
function refreshAllInsightsAndSuggestions(){ document.querySelectorAll(".exercise-insights").forEach(d=>d._rerender?.()); document.querySelectorAll(".set-entry").forEach(i=>i.dispatchEvent(new Event("focus"))); }

function getSmartSuggestions(exerciseId,name,setNumber,typed=""){
  const loc=normText(sessionLocation.value),now=Date.now(),map=new Map();
  const allSessions=getExerciseSessions(exerciseId,name,{excludeWorkoutId:currentDraft?.existingWorkoutId||null,requireFilled:true,includeExcluded:true});
  const sameGymSessions=loc?allSessions.filter(x=>sameLocation(x.workout.location,loc)):[];
  // Different gyms can use meaningfully different machines/plates. Once there is
  // history at the current gym, suggestions learn only from that gym. Other gyms
  // are used strictly as a fallback for a location with no history yet.
  const sessions=sameGymSessions.length?sameGymSessions:allSessions;
  sessions.forEach((x,sessionIndex)=>filledSets(x.exercise).forEach((set,i)=>{
    const value=normText(set.entry);if(!value)return;
    const key=value.toLowerCase(),sameSet=i+1===setNumber;
    const age=Math.max(0,(now-workoutTimestamp(x.workout))/86400000);
    const recency=Math.max(0,30-Math.min(30,age));
    const score=(sameSet?35:0)+recency+Math.max(0,20-sessionIndex);
    const old=map.get(key)||{value,score:0,count:0};old.score+=score;old.count++;map.set(key,old);
  }));
  const q=normText(typed).toLowerCase();
  const values=[...map.values()]
    .filter(x=>!q||x.value.toLowerCase().includes(q)||x.value.toLowerCase().startsWith(q.replace(/x/g,"×")))
    .sort((a,b)=>(b.score+b.count*8)-(a.score+a.count*8))
    .slice(0,4).map(x=>x.value);
  return {values,fallback:Boolean(loc&&!sameGymSessions.length&&allSessions.length)};
}
function renderSmartSuggestions(container,exerciseCard,setNumber,typed,input){
  container.innerHTML="";
  const name=exerciseCard.querySelector(".exercise-name")?.value||"";
  const result=getSmartSuggestions(exerciseCard.dataset.exerciseId,name,setNumber,typed);
  if(!result.values.length)return;
  if(result.fallback){
    const hint=document.createElement("span");hint.className="suggestion-hint";hint.textContent=`No ${normText(sessionLocation.value)} history yet · other gyms`;container.appendChild(hint);
  }
  result.values.forEach(v=>{const b=document.createElement("button");b.type="button";b.className="suggestion-chip";b.textContent=v;b.addEventListener("click",()=>{input.value=v;input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();});container.appendChild(b);});
}

// =========================
// PERFORMANCE + PR ENGINE
// =========================
function parseWeightedCandidates(entry){
  const text=normText(entry); if(!text||/assisted|negative-only|negatives only/i.test(text))return [];
  const results=[]; const re=/(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)/gi; let m;
  const modifiedWholeSet=/\b(short reps?|half reps?|quarter reps?|short explosive|cheat reps?)\b/i.test(text);
  while((m=re.exec(text))!==null){
    const weight=Number(m[1]),reps=Number(m[2]); if(!Number.isFinite(weight)||!Number.isFinite(reps)||weight<=0||reps<=0||reps>100)continue;
    // PR order for clean weighted work: higher weight first, then higher completed reps.
    // +partials / failed-on-next-rep do not inflate the completed rep count.
    const score=weight*10000+reps;
    const trendScore=weight*(1+Math.min(reps,30)/30);
    results.push({metric:"strength",score,trendScore,weight,reps,display:text,comparable:!modifiedWholeSet,modified:modifiedWholeSet});
  }
  return results;
}
function parseDurationSeconds(entry){
  const text=normText(entry); if(!text)return null;
  const colon=text.match(/\b(\d{1,2}):(\d{2})\b/); if(colon)return Number(colon[1])*60+Number(colon[2]);
  const min=text.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)\b/i); if(min)return Number(min[1])*60;
  const sec=text.match(/(\d+(?:\.\d+)?)\s*(?:sec|secs|second|seconds|s)\b/i); if(sec)return Number(sec[1]);
  return null;
}
function parseRepPerformance(entry){
  const text=normText(entry); if(!text||/negative-only|negatives only|assisted/i.test(text))return null;
  const modified=/\b(short reps?|half reps?|quarter reps?|cheat reps?)\b/i.test(text);
  const explicit=[...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?)\b/gi)].map(m=>Number(m[1])).filter(Number.isFinite);
  let values=explicit;
  if(!values.length&&!/[x×:]/i.test(text)) values=(text.match(/\d+(?:\.\d+)?/g)||[]).map(Number).filter(n=>Number.isFinite(n)&&n>=0&&n<=500);
  if(!values.length)return null; const reps=Math.max(...values);
  return {metric:"reps",score:reps,trendScore:reps,reps,display:text,comparable:!modified,modified};
}
function bestPerformanceForExercise(exercise){
  const lib=getExercise(exercise?.exerciseId); const tracking=lib?.tracking||inferTracking(exercise?.name);
  const sets=filledSets(exercise);
  if(tracking==="time"){
    const vals=sets.map(s=>{const seconds=parseDurationSeconds(s.entry);return seconds==null?null:{metric:"time",score:seconds,trendScore:seconds,seconds,display:normText(s.entry),comparable:true};}).filter(Boolean);
    return vals.sort((a,b)=>b.score-a.score)[0]||null;
  }
  if(tracking==="reps"){
    const vals=sets.map(s=>parseRepPerformance(s.entry)).filter(Boolean); const clean=vals.filter(v=>v.comparable); return (clean.length?clean:vals).sort((a,b)=>b.score-a.score)[0]||null;
  }
  if(tracking==="free"){
    const weighted=[];sets.forEach(s=>weighted.push(...parseWeightedCandidates(s.entry))); if(weighted.length){const clean=weighted.filter(v=>v.comparable);return (clean.length?clean:weighted).sort((a,b)=>b.score-a.score)[0];}
    const reps=sets.map(s=>parseRepPerformance(s.entry)).filter(Boolean);return reps.sort((a,b)=>b.score-a.score)[0]||null;
  }
  const weighted=[]; sets.forEach(s=>weighted.push(...parseWeightedCandidates(s.entry)));
  if(weighted.length){const clean=weighted.filter(v=>v.comparable);return (clean.length?clean:weighted).sort((a,b)=>b.score-a.score)[0];}
  const reps=sets.map(s=>parseRepPerformance(s.entry)).filter(Boolean);return reps.sort((a,b)=>b.score-a.score)[0]||null;
}
function chooseBestPerformance(items){
  const usable=items.filter(Boolean);if(!usable.length)return null;
  // Ambiguous/modified performances (for example "short explosive") are useful
  // history, but should not become a PR just because no clean result exists yet.
  const pool=usable.filter(x=>x.comparable!==false);if(!pool.length)return null;
  const metric=pool.some(x=>x.metric==="strength")?"strength":pool.some(x=>x.metric==="time")?"time":pool[0].metric;
  return pool.filter(x=>x.metric===metric).sort((a,b)=>b.score-a.score)[0]||null;
}
function trendFromSessions(sessions){
  const p=sessions.filter(s=>s.performance&&s.performance.comparable!==false).slice(0,2);if(p.length<2||p[0].performance.metric!==p[1].performance.metric)return {state:"neutral",label:"Need more data"};
  const latest=p[0].performance.trendScore??p[0].performance.score,prev=p[1].performance.trendScore??p[1].performance.score; if(!prev)return {state:"neutral",label:"→ Steady"};
  const change=(latest-prev)/Math.abs(prev); if(change>.02)return {state:"up",label:"↑ Up vs last"}; if(change<-.02)return {state:"down",label:"↓ Down vs last"}; return {state:"neutral",label:"→ About steady"};
}
function createTrendChip(trend){const s=document.createElement("span");s.className=`trend-chip ${trend?.state||"neutral"}`;s.textContent=trend?.label||"No trend";return s;}
function isImportedLegacyWorkout(w){return String(w?.id||"").startsWith("imported_old_workout_");}
function hasLegacyImportedHistory(){return appData.workouts.some(isImportedLegacyWorkout);}
function legacySeedFor(name,workoutType){
  if(!hasLegacyImportedHistory()||!workoutType)return null; const seeds=legacyBestSeeds[workoutType]||{}; const key=Object.keys(seeds).find(k=>k.toLowerCase()===normText(name).toLowerCase()); if(!key)return null;
  const display=seeds[key],lib=findExerciseByNameIn(appData.exerciseLibrary,key),perf=bestPerformanceForExercise({exerciseId:lib?.id,name:key,sets:[{entry:display,note:""}]}); return perf?{...perf,display,legacySeed:true,workout:null}:null;
}
function bestForExercise(exerciseId,name,location=null,excludeWorkoutId=null,workoutTypeForLegacy=""){
  const sessions=getExerciseSessions(exerciseId,name,{location,excludeWorkoutId,requireFilled:true}).filter(s=>s.performance);
  const candidates=sessions.map(s=>({...s.performance,workout:s.workout,exercise:s.exercise,source:"history"}));
  // Old hand-written baselines are only used when no gym/location scope is requested.
  if(location===null){const seed=legacySeedFor(name,workoutTypeForLegacy);if(seed)candidates.push({...seed,source:"legacy"});}
  return chooseBestPerformance(candidates);
}
function paceToSeconds(value){const m=normText(value).match(/(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null;}
function cardioBestRows(location=null,excludeWorkoutId=null){
  const workouts=appData.workouts.filter(w=>w.id!==excludeWorkoutId&&!w.excludeFromPR&&(location===null||sameLocation(w.location,location)));
  const rows=[];
  const paceCandidates=workouts.map(w=>({w,score:paceToSeconds(w.cardio?.pace)})).filter(x=>x.score!=null).sort((a,b)=>a.score-b.score); if(paceCandidates[0])rows.push({name:"Fastest pace",display:`${paceCandidates[0].w.cardio.pace} /mi`,score:paceCandidates[0].score,metric:"pace",workoutId:paceCandidates[0].w.id,workout:paceCandidates[0].w});
  const spmCandidates=workouts.map(w=>({w,score:Number(w.cardio?.spm)})).filter(x=>Number.isFinite(x.score)&&x.score>0).sort((a,b)=>b.score-a.score); if(spmCandidates[0])rows.push({name:"StairMaster",display:`${spmCandidates[0].score} SPM`,score:spmCandidates[0].score,metric:"spm",workoutId:spmCandidates[0].w.id,workout:spmCandidates[0].w});
  const distCandidates=workouts.map(w=>({w,score:Number(w.cardio?.distance)})).filter(x=>Number.isFinite(x.score)&&x.score>0).sort((a,b)=>b.score-a.score); if(distCandidates[0])rows.push({name:"Longest distance",display:`${distCandidates[0].score} mi`,score:distCandidates[0].score,metric:"distance",workoutId:distCandidates[0].w.id,workout:distCandidates[0].w});
  return rows;
}
function renderBestSoFar(){
  if(!bestSoFarList)return;
  bestSoFarList.innerHTML="";
  const loc=normText(sessionLocation.value);
  bestLocationLabel.textContent=loc?`at ${loc}`:"Set a gym location";
  if(!loc){
    const e=document.createElement("div");e.className="best-empty";e.textContent="Set your gym / location to see PRs for that gym.";bestSoFarList.appendChild(e);return;
  }
  const cards=[...exerciseList.querySelectorAll(".exercise-card")];let count=0;
  cards.forEach(card=>{const id=card.dataset.exerciseId,name=normText(card.querySelector(".exercise-name")?.value);if(!name)return;const best=bestForExercise(id,name,loc,currentDraft?.existingWorkoutId||null,currentWorkoutType);if(!best)return;count++;
    const row=document.createElement("div");row.className="best-row";const n=document.createElement("span");n.className="best-name";n.textContent=name;const v=document.createElement("span");v.className="best-value";v.textContent=best.display;const d=document.createElement("span");d.className="best-date";d.textContent=best.workout?.date?formatDate(best.workout.date,true):(best.legacySeed?"baseline":"");row.append(n,v,d);bestSoFarList.appendChild(row);
  });
  if(currentTemplate()?.cardio){cardioBestRows(loc,currentDraft?.existingWorkoutId||null).forEach(x=>{count++;const row=document.createElement("div");row.className="best-row";row.innerHTML=`<span class="best-name">${escapeHtml(x.name)}</span><span class="best-value">${escapeHtml(x.display)}</span><span class="best-date">${x.workout?.date?escapeHtml(formatDate(x.workout.date,true)):""}</span>`;bestSoFarList.appendChild(row);});}
  if(!count){const e=document.createElement("div");e.className="best-empty";e.textContent=loc?`No PR data at ${loc} yet.`:"Log a workout to start building PRs.";bestSoFarList.appendChild(e);}
}

// =========================
// DRAFTS + SESSION FLOW
// =========================
function collectDraft(){
  if(!currentTemplateId||!currentDraft)return null;
  const exercises=[...exerciseList.querySelectorAll(".exercise-card")].map(card=>({
    exerciseId:card.dataset.exerciseId||ensureExercise(card.querySelector(".exercise-name")?.value||"Exercise").id,
    name:normText(card.querySelector(".exercise-name")?.value)||"Exercise",
    note:normText(card.querySelector(".exercise-note")?.value),
    excludeFromPR:!(card.querySelector(".pr-toggle")?.checked??true),
    sets:[...card.querySelectorAll(".set-card")].map(sc=>({entry:normText(sc.querySelector(".set-entry")?.value),note:normText(sc.querySelector(".set-note")?.value)}))
  }));
  return {...currentDraft,templateId:currentTemplateId,workoutType:currentTemplate()?.name||currentWorkoutType,date:workoutDate.value||todayValue(),bodyWeight:normText(bodyWeight.value),location:normText(sessionLocation.value),sessionNote:normText(sessionNote.value),overallWorkoutNote:normText(overallWorkoutNote.value),excludeFromPR:!countWorkoutForPr.checked,cardio:{type:cardioType.value||"Treadmill",calories:normText(calories.value),distance:normText(distance.value),time:normText(cardioTime.value),pace:normText(pace.value),speed:normText(speed.value),feetClimbed:normText(feetClimbed.value),steps:normText(steps.value),spm:normText(spm.value),note:normText(cardioNote.value)},exercises};
}
function saveCurrentDraft(){if(!currentTemplateId||!currentDraft)return;const d=collectDraft();if(!d)return;currentDraft=d;appData.drafts[currentTemplateId]=d;saveAppData();}
function queueAutosave(){topSaveStatus.textContent=navigator.onLine?"Saving…":"Offline · saving";clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{saveCurrentDraft();topSaveStatus.textContent=navigator.onLine?"Saved":"Offline · saved";},250);}
[workoutDate,bodyWeight,sessionNote,overallWorkoutNote,countWorkoutForPr,cardioType,calories,distance,cardioTime,pace,speed,feetClimbed,steps,spm,cardioNote].forEach(el=>{el.addEventListener("input",queueAutosave);el.addEventListener("change",queueAutosave);});

function latestWorkoutForTemplate(templateId,excludeId=null){const t=appData.templates.find(x=>x.id===templateId);return sortNewest(appData.workouts.filter(w=>w.id!==excludeId&&(w.templateId===templateId||(!w.templateId&&t&&w.workoutType===t.name))))[0]||null;}
function updateRepeatLastButton(){repeatLastButton.disabled=!latestWorkoutForTemplate(currentTemplateId,currentDraft?.existingWorkoutId||null);repeatLastButton.style.opacity=repeatLastButton.disabled?".45":"1";}
repeatLastButton.addEventListener("click",()=>{
  const last=latestWorkoutForTemplate(currentTemplateId,currentDraft?.existingWorkoutId||null);if(!last)return showToast("No previous workout to repeat yet.");
  saveCurrentDraft();if(draftHasData(currentDraft)&&!confirm("Replace the current draft with a fresh session based on your last workout?"))return;
  const t=currentTemplate(),d=freshDraft(t);d.location=last.location||d.location;d.cardio.type=last.cardio?.type||d.cardio.type;d.exercises=(last.exercises||[]).map(ex=>{const n=normalizeExerciseRecord(ex);return {...n,note:"",excludeFromPR:false,sets:Array.from({length:Math.max(1,filledSets(ex).length||ex.sets?.length||1)},()=>emptySet())};});
  currentDraft=d;appData.drafts[currentTemplateId]=d;saveAppData();renderDraft();showToast("Fresh session created from your last workout structure.");
});
newSessionButton.addEventListener("click",()=>{saveCurrentDraft();if(draftHasData(currentDraft)&&!currentDraft.existingWorkoutId&&!confirm("Start a new session? Your current draft will be cleared."))return;currentDraft=freshDraft(currentTemplate());appData.drafts[currentTemplateId]=currentDraft;saveAppData();renderDraft();showToast("New session ready.");});

// =========================
// MODALS + WORKOUT / EXERCISE MANAGEMENT
// =========================
function openModal(builder){modalCard.innerHTML="";builder(modalCard);modalOverlay.classList.remove("hidden");modalOverlay.setAttribute("aria-hidden","false");}
function closeModal(){modalOverlay.classList.add("hidden");modalOverlay.setAttribute("aria-hidden","true");modalCard.innerHTML="";}
modalOverlay.addEventListener("click",e=>{if(e.target===modalOverlay)closeModal();});
function modalTitle(card,title,help=""){const h=document.createElement("h2");h.textContent=title;card.appendChild(h);if(help){const p=document.createElement("p");p.className="modal-help";p.textContent=help;card.appendChild(p);}}
function modalActions(card,onSave,saveText="Save"){const a=document.createElement("div");a.className="modal-actions";const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel";cancel.addEventListener("click",closeModal);const save=document.createElement("button");save.type="button";save.className="primary";save.textContent=saveText;save.addEventListener("click",onSave);a.append(cancel,save);card.appendChild(a);}
function makeField(labelText,type="text",value="",placeholder=""){const wrap=document.createElement("div");const label=document.createElement("label");label.textContent=labelText;const input=document.createElement(type==="select"?"select":"input");if(type!=="select")input.type=type;input.value=value;input.placeholder=placeholder;wrap.append(label,input);return {wrap,input};}

function addExerciseToSession(exerciseId,addToTemplate=true){
  const lib=getExercise(exerciseId);if(!lib)return; if([...exerciseList.querySelectorAll(".exercise-card")].some(c=>c.dataset.exerciseId===exerciseId)){showToast(`${lib.name} is already in this session.`);return;}
  const record={exerciseId:lib.id,name:lib.name,note:"",excludeFromPR:false,sets:[emptySet()]};exerciseList.appendChild(createExerciseCard(record,exerciseList.children.length));
  if(addToTemplate){const t=currentTemplate();if(t&&!t.exerciseIds.includes(exerciseId))t.exerciseIds.push(exerciseId);}
  queueAutosave();renderExerciseJumpNav();renderBestSoFar();saveAppData();
}
function openAddExerciseModal(){openModal(card=>{
  modalTitle(card,"Add Exercise","Pick something from your exercise library, or create a new exercise. History follows the exercise even if you move it between workouts.");
  const search=makeField("Search exercises","text","","Exercise name");card.appendChild(search.wrap);
  const picker=document.createElement("div");picker.className="exercise-picker";card.appendChild(picker);
  const addToTemplate=document.createElement("label");addToTemplate.className="toggle-row";addToTemplate.innerHTML='<input type="checkbox" checked><span>Also add it to this workout template</span>';card.appendChild(addToTemplate);
  const createWrap=document.createElement("div");createWrap.innerHTML='<h3>Create New Exercise</h3>';
  const newName=makeField("Exercise name","text","","e.g. Incline Dumbbell Press"),tracking=makeField("Tracking","select");[["weighted","Weight × reps"],["reps","Reps"],["time","Time"],["free","Free-form"]].forEach(([v,l])=>{const o=document.createElement("option");o.value=v;o.textContent=l;tracking.input.appendChild(o);});
  const createBtn=document.createElement("button");createBtn.type="button";createBtn.className="secondary-action";createBtn.textContent="Create & Add Exercise";createBtn.addEventListener("click",()=>{const n=normText(newName.input.value);if(!n)return showToast("Enter an exercise name first.");const ex=ensureExercise(n,tracking.input.value);addExerciseToSession(ex.id,addToTemplate.querySelector("input").checked);saveAppData();closeModal();showToast(`${ex.name} added.`);});
  createWrap.append(newName.wrap,tracking.wrap,createBtn);card.appendChild(createWrap);
  const render=()=>{picker.innerHTML="";const q=normText(search.input.value).toLowerCase();appData.exerciseLibrary.filter(e=>!q||e.name.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)).forEach(e=>{const b=document.createElement("button");b.type="button";b.className="library-chip";b.textContent=e.name;b.addEventListener("click",()=>{addExerciseToSession(e.id,addToTemplate.querySelector("input").checked);closeModal();showToast(`${e.name} added.`);});picker.appendChild(b);});};search.input.addEventListener("input",render);render();
});}
addExerciseButton.addEventListener("click",openAddExerciseModal);

function openNewWorkoutModal(){openModal(card=>{
  modalTitle(card,"New Workout","Create a reusable workout template. You can change its exercises any time without losing old history.");
  const name=makeField("Workout name","text","","e.g. Upper Body"),emoji=makeField("Emoji","text","🏋️","🏋️"),cardioToggle=document.createElement("label");cardioToggle.className="toggle-row";cardioToggle.innerHTML='<input type="checkbox"><span>Include cardio tracking fields</span>';card.append(name.wrap,emoji.wrap,cardioToggle);
  const h=document.createElement("h3");h.textContent="Exercises";card.appendChild(h);const picker=document.createElement("div");picker.className="exercise-picker";card.appendChild(picker);const selected=new Set();
  appData.exerciseLibrary.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(e=>{const b=document.createElement("button");b.type="button";b.className="library-chip";b.textContent=e.name;b.addEventListener("click",()=>{selected.has(e.id)?selected.delete(e.id):selected.add(e.id);b.classList.toggle("selected",selected.has(e.id));});picker.appendChild(b);});
  modalActions(card,()=>{const n=normText(name.input.value);if(!n)return showToast("Give the workout a name.");if(appData.templates.some(t=>t.name.toLowerCase()===n.toLowerCase()))return showToast("A workout with that name already exists.");const t={id:uid("tpl"),name:n,emoji:normText(emoji.input.value)||"🏋️",cardio:cardioToggle.querySelector("input").checked,exerciseIds:[...selected]};appData.templates.push(t);saveAppData();closeModal();renderWorkoutGrid();selectTemplate(t.id);showToast(`${n} created.`);},"Create Workout");
});}
newWorkoutButton.addEventListener("click",openNewWorkoutModal);

function openTemplateEditor(templateId){const t=appData.templates.find(x=>x.id===templateId);if(!t)return;openModal(card=>{
  modalTitle(card,`Edit ${t.name}`,"Reorder, add, or remove exercises. Historical workouts and PRs stay attached to each exercise.");
  const name=makeField("Workout name","text",t.name),emoji=makeField("Emoji","text",t.emoji||"🏋️");const cardioToggle=document.createElement("label");cardioToggle.className="toggle-row";cardioToggle.innerHTML=`<input type="checkbox" ${t.cardio?"checked":""}><span>Include cardio tracking fields</span>`;card.append(name.wrap,emoji.wrap,cardioToggle);
  const list=document.createElement("div");list.className="reorder-list";card.appendChild(list);let ids=[...t.exerciseIds];
  const renderList=()=>{list.innerHTML="";ids.forEach((id,i)=>{const e=getExercise(id);if(!e)return;const row=document.createElement("div");row.className="reorder-item";const grip=document.createElement("span");grip.textContent="↕";const label=document.createElement("span");label.textContent=e.name;const up=iconButton("↑","Move up"),down=iconButton("↓","Move down"),rem=iconButton("×","Remove");rem.classList.add("remove");up.addEventListener("click",()=>{if(i<1)return;[ids[i-1],ids[i]]=[ids[i],ids[i-1]];renderList();});down.addEventListener("click",()=>{if(i>=ids.length-1)return;[ids[i+1],ids[i]]=[ids[i],ids[i+1]];renderList();});rem.addEventListener("click",()=>{ids.splice(i,1);renderList();renderPicker();});row.append(grip,label,up,down,rem);list.appendChild(row);});};renderList();
  const addH=document.createElement("h3");addH.textContent="Add Exercise";card.appendChild(addH);const picker=document.createElement("div");picker.className="exercise-picker";card.appendChild(picker);const renderPicker=()=>{picker.innerHTML="";appData.exerciseLibrary.filter(e=>!ids.includes(e.id)).sort((a,b)=>a.name.localeCompare(b.name)).forEach(e=>{const b=document.createElement("button");b.type="button";b.className="library-chip";b.textContent=e.name;b.addEventListener("click",()=>{ids.push(e.id);renderList();renderPicker();});picker.appendChild(b);});};renderPicker();
  modalActions(card,()=>{
    const old=t.name,n=normText(name.input.value)||old;
    if(appData.templates.some(x=>x.id!==t.id&&normText(x.name).toLowerCase()===n.toLowerCase()))return showToast("Another workout already uses that name.");
    t.name=n;t.emoji=normText(emoji.input.value)||"🏋️";t.cardio=cardioToggle.querySelector("input").checked;t.exerciseIds=ids;
    appData.workouts.forEach(w=>{if(w.templateId===t.id)w.workoutType=n;});
    if(appData.drafts[t.id])appData.drafts[t.id]=syncDraftToTemplateStructure(t,appData.drafts[t.id]);
    if(currentTemplateId===t.id)currentWorkoutType=n;
    saveAppData();closeModal();renderWorkoutGrid();
    if(currentTemplateId===t.id){currentDraft=appData.drafts[t.id]||freshDraft(t);appData.drafts[t.id]=currentDraft;renderDraft();}
    showToast("Workout template updated.");
  });
});}

function openExerciseEditor(exerciseId){const e=getExercise(exerciseId);if(!e)return;openModal(card=>{
  modalTitle(card,`Edit ${e.name}`,"Renaming keeps the same exercise identity, so its history and PRs stay connected.");const name=makeField("Exercise name","text",e.name),tracking=makeField("Tracking","select");[["weighted","Weight × reps"],["reps","Reps"],["time","Time"],["free","Free-form"]].forEach(([v,l])=>{const o=document.createElement("option");o.value=v;o.textContent=l;tracking.input.appendChild(o);});tracking.input.value=e.tracking;card.append(name.wrap,tracking.wrap);
  modalActions(card,()=>{const n=normText(name.input.value);if(!n)return showToast("Exercise name cannot be blank.");const conflict=appData.exerciseLibrary.find(x=>x.id!==e.id&&x.name.toLowerCase()===n.toLowerCase());if(conflict)return showToast("Another exercise already uses that name.");e.name=n;e.tracking=tracking.input.value;appData.workouts.forEach(w=>(w.exercises||[]).forEach(ex=>{if(ex.exerciseId===e.id)ex.name=n;}));Object.values(appData.drafts||{}).forEach(d=>(d?.exercises||[]).forEach(ex=>{if(ex.exerciseId===e.id)ex.name=n;}));saveAppData();closeModal();renderWorkoutGrid();if(currentTemplateId)renderDraft();renderProgress();showToast("Exercise updated without breaking its history.");});
});}

function openManageWorkoutsModal(){openModal(card=>{
  modalTitle(card,"Manage Workouts","Your workouts are templates. Exercises keep their history even when moved between templates.");
  const th=document.createElement("h3");th.textContent="Workout Templates";card.appendChild(th);const templates=document.createElement("div");card.appendChild(templates);
  appData.templates.forEach(t=>{const row=document.createElement("div");row.className="template-row";const main=document.createElement("div");main.className="grow";main.innerHTML=`<strong>${escapeHtml(t.emoji||"🏋️")} ${escapeHtml(t.name)}</strong><small>${t.exerciseIds.length} exercises${t.cardio?" · cardio fields":""}</small>`;const acts=document.createElement("div");acts.className="row-actions";const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>openTemplateEditor(t.id));const del=document.createElement("button");del.type="button";del.className="danger";del.textContent="Delete";del.addEventListener("click",()=>{if(!confirm(`Delete the ${t.name} template? Saved workout history will stay.`))return;appData.templates=appData.templates.filter(x=>x.id!==t.id);delete appData.drafts[t.id];if(currentTemplateId===t.id){currentTemplateId="";currentWorkoutType="";currentDraft=null;sessionArea.classList.add("hidden");saveDock.classList.add("hidden");}saveAppData();closeModal();renderWorkoutGrid();showToast("Template deleted. History kept.");});acts.append(edit,del);row.append(main,acts);templates.appendChild(row);});
  const eh=document.createElement("h3");eh.textContent="Exercise Library";card.appendChild(eh);const lib=document.createElement("div");card.appendChild(lib);appData.exerciseLibrary.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(e=>{const row=document.createElement("div");row.className="library-row";const main=document.createElement("div");main.className="grow";main.innerHTML=`<strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.tracking)}</small>`;const acts=document.createElement("div");acts.className="row-actions";const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>openExerciseEditor(e.id));acts.appendChild(edit);row.append(main,acts);lib.appendChild(row);});
  const create=document.createElement("button");create.type="button";create.className="secondary-action";create.textContent="＋ Create Exercise";create.addEventListener("click",()=>{closeModal();openAddExerciseModal();});card.appendChild(create);const close=document.createElement("button");close.type="button";close.className="secondary-action";close.textContent="Done";close.addEventListener("click",closeModal);card.appendChild(close);
});}
manageWorkoutsButton.addEventListener("click",()=>{saveCurrentDraft();openManageWorkoutsModal();});

// =========================
// SAVE + HISTORY + PR BADGES
// =========================
function historicalBestMapForWorkout(workout,excludeWorkoutId=null){
  const map=new Map();const loc=normText(workout.location);(workout.exercises||[]).forEach(ex=>{if(ex.excludeFromPR)return;const best=bestForExercise(ex.exerciseId,ex.name,loc,excludeWorkoutId,workout.workoutType);if(best)map.set(ex.exerciseId||normText(ex.name).toLowerCase(),best);});return map;
}
function detectNewPRs(workout,excludeWorkoutId=null){
  const prs=[];if(workout.excludeFromPR)return prs;const loc=normText(workout.location),priorMap=historicalBestMapForWorkout(workout,excludeWorkoutId);
  (workout.exercises||[]).forEach(ex=>{if(ex.excludeFromPR)return;const perf=bestPerformanceForExercise(ex);if(!perf||perf.comparable===false)return;const key=ex.exerciseId||normText(ex.name).toLowerCase(),prior=priorMap.get(key);if(!prior||(prior.metric===perf.metric&&perf.score>prior.score))prs.push({kind:"exercise",exerciseId:ex.exerciseId,name:getExercise(ex.exerciseId)?.name||ex.name,display:perf.display,location:loc});});
  if(currentTemplate()?.cardio||workout.cardio){const old=cardioBestRows(loc,excludeWorkoutId);const pp=old.find(x=>x.metric==="pace"),np=paceToSeconds(workout.cardio?.pace);if(np!=null&&(!pp||np<pp.score))prs.push({kind:"cardio",name:"Fastest pace",display:`${workout.cardio.pace} /mi`,location:loc});const ps=old.find(x=>x.metric==="spm"),ns=Number(workout.cardio?.spm);if(Number.isFinite(ns)&&ns>0&&(!ps||ns>ps.score))prs.push({kind:"cardio",name:"StairMaster",display:`${ns} SPM`,location:loc});}
  return prs;
}
function sessionHasResults(draft){return (draft.exercises||[]).some(ex=>filledSets(ex).length)||(currentTemplate()?.cardio&&Object.entries(draft.cardio||{}).some(([k,v])=>k!=="type"&&normText(v)));}
function saveWorkout(){
  saveCurrentDraft();const d=currentDraft;if(!d)return;if(!sessionHasResults(d)&&!confirm("There are no set results or cardio numbers yet. Save this workout anyway?"))return;
  const existingId=d.existingWorkoutId||null,prs=detectNewPRs(d,existingId),now=new Date().toISOString(),id=existingId||uid("workout"),idx=appData.workouts.findIndex(w=>w.id===id),old=idx>=0?appData.workouts[idx]:null;
  const previousAchieved=Array.isArray(old?.achievedPRs)?old.achievedPRs:[];
  const newlyAchieved=prs.map(p=>({...p,at:now}));
  const achievedPRs=existingId
    ? [...previousAchieved,...newlyAchieved.filter(p=>!previousAchieved.some(oldPr=>oldPr.name===p.name&&oldPr.display===p.display&&sameLocation(oldPr.location,p.location)))]
    : newlyAchieved;
  const workout={...d,id,templateId:currentTemplateId,workoutType:currentTemplate()?.name||d.workoutType,savedAt:old?.savedAt||now,updatedAt:existingId?now:(old?.updatedAt||null),achievedPRs};delete workout.existingWorkoutId;
  if(idx>=0)appData.workouts[idx]=workout;else appData.workouts.push(workout);
  if(existingId){currentDraft=freshDraft(currentTemplate());appData.drafts[currentTemplateId]=currentDraft;}else{currentDraft={...d,existingWorkoutId:id,savedAt:now};appData.drafts[currentTemplateId]=currentDraft;}
  saveAppData();renderDraft();renderHistory();renderProgress();
  if(existingId)showToast(prs.length?`Workout updated · 🏆 ${prs.length} new PR${prs.length>1?"s":""}. New session ready.`:"Workout updated. New session ready.",Boolean(prs),3600);
  else if(prs.length)showToast(`🏆 NEW PR${prs.length>1?"S":""}\n${prs.slice(0,4).map(p=>`${p.name}: ${p.display}`).join("\n")}${prs.length>4?`\n+${prs.length-4} more`:""}`,true,4200);else showToast("Workout saved.");
}
saveWorkoutButton.addEventListener("click",saveWorkout);

function cardioToText(c){if(!c)return "";return [["Type",c.type],["Calories",c.calories],["Distance",c.distance?`${c.distance} mi`:""],["Time",c.time],["Pace",c.pace?`${c.pace} /mi`:""],["Speed",c.speed?`${c.speed} mph`:""],["Feet Climbed",c.feetClimbed],["Steps",c.steps],["SPM",c.spm],["Note",c.note]].filter(([,v])=>normText(v)).map(([k,v])=>`${k}: ${v}`).join("\n");}
function workoutToText(w){
  const lines=[`${w.workoutType||"Workout"} — ${formatDate(w.date)}`];if(w.location)lines.push(`Location: ${w.location}`);if(w.bodyWeight)lines.push(`Body Weight: ${w.bodyWeight} lb`);if(w.sessionNote)lines.push(`Before: ${w.sessionNote}`);if(w.cardio&&Object.entries(w.cardio).some(([k,v])=>k!=="type"&&normText(v))){lines.push("",cardioToText(w.cardio));}
  (w.exercises||[]).forEach(ex=>{lines.push("",getExercise(ex.exerciseId)?.name||ex.name||"Exercise");if(ex.note)lines.push(`Note: ${ex.note}`);const sets=ex.sets||[];sets.forEach((s,i)=>{if(normText(s.entry)||normText(s.note))lines.push(`Set ${i+1}: ${s.entry||"—"}${s.note?` — ${s.note}`:""}`);});});if(w.overallWorkoutNote)lines.push("",`End: ${w.overallWorkoutNote}`);return lines.join("\n");
}
function workoutCurrentPRs(workout){
  if(!workout||workout.excludeFromPR)return[];const prs=[],loc=normText(workout.location);
  (workout.exercises||[]).forEach(ex=>{if(ex.excludeFromPR)return;const perf=bestPerformanceForExercise(ex);if(!perf||perf.comparable===false)return;const best=bestForExercise(ex.exerciseId,ex.name,loc,null,workout.workoutType);if(best?.workout?.id===workout.id)prs.push({kind:"exercise",exerciseId:ex.exerciseId,name:getExercise(ex.exerciseId)?.name||ex.name,display:best.display,location:loc});});
  cardioBestRows(loc).forEach(row=>{if(row.workoutId===workout.id)prs.push({kind:"cardio",name:row.name,display:row.display,location:loc});});return prs;
}
function createHistoryPRDetails(workout){
  const current=workoutCurrentPRs(workout),achieved=Array.isArray(workout.achievedPRs)?workout.achievedPRs:[];if(!current.length&&!achieved.length)return null;const section=document.createElement("section");section.className="history-pr-details";
  if(current.length){const h=document.createElement("div");h.className="history-pr-details-title";h.textContent=`🏆 Current bests${workout.location?` at ${workout.location}`:""}`;section.appendChild(h);current.forEach(pr=>{const r=document.createElement("div");r.className="history-pr-detail-row";r.innerHTML=`<strong>${escapeHtml(pr.name)}</strong><span>${escapeHtml(pr.display)}</span>`;section.appendChild(r);});}
  const oldAchieved=achieved.filter(a=>!current.some(c=>c.name===a.name&&c.display===a.display));if(oldAchieved.length){const h=document.createElement("div");h.className="history-pr-details-title secondary";h.textContent="PRs achieved on this day";section.appendChild(h);oldAchieved.forEach(pr=>{const r=document.createElement("div");r.className="history-pr-detail-row past";r.innerHTML=`<strong>${escapeHtml(pr.name)}</strong><span>${escapeHtml(pr.display)}</span>`;section.appendChild(r);});}
  return section;
}
function historyFilterOptions(){const vals=["All",...appData.templates.map(t=>t.name),...appData.workouts.map(w=>w.workoutType).filter(Boolean)];return [...new Set(vals)];}
function renderHistoryFilters(){if(!historyFilters)return;const opts=historyFilterOptions();if(!opts.includes(historyFilter))historyFilter="All";historyFilters.innerHTML="";opts.forEach(v=>{const b=document.createElement("button");b.type="button";b.className="history-filter"+(v===historyFilter?" active-filter":"");b.textContent=v==="All"?"All":v.replace(" Day","");b.addEventListener("click",()=>{historyFilter=v;renderHistoryFilters();renderHistory();});historyFilters.appendChild(b);});}
function renderHistory(){
  if(!historyList)return;historyList.innerHTML="";renderHistoryFilters();const list=sortNewest(appData.workouts).filter(w=>historyFilter==="All"||w.workoutType===historyFilter);if(!list.length){historyList.innerHTML='<div class="empty-state">No workouts saved here yet.</div>';return;}
  list.forEach(w=>{const details=document.createElement("details");details.className="history-entry";const summary=document.createElement("summary"),row=document.createElement("div");row.className="history-summary-row";const left=document.createElement("div"),title=document.createElement("div"),sub=document.createElement("div");title.textContent=`${w.workoutType} · ${formatDate(w.date,true)}`;sub.className="history-subtitle";sub.textContent=[w.location,w.bodyWeight?`${w.bodyWeight} lb`:""].filter(Boolean).join(" · ")||`${(w.exercises||[]).length} exercises`;left.append(title,sub);row.appendChild(left);const prs=workoutCurrentPRs(w);if(prs.length){const badge=document.createElement("span");badge.className="history-pr-badge";badge.textContent=`🏆 ${prs.length} PR${prs.length>1?"s":""}${w.location?` · ${w.location}`:""}`;row.appendChild(badge);}summary.appendChild(row);
    const prDetails=createHistoryPRDetails(w),pre=document.createElement("pre");pre.textContent=workoutToText(w);const actions=document.createElement("div");actions.className="history-actions";
    const copy=document.createElement("button");copy.type="button";copy.textContent="Copy";copy.addEventListener("click",async e=>{e.preventDefault();try{await navigator.clipboard.writeText(workoutToText(w));showToast("Workout copied.");}catch{showToast("Could not copy automatically.");}});
    const edit=document.createElement("button");edit.type="button";edit.textContent="Edit";edit.addEventListener("click",e=>{e.preventDefault();let t=appData.templates.find(t=>t.id===w.templateId)||templateByName(w.workoutType);if(!t){t={id:uid("tpl"),name:w.workoutType||"Workout",emoji:"🏋️",cardio:Boolean(w.cardio),exerciseIds:(w.exercises||[]).map(ex=>ex.exerciseId).filter(Boolean)};appData.templates.push(t);}selectTemplate(t.id,workoutToDraft(w));showScreen("log");showToast("Editing saved workout.");});
    const del=document.createElement("button");del.type="button";del.className="delete-history";del.textContent="Delete";del.addEventListener("click",e=>{e.preventDefault();if(!confirm(`Delete this ${w.workoutType} from ${formatDate(w.date)}?`))return;appData.workouts=appData.workouts.filter(x=>x.id!==w.id);Object.keys(appData.drafts).forEach(k=>{if(appData.drafts[k]?.existingWorkoutId===w.id)delete appData.drafts[k];});if(currentDraft?.existingWorkoutId===w.id){currentDraft=freshDraft(currentTemplate());appData.drafts[currentTemplateId]=currentDraft;renderDraft();}saveAppData();renderHistory();renderProgress();showToast("Workout deleted.");});
    actions.append(copy,edit,del);details.appendChild(summary);if(prDetails)details.appendChild(prDetails);details.append(pre,actions);historyList.appendChild(details);
  });
}
function workoutToDraft(w){const t=appData.templates.find(t=>t.id===w.templateId)||templateByName(w.workoutType);const blank=t?freshDraft(t):{cardio:{}};return {...blank,...w,templateId:t?.id||w.templateId,cardio:{...(blank.cardio||{}),...(w.cardio||{})},exercises:(w.exercises||[]).map(normalizeExerciseRecord),existingWorkoutId:w.id};}

// =========================
// PROGRESS
// =========================
function getBodyWeightEntries(){return sortNewest(appData.workouts).reverse().map(w=>({date:w.date,value:Number(w.bodyWeight)})).filter(x=>Number.isFinite(x.value)&&x.value>0);}
function uniqueExerciseOptions(){
  const seen=new Set(),out=[];appData.workouts.forEach(w=>(w.exercises||[]).forEach(ex=>{const id=ex.exerciseId||ensureExercise(ex.name,inferTracking(ex.name)).id;if(seen.has(id))return;seen.add(id);const lib=getExercise(id);out.push({id,name:lib?.name||ex.name||"Exercise"});}));
  appData.exerciseLibrary.forEach(e=>{if(!seen.has(e.id)&&appData.templates.some(t=>t.exerciseIds.includes(e.id))){seen.add(e.id);out.push({id:e.id,name:e.name});}});return out.sort((a,b)=>a.name.localeCompare(b.name));
}
function currentPRCountAllLocations(){
  const combos=new Map();appData.workouts.filter(w=>!w.excludeFromPR).forEach(w=>(w.exercises||[]).forEach(ex=>{if(ex.excludeFromPR)return;const key=`${ex.exerciseId||normText(ex.name).toLowerCase()}|${locationKey(w.location)}`;if(!combos.has(key))combos.set(key,{id:ex.exerciseId,name:ex.name,location:normText(w.location)});}));
  let count=0;combos.forEach(x=>{if(bestForExercise(x.id,x.name,x.location,null,""))count++;});return count;
}
function renderProgress(){if(!progressSummary)return;renderProgressSummary();renderWeightProgress();populateExerciseProgressSelect();renderSelectedExerciseProgress();}
function renderProgressSummary(){
  progressSummary.innerHTML="";const locations=new Set(appData.workouts.map(w=>locationKey(w.location)).filter(Boolean));const vals=[[appData.workouts.length,"Saved workouts"],[uniqueExerciseOptions().length,"Exercises tracked"],[locations.size,"Gym locations"],[currentPRCountAllLocations(),"Location PRs"]];vals.forEach(([v,l])=>{const c=document.createElement("div");c.className="summary-card";c.innerHTML=`<div class="summary-value">${escapeHtml(v)}</div><div class="summary-label">${escapeHtml(l)}</div>`;progressSummary.appendChild(c);});
}
function renderWeightProgress(){
  const entries=getBodyWeightEntries();weightStats.innerHTML="";if(!entries.length){weightTrendLabel.className="trend-chip neutral";weightTrendLabel.textContent="No data";weightChart.innerHTML='<div class="chart-empty">Add body weight to workouts to see a trend.</div>';return;}
  const latest=entries.at(-1),previous=entries.length>1?entries.at(-2):null,first=entries[0],change=previous?latest.value-previous.value:null,overall=latest.value-first.value;addProgressStat(weightStats,`${latest.value} lb`,"Latest",formatDate(latest.date,true));addProgressStat(weightStats,change==null?"—":`${change>=0?"+":""}${change.toFixed(1)} lb`,"Since previous");addProgressStat(weightStats,entries.length<2?"—":`${overall>=0?"+":""}${overall.toFixed(1)} lb`,"Since first logged");weightTrendLabel.className="trend-chip neutral";weightTrendLabel.textContent=change==null?"Need more data":change>.2?"↑ Up":change<-.2?"↓ Down":"→ Steady";renderSparkline(weightChart,entries.slice(-12).map(x=>x.value));
}
function populateExerciseProgressSelect(){
  const old=progressExerciseSelect.value,opts=uniqueExerciseOptions();progressExerciseSelect.innerHTML="";if(!opts.length){progressExerciseSelect.innerHTML='<option value="">No exercise data yet</option>';progressLocationSelect.innerHTML='<option value="">No locations</option>';return;}
  opts.forEach(e=>{const o=document.createElement("option");o.value=e.id;o.textContent=e.name;progressExerciseSelect.appendChild(o);});if(opts.some(e=>e.id===old))progressExerciseSelect.value=old;else progressExerciseSelect.value=opts[0].id;populateProgressLocationSelect();
}
function locationsForExercise(exerciseId){const seen=new Map();sortNewest(appData.workouts).forEach(w=>{if(!(w.exercises||[]).some(ex=>ex.exerciseId===exerciseId&&filledSets(ex).length))return;const key=locationKey(w.location);if(key&&!seen.has(key))seen.set(key,normText(w.location));});return [...seen.values()];}
function populateProgressLocationSelect(){
  const old=progressLocationSelect.value,id=progressExerciseSelect.value,locs=locationsForExercise(id);progressLocationSelect.innerHTML="";const all=document.createElement("option");all.value="__all__";all.textContent="All locations (comparison only)";progressLocationSelect.appendChild(all);locs.forEach(loc=>{const o=document.createElement("option");o.value=loc;o.textContent=loc;progressLocationSelect.appendChild(o);});
  if([...progressLocationSelect.options].some(o=>o.value===old))progressLocationSelect.value=old;else if(locs.length)progressLocationSelect.value=locs[0];else progressLocationSelect.value="__all__";
}
progressExerciseSelect.addEventListener("change",()=>{populateProgressLocationSelect();renderSelectedExerciseProgress();});progressLocationSelect.addEventListener("change",renderSelectedExerciseProgress);
function renderSelectedExerciseProgress(){
  exerciseProgressStats.innerHTML="";exerciseProgressHistory.innerHTML="";const id=progressExerciseSelect.value;if(!id){exerciseProgressChart.innerHTML='<div class="chart-empty">Save workout data to see exercise progress.</div>';return;}const lib=getExercise(id),locValue=progressLocationSelect.value,location=locValue&&locValue!=="__all__"?locValue:null;
  const sessions=getExerciseSessions(id,lib?.name||"Exercise",{location,requireFilled:true}).filter(s=>s.performance);if(!sessions.length){exerciseProgressChart.innerHTML='<div class="chart-empty">No parsable results for this exercise at this location yet.</div>';return;}
  const best=bestForExercise(id,lib?.name||sessions[0].exercise.name,location,null,""),latest=sessions[0],previous=sessions[1]||null,trend=trendFromSessions(sessions);addProgressStat(exerciseProgressStats,best?.display||"—","Best so far",best?.workout?.date?formatDate(best.workout.date,true):"");addProgressStat(exerciseProgressStats,latest.performance?.display||"—","Latest",`${formatDate(latest.workout.date,true)}${latest.workout.location?` · ${latest.workout.location}`:""}`);addProgressStat(exerciseProgressStats,trend.label.replace(/[↑↓→]\s*/,""),"Recent trend",previous?`vs ${formatDate(previous.workout.date,true)}`:"Need another workout");
  const chartSessions=[...sessions].reverse().filter(s=>s.performance?.metric===best?.metric).slice(-12);renderSparkline(exerciseProgressChart,chartSessions.map(s=>s.performance.trendScore??s.performance.score));sessions.slice(0,8).forEach(s=>{const r=document.createElement("div");r.className="mini-history-row";const d=document.createElement("span");d.textContent=`${formatDate(s.workout.date,true)}${location===null&&s.workout.location?` · ${s.workout.location}`:""}`;const v=document.createElement("span");const isBest=best?.workout?.id===s.workout.id;v.textContent=`${isBest?"🏆 ":""}${s.performance.display}`;if(isBest)r.classList.add("current-best-row");r.append(d,v);exerciseProgressHistory.appendChild(r);});
}
function addProgressStat(container,value,label,detail=""){const s=document.createElement("div");s.className="progress-stat";const strong=document.createElement("strong");strong.textContent=value;const span=document.createElement("span");span.textContent=label;s.append(strong,span);if(detail){const small=document.createElement("small");small.textContent=detail;s.appendChild(small);}container.appendChild(s);}
function renderSparkline(container,values){
  container.innerHTML="";if(!values||values.length<2||values.some(v=>!Number.isFinite(Number(v)))){container.innerHTML=`<div class="chart-empty">${values?.length===1?"One point logged — add another to see a trend.":"Not enough data for a chart yet."}</div>`;return;}const nums=values.map(Number);let min=Math.min(...nums),max=Math.max(...nums);if(max===min){max+=1;min-=1;}const pts=nums.map((v,i)=>[12+(i/(nums.length-1))*276,88-((v-min)/(max-min))*70]),line=pts.map(p=>p.join(",")).join(" "),area=`12,98 ${line} 288,98`;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 300 100");const poly=document.createElementNS(svg.namespaceURI,"polygon");poly.setAttribute("points",area);poly.setAttribute("class","chart-area");const pl=document.createElementNS(svg.namespaceURI,"polyline");pl.setAttribute("points",line);pl.setAttribute("class","chart-line");svg.append(poly,pl);pts.forEach(([cx,cy])=>{const c=document.createElementNS(svg.namespaceURI,"circle");c.setAttribute("cx",cx);c.setAttribute("cy",cy);c.setAttribute("r","3.5");c.setAttribute("class","chart-dot");svg.appendChild(c);});container.appendChild(svg);
}


// =========================
// CHECKPOINT 2: DATA SAFETY + EXPORT
// =========================
function escapeHtml(value){
  return String(value??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function showToast(message,pr=false,duration=2600){
  if(!toast)return;
  clearTimeout(toastTimer);
  toast.textContent=message;
  toast.classList.remove("hidden","pr-toast");
  if(pr)toast.classList.add("pr-toast");
  toastTimer=setTimeout(()=>toast.classList.add("hidden"),duration);
}

function backupState(){
  const age=daysSince(appData.lastBackupAt);
  const added=Math.max(0,appData.workouts.length-(Number(appData.lastBackupWorkoutCount)||0));
  const needed=!appData.lastBackupAt||age>=BACKUP_REMINDER_DAYS||added>=BACKUP_REMINDER_WORKOUTS;
  return {age,added,needed};
}

function updateBackupReminder(){
  if(!backupReminder)return;
  const state=backupState();
  backupReminder.classList.toggle("hidden",!state.needed);
  if(!state.needed)return;
  if(!appData.lastBackupAt){
    backupReminderTitle.textContent="Make your first backup";
    backupReminderText.textContent="Export a JSON copy so your workout history and custom routines are protected.";
  }else if(state.added>=BACKUP_REMINDER_WORKOUTS){
    backupReminderTitle.textContent="New workouts need a backup";
    backupReminderText.textContent=`${state.added} workout${state.added===1?"":"s"} added since your last backup.`;
  }else{
    backupReminderTitle.textContent="Backup is getting old";
    backupReminderText.textContent=`Your last backup was ${state.age} day${state.age===1?"":"s"} ago.`;
  }
}

function updateBackupStatus(){
  if(!backupStatusText||!backupStatusCard)return;
  const state=backupState();
  backupStatusCard.classList.remove("warning","good");
  if(!appData.lastBackupAt){
    backupStatusText.textContent="No full backup exported yet. Your workouts currently live only on this device.";
    backupStatusCard.classList.add("warning");
  }else{
    const ageText=state.age===0?"today":`${state.age} day${state.age===1?"":"s"} ago`;
    const addedText=state.added?` · ${state.added} new workout${state.added===1?"":"s"} since then`:" · no new workouts since then";
    backupStatusText.textContent=`Last backup: ${formatDateTime(appData.lastBackupAt)} (${ageText})${addedText}.`;
    backupStatusCard.classList.add(state.needed?"warning":"good");
  }
  undoRestoreButton?.classList.toggle("hidden",!localStorage.getItem(PRE_RESTORE_KEY));
}

function makeDownload(content,filename,type){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function exportFullBackup(){
  saveCurrentDraft();
  const at=new Date().toISOString();
  appData.lastBackupAt=at;
  appData.lastBackupWorkoutCount=appData.workouts.length;
  appData.backupHistory=[{at,count:appData.workouts.length,version:APP_VERSION},...(appData.backupHistory||[])].slice(0,12);
  saveAppData();
  makeDownload(JSON.stringify(appData,null,2),`WorkoutTracker-v5-Backup-${todayValue()}.json`,"application/json");
  updateBackupStatus();
  showToast("Full backup created. Save the JSON file somewhere safe.");
}

function remapImportedData(incoming,current){
  const mergedLibrary=(current.exerciseLibrary||[]).map(e=>({...e}));
  const nameToId=new Map(mergedLibrary.map(e=>[normText(e.name).toLowerCase(),e.id]));
  const usedIds=new Set(mergedLibrary.map(e=>e.id));
  const incomingIdMap=new Map();

  (incoming.exerciseLibrary||[]).forEach(e=>{
    const key=normText(e.name).toLowerCase();
    let targetId=nameToId.get(key);
    if(!targetId){
      targetId=e.id&&!usedIds.has(e.id)?e.id:uid("ex");
      const copy={id:targetId,name:normText(e.name)||"Exercise",tracking:["weighted","reps","time","free"].includes(e.tracking)?e.tracking:"weighted"};
      mergedLibrary.push(copy);nameToId.set(key,targetId);usedIds.add(targetId);
    }
    incomingIdMap.set(e.id,targetId);
  });

  function mapExercise(ex){
    const copy=JSON.parse(JSON.stringify(ex||{}));
    let target=copy.exerciseId?incomingIdMap.get(copy.exerciseId):null;
    if(!target){
      const key=normText(copy.name).toLowerCase();
      target=nameToId.get(key);
      if(!target){
        target=uid("ex");mergedLibrary.push({id:target,name:normText(copy.name)||"Exercise",tracking:inferTracking(copy.name)});nameToId.set(key,target);usedIds.add(target);
      }
    }
    copy.exerciseId=target;
    const lib=mergedLibrary.find(e=>e.id===target);if(lib)copy.name=lib.name;
    return copy;
  }

  const workouts=(incoming.workouts||[]).map(w=>({...JSON.parse(JSON.stringify(w)),exercises:(w.exercises||[]).map(mapExercise)}));
  const templates=(incoming.templates||[]).map(t=>({...JSON.parse(JSON.stringify(t)),exerciseIds:(t.exerciseIds||[]).map(id=>incomingIdMap.get(id)||id).filter(id=>mergedLibrary.some(e=>e.id===id))}));
  const drafts={};
  Object.entries(incoming.drafts||{}).forEach(([key,d])=>{
    const copy=JSON.parse(JSON.stringify(d||{}));
    copy.exercises=(copy.exercises||[]).map(mapExercise);
    drafts[key]=copy;
  });
  return {...incoming,exerciseLibrary:mergedLibrary,workouts,templates,drafts};
}

function mergeAppData(current,incomingRaw){
  const incoming=remapImportedData(normalizeAppData(incomingRaw),current);
  const workoutMap=new Map();
  [...(current.workouts||[]),...(incoming.workouts||[])].forEach(w=>{
    const fallback=[w.workoutType||"",w.date||"",locationKey(w.location),JSON.stringify((w.exercises||[]).map(ex=>[ex.exerciseId||normText(ex.name),ex.sets||[]]))].join("|");
    const key=w.id||fallback;
    const existing=workoutMap.get(key);
    if(!existing||new Date(w.savedAt||0).getTime()>=new Date(existing.savedAt||0).getTime())workoutMap.set(key,w);
  });

  const templates=(current.templates||[]).map(t=>({...t,exerciseIds:[...(t.exerciseIds||[])]}));
  incoming.templates.forEach(t=>{
    const existing=templates.find(x=>normText(x.name).toLowerCase()===normText(t.name).toLowerCase());
    if(!existing)templates.push({...t,id:templates.some(x=>x.id===t.id)?uid("tpl"):t.id});
  });
  // A merged backup may have a different template ID for a workout with the
  // same template name. Rebind by workoutType so Repeat Last and editing still
  // work after a merge instead of leaving stale foreign template IDs behind.
  const mergedWorkouts=[...workoutMap.values()].map(w=>{
    const match=templates.find(t=>normText(t.name).toLowerCase()===normText(w.workoutType).toLowerCase());
    return match?{...w,templateId:match.id}:w;
  });

  const history=[...(current.backupHistory||[]),...(incoming.backupHistory||[])]
    .map(x=>typeof x==="string"?{at:x}:x).filter(x=>x?.at)
    .sort((a,b)=>new Date(b.at)-new Date(a.at));
  const seen=new Set();
  const backupHistory=history.filter(x=>{if(seen.has(x.at))return false;seen.add(x.at);return true;}).slice(0,12);

  return normalizeAppData({
    ...current,
    version:APP_VERSION,
    workouts:mergedWorkouts,
    templates,
    exerciseLibrary:incoming.exerciseLibrary,
    drafts:{...(incoming.drafts||{}),...(current.drafts||{})},
    settings:{...(incoming.settings||{}),...(current.settings||{}),locationNames:{...(incoming.settings?.locationNames||{}),...(current.settings?.locationNames||{})}},
    lastBackupAt:current.lastBackupAt||incoming.lastBackupAt||null,
    lastBackupWorkoutCount:Number(current.lastBackupWorkoutCount)||0,
    backupHistory
  });
}

function resetCurrentUiAfterImport(){
  currentTemplateId="";currentWorkoutType="";currentDraft=null;
  sessionArea?.classList.add("hidden");saveDock?.classList.add("hidden");
  renderWorkoutGrid();renderHistory();renderProgress();updateBackupReminder();updateBackupStatus();
  showScreen("log");
}

function validateBackupObject(parsed){
  return parsed&&typeof parsed==="object"&&Array.isArray(parsed.workouts);
}

async function importBackupFile(file,mode){
  const text=await file.text();
  const parsed=JSON.parse(text);
  if(!validateBackupObject(parsed))throw new Error("Invalid workout backup");
  localStorage.setItem(PRE_RESTORE_KEY,JSON.stringify(appData));
  if(mode==="replace"){
    const incoming=normalizeAppData(parsed);
    if(!confirm(`This backup contains ${incoming.workouts.length} workout${incoming.workouts.length===1?"":"s"}. Replace the ${appData.workouts.length} currently stored workout${appData.workouts.length===1?"":"s"}?`))return false;
    appData=incoming;
    saveAppData();resetCurrentUiAfterImport();
    showToast(`Backup restored. ${appData.workouts.length} workout${appData.workouts.length===1?"":"s"} loaded.`);
  }else{
    const before=appData.workouts.length;
    appData=mergeAppData(appData,parsed);
    saveAppData();resetCurrentUiAfterImport();
    const added=Math.max(0,appData.workouts.length-before);
    showToast(`Backup merged safely. ${added} workout${added===1?"":"s"} added.`);
  }
  return true;
}

function exportReadableHistory(){
  saveCurrentDraft();
  const types=[...appData.templates.map(t=>t.name),...appData.workouts.map(w=>w.workoutType).filter(Boolean)].filter((v,i,a)=>a.indexOf(v)===i);
  const sections=types.map(type=>{
    const workouts=sortNewest(appData.workouts.filter(w=>w.workoutType===type));
    if(!workouts.length)return null;
    return `${type}\n${"=".repeat(type.length)}\n\n${workouts.map(workoutToText).join("\n\n--------------------\n\n")}`;
  }).filter(Boolean);
  const content=sections.length?sections.join("\n\n\n"):"No workouts saved yet.";
  makeDownload(content,`Workout-History-${todayValue()}.txt`,"text/plain;charset=utf-8");
  showToast("Readable workout history exported.");
}

function csvCell(value){return `"${String(value??"").replace(/"/g,'""')}"`;}
function exportCsvHistory(){
  saveCurrentDraft();
  const rows=[["date","workout_type","template_id","location","body_weight","exercise","exercise_id","set_number","set_result","set_note","exercise_note","count_for_pr","cardio_type","distance","time","pace","speed","spm","steps","calories","feet_climbed"]];
  sortNewest(appData.workouts).reverse().forEach(w=>{
    const exercises=(w.exercises||[]).length?w.exercises:[{name:"",exerciseId:"",sets:[{entry:"",note:""}]}];
    exercises.forEach(ex=>{
      const sets=(ex.sets||[]).length?ex.sets:[{entry:"",note:""}];
      sets.forEach((s,i)=>rows.push([
        w.date||"",w.workoutType||"",w.templateId||"",w.location||"",w.bodyWeight||"",getExercise(ex.exerciseId)?.name||ex.name||"",ex.exerciseId||"",i+1,s.entry||"",s.note||"",ex.note||"",(!w.excludeFromPR&&!ex.excludeFromPR)?"yes":"no",
        w.cardio?.type||"",w.cardio?.distance||"",w.cardio?.time||"",w.cardio?.pace||"",w.cardio?.speed||"",w.cardio?.spm||"",w.cardio?.steps||"",w.cardio?.calories||"",w.cardio?.feetClimbed||""
      ]));
    });
  });
  makeDownload(rows.map(r=>r.map(csvCell).join(",")).join("\n"),`Workout-History-${todayValue()}.csv`,"text/csv;charset=utf-8");
  showToast("CSV export created.");
}

backupReminderButton?.addEventListener("click",()=>showScreen("backup"));
exportBackupButton?.addEventListener("click",exportFullBackup);
mergeBackupButton?.addEventListener("click",()=>{importMode="merge";importBackupInput.value="";importBackupInput.click();});
importBackupButton?.addEventListener("click",()=>{if(appData.workouts.length&&!confirm("Replace mode will overwrite the workouts currently stored on this device. An undo snapshot will be created first. Continue?"))return;importMode="replace";importBackupInput.value="";importBackupInput.click();});
importBackupInput?.addEventListener("change",async()=>{
  const file=importBackupInput.files?.[0];if(!file)return;
  try{await importBackupFile(file,importMode);}catch(err){console.error(err);showToast("That file could not be restored. Choose a Workout Tracker JSON backup.");}
  finally{importBackupInput.value="";updateBackupStatus();}
});
undoRestoreButton?.addEventListener("click",()=>{
  const raw=localStorage.getItem(PRE_RESTORE_KEY);if(!raw)return;
  if(!confirm("Undo the most recent restore or merge and return to the data from immediately before it?"))return;
  try{
    const currentSnapshot=JSON.stringify(appData);
    appData=normalizeAppData(JSON.parse(raw));
    localStorage.setItem(PRE_RESTORE_KEY,currentSnapshot);
    saveAppData();resetCurrentUiAfterImport();updateBackupStatus();showToast("Previous data restored. Undo again to swap back if needed.");
  }catch{showToast("Could not undo the restore.");}
});
exportTextButton?.addEventListener("click",exportReadableHistory);
exportCsvButton?.addEventListener("click",exportCsvHistory);

function updateOnlineStatus(){
  if(!topSaveStatus)return;
  topSaveStatus.classList.toggle("offline",!navigator.onLine);
  topSaveStatus.textContent=navigator.onLine?"Saved":"Offline · saved";
}
window.addEventListener("online",updateOnlineStatus);
window.addEventListener("offline",updateOnlineStatus);
window.addEventListener("beforeunload",()=>saveCurrentDraft());
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveCurrentDraft();});

async function registerServiceWorker(){
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    registration.update().catch(() => {});
  } catch (error) {
    console.warn("Service worker registration unavailable:", error);
  }
}

function initApp(){
  updateOnlineStatus();
  renderWorkoutGrid();
  updateBackupReminder();
  updateBackupStatus();
  renderProgress();
  registerServiceWorker();
}
initApp();
