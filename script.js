const STORAGE_KEY = "gursehajWorkoutTracker_v3";
const PRE_RESTORE_KEY = "gursehajWorkoutTracker_preRestore_v4_1";
const APP_VERSION = 4.1;
const BACKUP_REMINDER_DAYS = 7;
const BACKUP_REMINDER_WORKOUTS = 3;

const workoutPresets = {
    "Push Day": ["ISMP", "CF", "LR", "TPD", "SC", "CD"],
    "Pull Day": ["DL", "PU", "LPD", "SCR", "RDM", "PC", "IDC"],
    "Cardio + Abs": ["KR", "DS", "MC", "Regular Sit-ups", "Hollow Body Hold"],
    "Legs Day": ["LP", "LE", "LC", "CR", "AD"]
};

const workoutOrder = ["Push Day", "Pull Day", "Cardio + Abs", "Legs Day"];
const legacyBestSeeds = {
    "Push Day": {
        "ISMP": "90 x 6",
        "CF": "80 x 12",
        "LR": "15 x 16",
        "TPD": "47.5 x 7",
        "SC": "30 x 12",
        "CD": "10 x 6"
    },
    "Pull Day": {
        "DL": "120 x 8",
        "PU": "7 reps",
        "LPD": "85 x 12",
        "SCR": "85 x 8",
        "RDM": "70 x 10",
        "PC": "60 x 11",
        "IDC": "15 x 7"
    },
    "Cardio + Abs": {
        "KR": "7(H)&10",
        "DS": "45 x 8",
        "MC": "120 x 10"
    },
    "Legs Day": {
        "LP": "360 x 9",
        "LE": "130 x 10",
        "LC": "80 x 10",
        "CR": "120 x 10",
        "AD": "140 x 5"
    }
};
const timedExerciseNames = new Set(["hollow body hold", "plank"]);

const $ = id => document.getElementById(id);
const logScreen = $("logScreen");
const historyScreen = $("historyScreen");
const progressScreen = $("progressScreen");
const backupScreen = $("backupScreen");
const navButtons = document.querySelectorAll(".nav-button");
const workoutChoices = document.querySelectorAll(".workout-choice");
const sessionArea = $("sessionArea");
const currentWorkoutTitle = $("currentWorkoutTitle");
const workoutDate = $("workoutDate");
const bodyWeight = $("bodyWeight");
const sessionLocation = $("sessionLocation");
const sessionNote = $("sessionNote");
const overallWorkoutNote = $("overallWorkoutNote");
const countWorkoutForPr = $("countWorkoutForPr");
const cardioSection = $("cardioSection");
const cardioType = $("cardioType");
const calories = $("calories");
const distance = $("distance");
const cardioTime = $("cardioTime");
const pace = $("pace");
const speed = $("speed");
const feetClimbed = $("feetClimbed");
const steps = $("steps");
const spm = $("spm");
const cardioNote = $("cardioNote");
const exerciseList = $("exerciseList");
const addExerciseButton = $("addExerciseButton");
const newSessionButton = $("newSessionButton");
const repeatLastButton = $("repeatLastButton");
const saveWorkoutButton = $("saveWorkoutButton");
const saveDock = $("saveDock");
const topSaveStatus = $("topSaveStatus");
const historyList = $("historyList");
const historyFilters = document.querySelectorAll(".history-filter");
const bestSoFarList = $("bestSoFarList");
const backupReminder = $("backupReminder");
const backupReminderTitle = $("backupReminderTitle");
const backupReminderText = $("backupReminderText");
const backupReminderButton = $("backupReminderButton");
const exportBackupButton = $("exportBackupButton");
const mergeBackupButton = $("mergeBackupButton");
const importBackupButton = $("importBackupButton");
const importBackupInput = $("importBackupInput");
const undoRestoreButton = $("undoRestoreButton");
const exportTextButton = $("exportTextButton");
const exportCsvButton = $("exportCsvButton");
const backupStatusText = $("backupStatusText");
const backupStatusCard = $("backupStatusCard");
const backupHistoryList = $("backupHistoryList");
const progressSummary = $("progressSummary");
const weightTrendLabel = $("weightTrendLabel");
const weightStats = $("weightStats");
const weightChart = $("weightChart");
const progressExerciseSelect = $("progressExerciseSelect");
const exerciseProgressStats = $("exerciseProgressStats");
const exerciseProgressChart = $("exerciseProgressChart");
const exerciseProgressHistory = $("exerciseProgressHistory");
const toast = $("toast");

let appData = loadAppData();
let currentWorkoutType = "";
let currentDraft = null;
let autosaveTimer = null;
let historyFilter = "All";
let importMode = "merge";
let toastTimer = null;

function blankAppData() {
    return {
        version: APP_VERSION,
        workouts: [],
        drafts: {},
        lastBackupAt: null,
        lastBackupWorkoutCount: 0,
        backupHistory: []
    };
}

function loadAppData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return blankAppData();
        const data = JSON.parse(raw);
        return normalizeAppData(data);
    } catch {
        return blankAppData();
    }
}

function normalizeAppData(data) {
    const blank = blankAppData();
    const workouts = Array.isArray(data?.workouts) ? data.workouts : [];
    const lastBackupAt = data?.lastBackupAt || null;
    const hasStoredBackupCount = data?.lastBackupWorkoutCount !== undefined && data?.lastBackupWorkoutCount !== null && Number.isFinite(Number(data.lastBackupWorkoutCount));
    return {
        ...blank,
        version: APP_VERSION,
        workouts,
        drafts: data?.drafts && typeof data.drafts === "object" ? data.drafts : {},
        lastBackupAt,
        lastBackupWorkoutCount: hasStoredBackupCount ? Number(data.lastBackupWorkoutCount) : (lastBackupAt ? workouts.length : 0),
        backupHistory: Array.isArray(data?.backupHistory) ? data.backupHistory.slice(0, 12) : []
    };
}

function saveAppData() {
    appData.version = APP_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    updateBackupReminder();
}

function todayValue() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function dateFromValue(value) {
    if (!value) return null;
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDate(value, short = false) {
    const d = dateFromValue(value);
    if (!d) return "No Date";
    return d.toLocaleDateString("en-US", short
        ? { month: "short", day: "numeric" }
        : { month: "long", day: "numeric", year: "numeric" });
}

function formatDateTime(value) {
    if (!value) return "Never";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function workoutTimestamp(workout) {
    // Workout DATE controls training chronology. Editing an old workout should not
    // suddenly make it the newest session just because it was updated today.
    const d = dateFromValue(workout?.date);
    if (d) {
        const saved = new Date(workout?.savedAt || "");
        const timeOfDay = Number.isFinite(saved.getTime())
            ? saved.getHours() * 3600000 + saved.getMinutes() * 60000 + saved.getSeconds() * 1000 + saved.getMilliseconds()
            : 0;
        return d.getTime() + timeOfDay;
    }
    const saved = new Date(workout?.savedAt || "").getTime();
    return Number.isFinite(saved) ? saved : 0;
}

function sortWorkoutsNewest(list) {
    return [...list].sort((a, b) => workoutTimestamp(b) - workoutTimestamp(a));
}

function daysSince(iso) {
    if (!iso) return Infinity;
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return Infinity;
    return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function emptySet() {
    return { entry: "", note: "" };
}

function emptyExercise(name = "") {
    return { name, note: "", excludeFromPR: false, sets: [emptySet()] };
}

function freshDraft(type) {
    return {
        workoutType: type,
        date: todayValue(),
        bodyWeight: "",
        location: "",
        sessionNote: "",
        overallWorkoutNote: "",
        excludeFromPR: false,
        cardio: {
            type: "Treadmill",
            calories: "",
            distance: "",
            time: "",
            pace: "",
            speed: "",
            feetClimbed: "",
            steps: "",
            spm: "",
            note: ""
        },
        exercises: (workoutPresets[type] || []).map(name => emptyExercise(name)),
        existingWorkoutId: null,
        savedAt: null
    };
}

function normalizedDraft(type) {
    const stored = appData.drafts[type];
    if (!stored) return freshDraft(type);

    if (stored.existingWorkoutId && stored.date && stored.date !== todayValue()) {
        const stillExists = appData.workouts.some(w => w.id === stored.existingWorkoutId);
        if (stillExists) return freshDraft(type);
    }

    const blank = freshDraft(type);
    return {
        ...blank,
        ...stored,
        workoutType: type,
        cardio: { ...blank.cardio, ...(stored.cardio || {}) },
        exercises: Array.isArray(stored.exercises) && stored.exercises.length
            ? stored.exercises.map(ex => ({
                name: ex?.name || "",
                note: ex?.note || "",
                excludeFromPR: Boolean(ex?.excludeFromPR),
                sets: Array.isArray(ex?.sets) && ex.sets.length
                    ? ex.sets.map(s => ({ entry: s?.entry || "", note: s?.note || "" }))
                    : [emptySet()]
            }))
            : blank.exercises
    };
}

function draftHasMeaningfulData(draft) {
    if (!draft) return false;
    const cardio = draft.cardio || {};
    return Boolean(
        draft.bodyWeight || draft.location || draft.sessionNote || draft.overallWorkoutNote ||
        Object.entries(cardio).some(([key, value]) => key !== "type" && String(value || "").trim()) ||
        (draft.exercises || []).some(ex =>
            ex.note?.trim() || (ex.sets || []).some(set => set.entry?.trim() || set.note?.trim())
        )
    );
}

function showScreen(name) {
    [logScreen, historyScreen, progressScreen, backupScreen].forEach(screen => screen.classList.remove("active-screen"));
    navButtons.forEach(button => button.classList.remove("active-nav"));

    const map = { log: logScreen, history: historyScreen, progress: progressScreen, backup: backupScreen };
    (map[name] || logScreen).classList.add("active-screen");
    document.querySelector(`[data-screen="${name}"]`)?.classList.add("active-nav");

    if (name === "history") renderHistory();
    if (name === "progress") renderProgress();
    if (name === "backup") updateBackupStatus();

    if (name === "log" && currentWorkoutType) saveDock.classList.remove("hidden");
    else saveDock.classList.add("hidden");

    window.scrollTo(0, 0);
}

navButtons.forEach(button => {
    button.addEventListener("click", () => {
        saveCurrentDraft();
        showScreen(button.dataset.screen);
    });
});

workoutChoices.forEach(button => {
    button.addEventListener("click", () => selectWorkoutType(button.dataset.workout));
});

function selectWorkoutType(type, draftOverride = null) {
    saveCurrentDraft();
    currentWorkoutType = type;
    workoutChoices.forEach(choice => choice.classList.toggle("selected-workout", choice.dataset.workout === type));
    currentDraft = draftOverride || normalizedDraft(type);
    appData.drafts[type] = currentDraft;
    saveAppData();
    renderDraft();
}

function renderDraft() {
    if (!currentDraft) return;
    sessionArea.classList.remove("hidden");
    saveDock.classList.remove("hidden");
    currentWorkoutTitle.textContent = currentWorkoutType;
    workoutDate.value = currentDraft.date || todayValue();
    bodyWeight.value = currentDraft.bodyWeight || "";
    sessionLocation.value = currentDraft.location || "";
    sessionNote.value = currentDraft.sessionNote || "";
    overallWorkoutNote.value = currentDraft.overallWorkoutNote || "";
    countWorkoutForPr.checked = !currentDraft.excludeFromPR;

    cardioSection.classList.toggle("hidden", currentWorkoutType !== "Cardio + Abs");
    cardioType.value = currentDraft.cardio?.type || "Treadmill";
    calories.value = currentDraft.cardio?.calories || "";
    distance.value = currentDraft.cardio?.distance || "";
    cardioTime.value = currentDraft.cardio?.time || "";
    pace.value = currentDraft.cardio?.pace || "";
    speed.value = currentDraft.cardio?.speed || "";
    feetClimbed.value = currentDraft.cardio?.feetClimbed || "";
    steps.value = currentDraft.cardio?.steps || "";
    spm.value = currentDraft.cardio?.spm || "";
    cardioNote.value = currentDraft.cardio?.note || "";

    exerciseList.innerHTML = "";
    (currentDraft.exercises || []).forEach(exercise => exerciseList.appendChild(createExerciseCard(exercise)));
    saveWorkoutButton.textContent = currentDraft.existingWorkoutId ? "Update Workout" : "Save Workout";
    renderBestSoFar();
    updateRepeatLastButton();
}

function createExerciseCard(exercise) {
    const card = document.createElement("section");
    card.className = "exercise-card";
    const inner = document.createElement("div");
    inner.className = "exercise-inner";

    const heading = document.createElement("div");
    heading.className = "exercise-heading";
    const title = document.createElement("h3");
    title.textContent = exercise.name || "Exercise";
    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.textContent = "Remove";
    heading.append(title, remove);

    const name = document.createElement("input");
    name.type = "text";
    name.className = "exercise-name";
    name.placeholder = "Exercise name";
    name.value = exercise.name || "";
    name.addEventListener("input", () => {
        title.textContent = name.value || "Exercise";
        queueAutosave();
    });

    const note = document.createElement("textarea");
    note.className = "exercise-note";
    note.placeholder = "Exercise note — form, machine difference, reminder for next time...";
    note.value = exercise.note || "";
    note.addEventListener("input", queueAutosave);

    const prToggleRow = document.createElement("label");
    prToggleRow.className = "pr-toggle-row";
    const prToggle = document.createElement("input");
    prToggle.type = "checkbox";
    prToggle.className = "pr-toggle";
    prToggle.checked = !exercise.excludeFromPR;
    const prToggleText = document.createElement("span");
    prToggleText.textContent = "Count this exercise toward PRs";
    prToggleRow.append(prToggle, prToggleText);
    prToggle.addEventListener("change", queueAutosave);

    const insights = createExerciseInsights(exercise.name);
    const sets = document.createElement("div");
    sets.className = "sets-container";
    (exercise.sets?.length ? exercise.sets : [emptySet()]).forEach((set, index) => sets.appendChild(createSetCard(set, index + 1)));

    const addSet = document.createElement("button");
    addSet.className = "add-set-button";
    addSet.type = "button";
    addSet.textContent = "＋ Add Set";
    addSet.addEventListener("click", () => {
        sets.appendChild(createSetCard(emptySet(), sets.children.length + 1));
        queueAutosave();
    });

    remove.addEventListener("click", () => {
        card.remove();
        queueAutosave();
    });

    inner.append(heading, name, note, prToggleRow, insights, sets, addSet);
    card.appendChild(inner);
    return card;
}

function createSetCard(set, number) {
    const card = document.createElement("div");
    card.className = "set-card";

    const heading = document.createElement("div");
    heading.className = "set-heading";
    const label = document.createElement("span");
    label.className = "set-number";
    label.textContent = `Set ${number}`;
    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.textContent = "×";
    heading.append(label, remove);

    const entry = document.createElement("input");
    entry.type = "text";
    entry.className = "set-entry";
    entry.placeholder = "Example: 90 x 6 or 5 + partials";
    entry.value = set?.entry || "";

    const note = document.createElement("textarea");
    note.className = "set-note";
    note.placeholder = "Optional set note";
    note.value = set?.note || "";

    const tags = document.createElement("div");
    tags.className = "quick-tags";
    [
        ["SS", "(SS)"],
        ["SA", "(SA)"],
        ["+ partials", "+ partials"],
        ["failed", "(failed)"]
    ].forEach(([labelText, appendText]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-tag";
        button.textContent = labelText;
        button.addEventListener("click", () => appendTag(entry, appendText));
        tags.appendChild(button);
    });

    entry.addEventListener("input", queueAutosave);
    note.addEventListener("input", queueAutosave);
    remove.addEventListener("click", () => {
        const container = card.parentElement;
        card.remove();
        renumberSets(container);
        queueAutosave();
    });

    card.append(heading, entry, note, tags);
    return card;
}

function appendTag(input, tag) {
    const current = input.value.trim();
    if (current.toLowerCase().includes(tag.toLowerCase())) return;
    input.value = current ? `${current} ${tag}` : tag;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
}

function renumberSets(container) {
    if (!container) return;
    [...container.querySelectorAll(".set-card")].forEach((card, index) => {
        const label = card.querySelector(".set-number");
        if (label) label.textContent = `Set ${index + 1}`;
    });
}

function canonicalExerciseName(name, workoutType = "") {
    const raw = String(name || "").trim();
    if (!raw) return "";
    if (workoutType === "Pull Day" && raw.toUpperCase() === "LP") return "LPD";
    const preset = (workoutPresets[workoutType] || []).find(item => item.toLowerCase() === raw.toLowerCase());
    return preset || raw;
}

function workoutCountsForPR(workout) {
    if (!workout) return false;
    if (workout.excludeFromPR) return false;
    return true;
}

function getExerciseSessions(name, workoutType = currentWorkoutType, excludeWorkoutId = null) {
    const canonical = canonicalExerciseName(name, workoutType).toLowerCase();
    if (!canonical) return [];
    const sessions = [];
    for (const workout of appData.workouts) {
        if (workout.workoutType !== workoutType || workout.id === excludeWorkoutId || !workoutCountsForPR(workout)) continue;
        for (const exercise of workout.exercises || []) {
            if (exercise.excludeFromPR) continue;
            if (canonicalExerciseName(exercise.name, workoutType).toLowerCase() === canonical) {
                sessions.push({ workout, exercise, performance: bestPerformanceForExercise(exercise) });
            }
        }
    }
    return sessions.sort((a, b) => workoutTimestamp(b.workout) - workoutTimestamp(a.workout));
}

function createExerciseInsights(name) {
    const details = document.createElement("details");
    details.className = "exercise-insights";
    const summary = document.createElement("summary");
    const sessions = getExerciseSessions(name, currentWorkoutType, currentDraft?.existingWorkoutId || null);
    const usable = sessions.filter(s => s.performance);
    const best = bestForExerciseName(name, currentWorkoutType, currentDraft?.existingWorkoutId || null);
    const trend = trendFromSessions(usable);
    summary.textContent = sessions.length ? `History & Progress · ${sessions.length} logged` : "History & Progress · No previous data";
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "exercise-insights-body";
    if (!sessions.length) {
        const p = document.createElement("div");
        p.className = "best-empty";
        p.textContent = "No previous saved workout for this exercise yet.";
        body.appendChild(p);
    } else {
        const top = document.createElement("div");
        top.className = "insight-topline";
        const bestText = document.createElement("span");
        bestText.className = "insight-best";
        bestText.textContent = best ? `🏆 Best: ${best.display}` : "No parsable PR yet";
        top.append(bestText, createTrendChip(trend));
        body.appendChild(top);

        const latest = sessions[0];
        const useLast = document.createElement("button");
        useLast.type = "button";
        useLast.className = "use-last-button";
        useLast.textContent = "Use Last Sets";
        useLast.addEventListener("click", () => {
            const card = details.closest(".exercise-card");
            const setsContainer = card?.querySelector(".sets-container");
            if (!setsContainer) return;
            setsContainer.innerHTML = "";
            (latest.exercise.sets || []).forEach((set, index) => setsContainer.appendChild(createSetCard({ ...set }, index + 1)));
            queueAutosave();
        });
        body.appendChild(useLast);

        sessions.slice(0, 5).forEach(session => {
            const row = document.createElement("div");
            row.className = "insight-session";
            const strong = document.createElement("strong");
            strong.textContent = formatDate(session.workout.date, true);
            const pre = document.createElement("pre");
            pre.textContent = (session.exercise.sets || []).map((set, i) => `Set ${i + 1}: ${set.entry || "—"}${set.note ? ` — ${set.note}` : ""}`).join("\n") || "No sets recorded";
            row.append(strong, pre);
            body.appendChild(row);
        });
    }
    details.appendChild(body);
    return details;
}

function parseWeightedCandidates(entry) {
    const text = String(entry || "");
    if (/assisted|negative-only|negatives only/i.test(text)) return [];
    const results = [];
    const re = /(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)/gi;
    let match;
    while ((match = re.exec(text)) !== null) {
        const weight = Number(match[1]);
        const reps = Number(match[2]);
        if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0 || reps > 100) continue;
        const workingSetBonus = reps >= 5 ? 1000000000 : 0;
        const score = workingSetBonus + weight * 1000 + reps;
        const trendScore = reps <= 30 ? weight * (1 + reps / 30) : weight * 2 + (reps - 30) * .01;
        results.push({ metric: "strength", score, trendScore, weight, reps, display: text.trim() || match[0] });
    }
    return results;
}

function parseDurationSeconds(entry) {
    const text = String(entry || "").trim();
    if (!text) return null;
    const colon = text.match(/\b(\d{1,2}):(\d{2})\b/);
    if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
    const min = text.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes)\b/i);
    if (min) return Number(min[1]) * 60;
    const sec = text.match(/(\d+(?:\.\d+)?)\s*(?:sec|secs|second|seconds|s)\b/i);
    if (sec) return Number(sec[1]);
    return null;
}

function parseRepPerformance(entry) {
    const text = String(entry || "").trim();
    if (!text || /negative-only|negatives only|assisted/i.test(text)) return null;
    const explicit = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:reps?|repetitions?)\b/gi)].map(m => Number(m[1])).filter(Number.isFinite);
    let values = explicit;
    if (!values.length && !/[x×:]/i.test(text)) {
        values = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => Number.isFinite(n) && n >= 0 && n <= 500);
    }
    if (!values.length) return null;
    const reps = Math.max(...values);
    return { metric: "reps", score: reps, reps, display: text };
}

function bestPerformanceForExercise(exercise) {
    const sets = exercise?.sets || [];
    const weighted = [];
    sets.forEach(set => weighted.push(...parseWeightedCandidates(set.entry)));
    if (weighted.length) return weighted.sort((a, b) => b.score - a.score)[0];

    const timed = timedExerciseNames.has(String(exercise?.name || "").trim().toLowerCase());
    if (timed) {
        const durations = sets.map(set => {
            const seconds = parseDurationSeconds(set.entry);
            return seconds == null ? null : { metric: "time", score: seconds, seconds, display: String(set.entry || "").trim() };
        }).filter(Boolean);
        if (durations.length) return durations.sort((a, b) => b.score - a.score)[0];
    }

    const reps = sets.map(set => parseRepPerformance(set.entry)).filter(Boolean);
    return reps.length ? reps.sort((a, b) => b.score - a.score)[0] : null;
}

function chooseBestPerformance(items) {
    const usable = items.filter(Boolean);
    if (!usable.length) return null;
    const preferredMetric = usable.some(item => item.metric === "strength") ? "strength"
        : usable.some(item => item.metric === "time") ? "time"
        : usable[0].metric;
    return usable.filter(item => item.metric === preferredMetric).sort((a, b) => b.score - a.score)[0] || null;
}

function trendFromSessions(sessions) {
    const perf = sessions.filter(s => s.performance).slice(0, 2);
    if (perf.length < 2 || perf[0].performance.metric !== perf[1].performance.metric) return { state: "neutral", label: "Need more data" };
    const latest = perf[0].performance.trendScore ?? perf[0].performance.score;
    const previous = perf[1].performance.trendScore ?? perf[1].performance.score;
    if (!previous) return { state: "neutral", label: "Steady" };
    const change = (latest - previous) / Math.abs(previous);
    if (change > .02) return { state: "up", label: "↑ Up vs last" };
    if (change < -.02) return { state: "down", label: "↓ Down vs last" };
    return { state: "neutral", label: "→ About steady" };
}

function createTrendChip(trend) {
    const span = document.createElement("span");
    span.className = `trend-chip ${trend?.state || "neutral"}`;
    span.textContent = trend?.label || "No trend";
    return span;
}

function isImportedLegacyWorkout(workout) {
    return String(workout?.id || "").startsWith("imported_old_workout_");
}

function hasLegacyImportedHistory() {
    return appData.workouts.some(isImportedLegacyWorkout);
}

function legacySeedFor(name, type) {
    if (!hasLegacyImportedHistory()) return null;
    const seeds = legacyBestSeeds[type] || {};
    const key = Object.keys(seeds).find(k => k.toLowerCase() === canonicalExerciseName(name, type).toLowerCase());
    if (!key) return null;
    const display = seeds[key];
    const performance = bestPerformanceForExercise({ name: key, sets: [{ entry: display, note: "" }] });
    if (!performance) return null;

    let matchedWorkout = null;
    const imported = sortWorkoutsNewest(appData.workouts.filter(w => w.workoutType === type && isImportedLegacyWorkout(w)));
    for (const workout of imported) {
        const exercise = (workout.exercises || []).find(ex => canonicalExerciseName(ex.name, type).toLowerCase() === key.toLowerCase());
        if (!exercise) continue;
        const candidates = (exercise.sets || []).flatMap(set => parseWeightedCandidates(set.entry));
        if (performance.metric === "strength" && candidates.some(c => c.weight === performance.weight && c.reps === performance.reps)) {
            matchedWorkout = workout;
            break;
        }
        if (performance.metric === "reps") {
            const rep = bestPerformanceForExercise(exercise);
            if (rep?.metric === "reps" && rep.score >= performance.score) {
                matchedWorkout = workout;
                break;
            }
        }
    }
    return { ...performance, display, workout: matchedWorkout, legacySeed: true };
}

function bestForExerciseName(name, type, excludeWorkoutId = null) {
    // Legacy Best-So-Far values are only a fallback baseline. They must NEVER
    // hide a better performance that is actually present in imported/saved history.
    const seed = legacySeedFor(name, type);
    const sessions = getExerciseSessions(name, type, excludeWorkoutId).filter(s => s.performance);
    const candidates = sessions.map(s => ({ ...s.performance, workout: s.workout, source: "history" }));
    if (seed) candidates.push({ ...seed, source: "legacy" });
    return chooseBestPerformance(candidates);
}

function getBestExerciseRows(type) {
    const names = [];
    (workoutPresets[type] || []).forEach(name => names.push(name));
    appData.workouts.filter(w => w.workoutType === type).forEach(workout => {
        (workout.exercises || []).forEach(ex => {
            const canonical = canonicalExerciseName(ex.name, type);
            if (canonical && !names.some(n => n.toLowerCase() === canonical.toLowerCase())) names.push(canonical);
        });
    });

    return names.map(name => {
        const sessions = getExerciseSessions(name, type, null).filter(s => s.performance);
        const best = bestForExerciseName(name, type, null);
        return { name, best, sessions };
    });
}

function paceToSeconds(value) {
    const text = String(value || "").trim();
    const match = text.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const sec = Number(match[1]) * 60 + Number(match[2]);
    return Number.isFinite(sec) && sec > 0 ? sec : null;
}

function getCardioBestRows(excludeWorkoutId = null) {
    const rows = [];
    const workouts = appData.workouts.filter(w => w.workoutType === "Cardio + Abs" && w.id !== excludeWorkoutId && workoutCountsForPR(w));

    const paceCandidates = workouts.map(w => ({ workout: w, seconds: paceToSeconds(w.cardio?.pace), pace: w.cardio?.pace, type: w.cardio?.type })).filter(x => x.seconds != null);
    if (paceCandidates.length) {
        const best = paceCandidates.sort((a, b) => a.seconds - b.seconds)[0];
        rows.push({ name: "Fastest Pace", display: `${best.pace} /mi`, date: best.workout.date, workoutId: best.workout.id, score: best.seconds, metric: "pace" });
    }

    const spmCandidates = workouts.map(w => ({ workout: w, value: Number(w.cardio?.spm), type: w.cardio?.type })).filter(x => Number.isFinite(x.value) && x.value > 0);
    if (spmCandidates.length) {
        const best = spmCandidates.sort((a, b) => b.value - a.value)[0];
        rows.push({ name: "StairMaster", display: `${best.value} SPM`, date: best.workout.date, workoutId: best.workout.id, score: best.value, metric: "spm" });
    }

    const distanceCandidates = workouts.map(w => ({ workout: w, value: Number(w.cardio?.distance) })).filter(x => Number.isFinite(x.value) && x.value > 0);
    if (distanceCandidates.length) {
        const best = distanceCandidates.sort((a, b) => b.value - a.value)[0];
        rows.push({ name: "Longest Distance", display: `${best.value} mi`, date: best.workout.date, workoutId: best.workout.id, score: best.value, metric: "distance" });
    }

    return rows;
}

function renderBestSoFar() {
    bestSoFarList.innerHTML = "";
    if (!currentWorkoutType) return;

    const rows = [];
    if (currentWorkoutType === "Cardio + Abs") {
        getCardioBestRows(null).forEach(row => rows.push({ name: row.name, display: row.display, date: row.date }));
    }
    getBestExerciseRows(currentWorkoutType).forEach(row => {
        if (row.best) rows.push({ name: row.name, display: row.best.display, date: row.best.workout?.date || "" });
    });

    if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "best-empty";
        empty.textContent = "Save workouts and your PRs will appear here automatically.";
        bestSoFarList.appendChild(empty);
        return;
    }

    rows.forEach(row => {
        const item = document.createElement("div");
        item.className = "best-row";
        const name = document.createElement("div");
        name.className = "best-name";
        name.textContent = row.name;
        const value = document.createElement("div");
        value.className = "best-value";
        value.textContent = row.display;
        const date = document.createElement("div");
        date.className = "best-date";
        date.textContent = row.date ? formatDate(row.date, true) : "";
        item.append(name, value, date);
        bestSoFarList.appendChild(item);
    });
}

function collectDraft() {
    if (!currentWorkoutType || !currentDraft) return null;
    const exercises = [...exerciseList.querySelectorAll(".exercise-card")].map(card => ({
        name: card.querySelector(".exercise-name")?.value.trim() || "",
        note: card.querySelector(".exercise-note")?.value.trim() || "",
        excludeFromPR: !(card.querySelector(".pr-toggle")?.checked ?? true),
        sets: [...card.querySelectorAll(".set-card")].map(setCard => ({
            entry: setCard.querySelector(".set-entry")?.value.trim() || "",
            note: setCard.querySelector(".set-note")?.value.trim() || ""
        }))
    }));

    return {
        ...currentDraft,
        workoutType: currentWorkoutType,
        date: workoutDate.value || todayValue(),
        bodyWeight: bodyWeight.value.trim(),
        location: sessionLocation.value.trim(),
        sessionNote: sessionNote.value.trim(),
        overallWorkoutNote: overallWorkoutNote.value.trim(),
        excludeFromPR: !countWorkoutForPr.checked,
        cardio: {
            type: cardioType.value || "Treadmill",
            calories: calories.value.trim(),
            distance: distance.value.trim(),
            time: cardioTime.value.trim(),
            pace: pace.value.trim(),
            speed: speed.value.trim(),
            feetClimbed: feetClimbed.value.trim(),
            steps: steps.value.trim(),
            spm: spm.value.trim(),
            note: cardioNote.value.trim()
        },
        exercises
    };
}

function saveCurrentDraft() {
    if (!currentWorkoutType || !currentDraft) return;
    const collected = collectDraft();
    if (!collected) return;
    currentDraft = collected;
    appData.drafts[currentWorkoutType] = currentDraft;
    saveAppData();
}

function queueAutosave() {
    topSaveStatus.textContent = navigator.onLine ? "Saving…" : "Offline · saving";
    topSaveStatus.classList.toggle("offline", !navigator.onLine);
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        saveCurrentDraft();
        topSaveStatus.textContent = navigator.onLine ? "Saved" : "Offline · saved";
    }, 280);
}

[workoutDate, bodyWeight, sessionLocation, sessionNote, overallWorkoutNote, countWorkoutForPr, cardioType, calories, distance, cardioTime, pace, speed, feetClimbed, steps, spm, cardioNote].forEach(element => {
    element.addEventListener("input", queueAutosave);
    element.addEventListener("change", queueAutosave);
});

addExerciseButton.addEventListener("click", () => {
    exerciseList.appendChild(createExerciseCard(emptyExercise("")));
    queueAutosave();
});

function latestWorkoutOfType(type, excludeId = null) {
    return sortWorkoutsNewest(appData.workouts.filter(w => w.workoutType === type && w.id !== excludeId))[0] || null;
}

function updateRepeatLastButton() {
    repeatLastButton.disabled = !latestWorkoutOfType(currentWorkoutType, currentDraft?.existingWorkoutId || null);
    repeatLastButton.style.opacity = repeatLastButton.disabled ? ".45" : "1";
}

repeatLastButton.addEventListener("click", () => {
    const latest = latestWorkoutOfType(currentWorkoutType, currentDraft?.existingWorkoutId || null);
    if (!latest) {
        showToast("No previous workout to repeat yet.");
        return;
    }
    saveCurrentDraft();
    if (draftHasMeaningfulData(currentDraft) && !confirm("Replace the current draft with a fresh session based on your last workout?")) return;
    const draft = freshDraft(currentWorkoutType);
    draft.location = latest.location || "";
    draft.cardio.type = latest.cardio?.type || draft.cardio.type;
    draft.exercises = (latest.exercises || []).map(ex => ({
        name: ex.name || "",
        note: "",
        excludeFromPR: false,
        sets: Array.from({ length: Math.max(1, ex.sets?.length || 1) }, () => emptySet())
    }));
    currentDraft = draft;
    appData.drafts[currentWorkoutType] = currentDraft;
    saveAppData();
    renderDraft();
    showToast("Fresh session created from your last workout structure.");
});

newSessionButton.addEventListener("click", () => {
    saveCurrentDraft();
    if (draftHasMeaningfulData(currentDraft) && !currentDraft.existingWorkoutId) {
        if (!confirm("Start a new session? Your current draft will be cleared.")) return;
    }
    currentDraft = freshDraft(currentWorkoutType);
    appData.drafts[currentWorkoutType] = currentDraft;
    saveAppData();
    renderDraft();
    showToast("New session ready.");
});

function getHistoricalBestMap(type, excludeWorkoutId = null) {
    const map = new Map();
    const names = new Set();
    appData.workouts.filter(w => w.workoutType === type && w.id !== excludeWorkoutId).forEach(w => (w.exercises || []).forEach(ex => names.add(canonicalExerciseName(ex.name, type))));
    names.forEach(name => {
        const best = bestForExerciseName(name, type, excludeWorkoutId);
        if (best) map.set(name.toLowerCase(), best);
    });
    if (hasLegacyImportedHistory()) {
        Object.keys(legacyBestSeeds[type] || {}).forEach(name => {
            const best = bestForExerciseName(name, type, excludeWorkoutId);
            if (best) map.set(name.toLowerCase(), best);
        });
    }
    return map;
}

function detectNewPRs(workout, excludeWorkoutId = null) {
    const prs = [];
    if (!workoutCountsForPR(workout)) return prs;
    const historical = getHistoricalBestMap(workout.workoutType, excludeWorkoutId);
    (workout.exercises || []).forEach(ex => {
        if (ex.excludeFromPR) return;
        const performance = bestPerformanceForExercise(ex);
        if (!performance) return;
        const name = canonicalExerciseName(ex.name, workout.workoutType);
        const prior = historical.get(name.toLowerCase());
        if (prior && prior.metric === performance.metric && performance.score > prior.score) {
            prs.push(`${name}: ${performance.display}`);
        }
    });

    if (workout.workoutType === "Cardio + Abs") {
        const historicalCardio = getCardioBestRows(excludeWorkoutId);
        const priorPace = historicalCardio.find(row => row.metric === "pace");
        const newPace = paceToSeconds(workout.cardio?.pace);
        if (priorPace && newPace != null && newPace < priorPace.score) prs.push(`Fastest pace: ${workout.cardio.pace} /mi`);
        const priorSpm = historicalCardio.find(row => row.metric === "spm");
        const newSpm = Number(workout.cardio?.spm);
        if (priorSpm && Number.isFinite(newSpm) && newSpm > priorSpm.score) prs.push(`StairMaster: ${newSpm} SPM`);
    }
    return prs;
}

saveWorkoutButton.addEventListener("click", saveWorkout);

function saveWorkout() {
    saveCurrentDraft();
    const draft = currentDraft;
    if (!draft) return;

    const hasAnySet = (draft.exercises || []).some(ex => (ex.sets || []).some(set => set.entry?.trim()));
    const hasCardio = draft.workoutType === "Cardio + Abs" && Object.entries(draft.cardio || {}).some(([key, value]) => key !== "type" && String(value || "").trim());
    if (!hasAnySet && !hasCardio) {
        if (!confirm("There are no set results or cardio numbers yet. Save this workout anyway?")) return;
    }

    const existingId = draft.existingWorkoutId || null;
    const prs = detectNewPRs(draft, existingId);
    const now = new Date().toISOString();
    const id = existingId || `workout_${Date.now()}`;
    const index = appData.workouts.findIndex(w => w.id === id);
    const previousWorkout = index >= 0 ? appData.workouts[index] : null;
    const workout = {
        ...draft,
        id,
        existingWorkoutId: undefined,
        savedAt: previousWorkout?.savedAt || now,
        updatedAt: existingId ? now : (previousWorkout?.updatedAt || null)
    };
    delete workout.existingWorkoutId;

    if (index >= 0) appData.workouts[index] = workout;
    else appData.workouts.push(workout);

    if (existingId) {
        // Editing is complete. Immediately leave edit mode and prepare a clean
        // session of the same workout type so the old workout never stays loaded.
        currentDraft = freshDraft(currentWorkoutType);
        appData.drafts[currentWorkoutType] = currentDraft;
    } else {
        // A newly saved workout stays available for a quick correction if needed.
        currentDraft = { ...draft, existingWorkoutId: id, savedAt: now };
        appData.drafts[currentWorkoutType] = currentDraft;
    }

    saveAppData();
    renderDraft();
    renderProgress();

    if (existingId) {
        showToast(prs.length
            ? `Workout updated · 🏆 ${prs.length} PR${prs.length > 1 ? "s" : ""}. New session ready.`
            : "Workout updated. New session ready.",
            Boolean(prs),
            3600);
    } else if (prs.length) {
        showToast(`🏆 NEW PR${prs.length > 1 ? "S" : ""}\n${prs.slice(0, 4).join("\n")}${prs.length > 4 ? `\n+${prs.length - 4} more` : ""}`, true, 4200);
    } else {
        showToast("Workout saved.");
    }
}

function cardioToText(cardio) {
    if (!cardio) return "";
    const lines = [];
    if (cardio.type) lines.push(`Cardio: ${cardio.type}`);
    if (cardio.calories) lines.push(`Calories: ${cardio.calories}`);
    if (cardio.distance) lines.push(`Distance: ${cardio.distance} miles`);
    if (cardio.time) lines.push(`Time: ${cardio.time}`);
    if (cardio.pace) lines.push(`Pace: ${cardio.pace} min/mile`);
    if (cardio.speed) lines.push(`Speed: ${cardio.speed} mph`);
    if (cardio.feetClimbed) lines.push(`Feet climbed: ${cardio.feetClimbed} ft`);
    if (cardio.steps) lines.push(`Steps: ${cardio.steps}`);
    if (cardio.spm) lines.push(`SPM: ${cardio.spm}`);
    if (cardio.note) lines.push(`Cardio note: ${cardio.note}`);
    return lines.join("\n");
}

function workoutToText(workout) {
    const lines = [workout.workoutType || "Workout", formatDate(workout.date)];
    if (workout.bodyWeight) lines.push(`Body Weight: ${workout.bodyWeight}`);
    if (workout.location) lines.push(`Location: ${workout.location}`);
    if (workout.sessionNote) lines.push(`Before-workout note: ${workout.sessionNote}`);
    if (workout.workoutType === "Cardio + Abs") {
        const cardio = cardioToText(workout.cardio);
        if (cardio) lines.push("", cardio);
    }
    (workout.exercises || []).forEach(ex => {
        lines.push("", ex.name || "Exercise");
        if (ex.note) lines.push(`Note: ${ex.note}`);
        (ex.sets || []).forEach((set, i) => {
            if (set.entry || set.note) lines.push(`Set ${i + 1}: ${set.entry || "—"}${set.note ? ` — ${set.note}` : ""}`);
        });
    });
    if (workout.overallWorkoutNote) lines.push("", `End-of-workout thoughts: ${workout.overallWorkoutNote}`);
    return lines.join("\n");
}

historyFilters.forEach(button => {
    button.addEventListener("click", () => {
        historyFilter = button.dataset.filter;
        historyFilters.forEach(b => b.classList.toggle("active-filter", b === button));
        renderHistory();
    });
});

function workoutCurrentPRs(workout) {
    const prs = [];
    (workout.exercises || []).forEach(ex => {
        if (ex.excludeFromPR) return;
        const perf = bestPerformanceForExercise(ex);
        if (!perf) return;
        const name = canonicalExerciseName(ex.name, workout.workoutType);
        const best = bestForExerciseName(name, workout.workoutType, null);
        if (best?.workout?.id === workout.id) {
            prs.push({ name, display: best.display, kind: "exercise" });
        }
    });
    if (workout.workoutType === "Cardio + Abs") {
        getCardioBestRows().forEach(row => {
            if (row.workoutId === workout.id) prs.push({ name: row.name, display: row.display, kind: "cardio" });
        });
    }
    return prs;
}

function workoutCurrentPrCount(workout) {
    return workoutCurrentPRs(workout).length;
}

function createHistoryPRDetails(workout) {
    const prs = workoutCurrentPRs(workout);
    if (!prs.length) return null;

    const section = document.createElement("section");
    section.className = "history-pr-details";

    const heading = document.createElement("div");
    heading.className = "history-pr-details-title";
    heading.textContent = "🏆 Current bests from this workout";
    section.appendChild(heading);

    prs.forEach(pr => {
        const row = document.createElement("div");
        row.className = "history-pr-detail-row";
        const name = document.createElement("strong");
        name.textContent = pr.name;
        const value = document.createElement("span");
        value.textContent = pr.display;
        row.append(name, value);
        section.appendChild(row);
    });

    return section;
}

function renderHistory() {
    historyList.innerHTML = "";
    const workouts = sortWorkoutsNewest(appData.workouts).filter(w => historyFilter === "All" || w.workoutType === historyFilter);
    if (!workouts.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "No workouts saved here yet.";
        historyList.appendChild(empty);
        return;
    }

    workouts.forEach(workout => {
        const details = document.createElement("details");
        details.className = "history-entry";
        const summary = document.createElement("summary");
        const row = document.createElement("div");
        row.className = "history-summary-row";
        const left = document.createElement("div");
        const title = document.createElement("div");
        title.textContent = `${workout.workoutType} · ${formatDate(workout.date, true)}`;
        const subtitle = document.createElement("div");
        subtitle.className = "history-subtitle";
        subtitle.textContent = [workout.location, workout.bodyWeight ? `${workout.bodyWeight} lb` : ""].filter(Boolean).join(" · ") || `${(workout.exercises || []).length} exercises`;
        left.append(title, subtitle);
        row.appendChild(left);
        const prCount = workoutCurrentPrCount(workout);
        if (prCount) {
            const badge = document.createElement("span");
            badge.className = "history-pr-badge";
            badge.textContent = `🏆 ${prCount} current PR${prCount > 1 ? "s" : ""}`;
            row.appendChild(badge);
        }
        summary.appendChild(row);

        const prDetails = createHistoryPRDetails(workout);
        const pre = document.createElement("pre");
        pre.textContent = workoutToText(workout);
        const actions = document.createElement("div");
        actions.className = "history-actions";

        const copy = document.createElement("button");
        copy.type = "button";
        copy.textContent = "Copy";
        copy.addEventListener("click", async event => {
            event.preventDefault();
            try {
                await navigator.clipboard.writeText(workoutToText(workout));
                showToast("Workout copied.");
            } catch {
                showToast("Could not copy automatically.");
            }
        });

        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Edit";
        edit.addEventListener("click", event => {
            event.preventDefault();
            const draft = workoutToDraft(workout);
            selectWorkoutType(workout.workoutType, draft);
            showScreen("log");
            showToast("Editing saved workout.");
        });

        const del = document.createElement("button");
        del.type = "button";
        del.className = "delete-history";
        del.textContent = "Delete";
        del.addEventListener("click", event => {
            event.preventDefault();
            if (!confirm(`Delete this ${workout.workoutType} from ${formatDate(workout.date)}?`)) return;
            appData.workouts = appData.workouts.filter(w => w.id !== workout.id);
            Object.keys(appData.drafts).forEach(type => {
                if (appData.drafts[type]?.existingWorkoutId === workout.id) appData.drafts[type] = freshDraft(type);
            });
            if (currentDraft?.existingWorkoutId === workout.id) {
                currentDraft = freshDraft(currentWorkoutType);
                appData.drafts[currentWorkoutType] = currentDraft;
                if (logScreen.classList.contains("active-screen")) renderDraft();
            }
            saveAppData();
            renderHistory();
            renderProgress();
            showToast("Workout deleted.");
        });

        actions.append(copy, edit, del);
        details.appendChild(summary);
        if (prDetails) details.appendChild(prDetails);
        details.append(pre, actions);
        historyList.appendChild(details);
    });
}

function workoutToDraft(workout) {
    const blank = freshDraft(workout.workoutType);
    return {
        ...blank,
        ...workout,
        cardio: { ...blank.cardio, ...(workout.cardio || {}) },
        exercises: (workout.exercises || []).map(ex => ({
            name: ex.name || "",
            note: ex.note || "",
            excludeFromPR: Boolean(ex.excludeFromPR),
            sets: (ex.sets || []).map(set => ({ entry: set.entry || "", note: set.note || "" }))
        })),
        existingWorkoutId: workout.id
    };
}

function getBodyWeightEntries() {
    return appData.workouts.map(w => ({ workout: w, value: Number(w.bodyWeight) }))
        .filter(x => Number.isFinite(x.value) && x.value > 0)
        .sort((a, b) => workoutTimestamp(a.workout) - workoutTimestamp(b.workout));
}

function renderProgress() {
    renderProgressSummary();
    renderWeightProgress();
    populateExerciseProgressSelect();
    renderSelectedExerciseProgress();
}

function renderProgressSummary() {
    progressSummary.innerHTML = "";
    const total = appData.workouts.length;
    const now = new Date();
    const monthCount = appData.workouts.filter(w => {
        const d = dateFromValue(w.date);
        return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const weights = getBodyWeightEntries();
    const latestWeight = weights.length ? weights[weights.length - 1].value : null;
    const backupAge = daysSince(appData.lastBackupAt);
    const cards = [
        [String(total), "Total workouts"],
        [String(monthCount), "This month"],
        [latestWeight != null ? `${latestWeight} lb` : "—", "Latest body weight"],
        [Number.isFinite(backupAge) ? (backupAge === 0 ? "Today" : `${backupAge}d`) : "None", "Backup age"]
    ];
    cards.forEach(([value, label]) => {
        const card = document.createElement("div");
        card.className = "summary-card";
        const valueEl = document.createElement("div");
        valueEl.className = "summary-value";
        valueEl.textContent = value;
        const labelEl = document.createElement("div");
        labelEl.className = "summary-label";
        labelEl.textContent = label;
        card.append(valueEl, labelEl);
        progressSummary.appendChild(card);
    });
}

function renderWeightProgress() {
    const entries = getBodyWeightEntries();
    weightStats.innerHTML = "";
    if (!entries.length) {
        weightTrendLabel.className = "trend-chip neutral";
        weightTrendLabel.textContent = "No data";
        weightChart.innerHTML = '<div class="chart-empty">Add body weight to workouts to see a trend.</div>';
        return;
    }
    const latest = entries[entries.length - 1];
    const previous = entries.length > 1 ? entries[entries.length - 2] : null;
    const change = previous ? latest.value - previous.value : null;
    const first = entries[0];
    const overall = latest.value - first.value;
    addProgressStat(weightStats, `${latest.value} lb`, "Latest");
    addProgressStat(weightStats, change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)} lb`, "Since previous");
    addProgressStat(weightStats, entries.length < 2 ? "—" : `${overall >= 0 ? "+" : ""}${overall.toFixed(1)} lb`, "Since first logged");

    weightTrendLabel.className = "trend-chip neutral";
    weightTrendLabel.textContent = change == null ? "Need more data" : change > .2 ? "↑ Up" : change < -.2 ? "↓ Down" : "→ Steady";
    renderSparkline(weightChart, entries.slice(-12).map(x => x.value));
}

function allExerciseOptions() {
    const map = new Map();
    appData.workouts.forEach(workout => {
        (workout.exercises || []).forEach(ex => {
            const name = canonicalExerciseName(ex.name, workout.workoutType);
            if (!name) return;
            const key = `${workout.workoutType}|${name.toLowerCase()}`;
            if (!map.has(key)) map.set(key, { type: workout.workoutType, name });
        });
    });
    return [...map.values()].sort((a, b) => workoutOrder.indexOf(a.type) - workoutOrder.indexOf(b.type) || a.name.localeCompare(b.name));
}

function populateExerciseProgressSelect() {
    const current = progressExerciseSelect.value;
    const options = allExerciseOptions();
    progressExerciseSelect.innerHTML = "";
    if (!options.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No exercise data yet";
        progressExerciseSelect.appendChild(option);
        return;
    }
    options.forEach(item => {
        const option = document.createElement("option");
        option.value = `${item.type}|${item.name}`;
        option.textContent = `${item.name} · ${item.type.replace(" Day", "")}`;
        progressExerciseSelect.appendChild(option);
    });
    if ([...progressExerciseSelect.options].some(o => o.value === current)) progressExerciseSelect.value = current;
}

progressExerciseSelect.addEventListener("change", renderSelectedExerciseProgress);

function renderSelectedExerciseProgress() {
    exerciseProgressStats.innerHTML = "";
    exerciseProgressHistory.innerHTML = "";
    const value = progressExerciseSelect.value;
    if (!value || !value.includes("|")) {
        exerciseProgressChart.innerHTML = '<div class="chart-empty">Save workout data to see exercise progress.</div>';
        return;
    }
    const splitAt = value.indexOf("|");
    const type = value.slice(0, splitAt);
    const name = value.slice(splitAt + 1);
    const sessionsNewest = getExerciseSessions(name, type).filter(s => s.performance);
    if (!sessionsNewest.length) {
        exerciseProgressChart.innerHTML = '<div class="chart-empty">No parsable results for this exercise yet.</div>';
        return;
    }
    const best = bestForExerciseName(name, type, null);
    const latest = sessionsNewest[0];
    const previous = sessionsNewest[1] || null;
    const trend = trendFromSessions(sessionsNewest);
    addProgressStat(exerciseProgressStats, best?.display || "—", "Best so far", best?.workout?.date ? formatDate(best.workout.date, true) : "Historical baseline");
    addProgressStat(exerciseProgressStats, latest.performance?.display || "—", "Latest", formatDate(latest.workout.date, true));
    addProgressStat(exerciseProgressStats, trend.label.replace(/[↑↓→]\s*/, ""), "Recent trend", previous ? `vs ${formatDate(previous.workout.date, true)}` : "Need another workout");

    const sessionsOldest = [...sessionsNewest].reverse().filter(s => s.performance?.metric === best?.metric).slice(-12);
    renderSparkline(exerciseProgressChart, sessionsOldest.map(s => s.performance.trendScore ?? s.performance.score));
    sessionsNewest.slice(0, 6).forEach(session => {
        const row = document.createElement("div");
        row.className = "mini-history-row";
        const date = document.createElement("span");
        date.textContent = formatDate(session.workout.date, true);
        const result = document.createElement("span");
        const isBest = best?.workout?.id === session.workout.id;
        result.textContent = `${isBest ? "🏆 " : ""}${session.performance.display}`;
        if (isBest) row.classList.add("current-best-row");
        row.append(date, result);
        exerciseProgressHistory.appendChild(row);
    });
}

function addProgressStat(container, value, label, detail = "") {
    const stat = document.createElement("div");
    stat.className = "progress-stat";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    stat.append(strong, span);
    if (detail) {
        const small = document.createElement("small");
        small.textContent = detail;
        stat.appendChild(small);
    }
    container.appendChild(stat);
}

function renderSparkline(container, values) {
    container.innerHTML = "";
    if (!values || values.length < 2 || values.some(v => !Number.isFinite(Number(v)))) {
        const empty = document.createElement("div");
        empty.className = "chart-empty";
        empty.textContent = values?.length === 1 ? "One point logged — add another to see a trend." : "Not enough data for a chart yet.";
        container.appendChild(empty);
        return;
    }
    const nums = values.map(Number);
    let min = Math.min(...nums);
    let max = Math.max(...nums);
    if (max === min) { max += 1; min -= 1; }
    const points = nums.map((value, index) => {
        const x = 12 + (index / (nums.length - 1)) * 276;
        const y = 88 - ((value - min) / (max - min)) * 70;
        return [x, y];
    });
    const line = points.map(p => p.join(",")).join(" ");
    const area = `12,98 ${line} 288,98`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 300 100");
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", area);
    polygon.setAttribute("class", "chart-area");
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", line);
    polyline.setAttribute("class", "chart-line");
    svg.append(polygon, polyline);
    points.forEach(([cx, cy]) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", "3.5");
        circle.setAttribute("class", "chart-dot");
        svg.appendChild(circle);
    });
    container.appendChild(svg);
}

function backupState() {
    const age = daysSince(appData.lastBackupAt);
    const added = Math.max(0, appData.workouts.length - (appData.lastBackupWorkoutCount || 0));
    const needed = !appData.lastBackupAt || age >= BACKUP_REMINDER_DAYS || added >= BACKUP_REMINDER_WORKOUTS;
    return { age, added, needed };
}

function updateBackupReminder() {
    if (!backupReminder) return;
    const state = backupState();
    backupReminder.classList.toggle("hidden", !state.needed);
    if (!state.needed) return;
    if (!appData.lastBackupAt) {
        backupReminderTitle.textContent = "Make your first backup";
        backupReminderText.textContent = "Export a JSON copy to iCloud Drive so your history is protected.";
    } else if (state.added >= BACKUP_REMINDER_WORKOUTS) {
        backupReminderTitle.textContent = "New workouts need a backup";
        backupReminderText.textContent = `${state.added} workout${state.added === 1 ? "" : "s"} added since your last backup.`;
    } else {
        backupReminderTitle.textContent = "Backup is getting old";
        backupReminderText.textContent = `Your last export was ${state.age} day${state.age === 1 ? "" : "s"} ago.`;
    }
}

backupReminderButton.addEventListener("click", () => showScreen("backup"));

function updateBackupStatus() {
    const state = backupState();
    backupStatusCard.classList.remove("warning", "good");
    if (!appData.lastBackupAt) {
        backupStatusText.textContent = "No full backup has been exported from this app yet.";
        backupStatusCard.classList.add("warning");
    } else {
        const ageText = state.age === 0 ? "today" : `${state.age} day${state.age === 1 ? "" : "s"} ago`;
        const addedText = state.added ? ` · ${state.added} new workout${state.added === 1 ? "" : "s"} since then` : " · no new workouts since then";
        backupStatusText.textContent = `Last backup: ${formatDateTime(appData.lastBackupAt)} (${ageText})${addedText}.`;
        backupStatusCard.classList.add(state.needed ? "warning" : "good");
    }
    renderBackupHistory();
    undoRestoreButton.classList.toggle("hidden", !localStorage.getItem(PRE_RESTORE_KEY));
}

function renderBackupHistory() {
    backupHistoryList.innerHTML = "";
    const history = (appData.backupHistory || []).slice(0, 6);
    if (!history.length) {
        const empty = document.createElement("div");
        empty.className = "best-empty";
        empty.textContent = "No exports recorded yet.";
        backupHistoryList.appendChild(empty);
        return;
    }
    history.forEach(item => {
        const row = document.createElement("div");
        row.className = "backup-history-item";
        const left = document.createElement("span");
        left.textContent = formatDateTime(item.at || item);
        const right = document.createElement("span");
        right.textContent = item.count != null ? `${item.count} workouts` : "Backup";
        row.append(left, right);
        backupHistoryList.appendChild(row);
    });
}

function makeDownload(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportFullBackup() {
    saveCurrentDraft();
    const at = new Date().toISOString();
    appData.lastBackupAt = at;
    appData.lastBackupWorkoutCount = appData.workouts.length;
    appData.backupHistory = [{ at, count: appData.workouts.length }, ...(appData.backupHistory || [])].slice(0, 12);
    saveAppData();
    const filename = `WorkoutTracker-Backup-${todayValue()}.json`;
    makeDownload(JSON.stringify(appData, null, 2), filename, "application/json");
    updateBackupStatus();
    showToast("Backup file created. Save it to iCloud Drive.");
}

exportBackupButton.addEventListener("click", exportFullBackup);

mergeBackupButton.addEventListener("click", () => {
    importMode = "merge";
    importBackupInput.value = "";
    importBackupInput.click();
});

importBackupButton.addEventListener("click", () => {
    if (appData.workouts.length && !confirm("Replace mode will overwrite the workouts currently stored on this device. A local undo snapshot will be created first. Continue to choose a backup file?")) return;
    importMode = "replace";
    importBackupInput.value = "";
    importBackupInput.click();
});

importBackupInput.addEventListener("change", async () => {
    const file = importBackupInput.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.workouts)) throw new Error("Invalid backup");
        const incoming = normalizeAppData(parsed);
        localStorage.setItem(PRE_RESTORE_KEY, JSON.stringify(appData));

        if (importMode === "replace") {
            if (!confirm(`This backup contains ${incoming.workouts.length} workout${incoming.workouts.length === 1 ? "" : "s"}. Replace the ${appData.workouts.length} currently stored workout${appData.workouts.length === 1 ? "" : "s"}?`)) return;
            appData = incoming;
            saveAppData();
            resetCurrentUiAfterImport();
            showToast("Backup restored. You can undo this from the Backup screen if needed.");
        } else {
            const before = appData.workouts.length;
            appData = mergeAppData(appData, incoming);
            saveAppData();
            resetCurrentUiAfterImport(false);
            const added = appData.workouts.length - before;
            showToast(`Backup merged safely. ${added} workout${added === 1 ? "" : "s"} added.`);
        }
        updateBackupStatus();
    } catch {
        showToast("That file could not be restored. Please choose a Workout Tracker JSON backup.");
    } finally {
        importBackupInput.value = "";
    }
});

function mergeAppData(current, incoming) {
    const map = new Map();
    [...current.workouts, ...incoming.workouts].forEach(workout => {
        const id = workout.id || `${workout.workoutType}|${workout.date}|${JSON.stringify(workout.exercises || [])}`;
        const existing = map.get(id);
        if (!existing || workoutTimestamp(workout) >= workoutTimestamp(existing)) map.set(id, workout);
    });
    const history = [...(current.backupHistory || []), ...(incoming.backupHistory || [])]
        .map(item => typeof item === "string" ? { at: item } : item)
        .filter(item => item?.at)
        .sort((a, b) => new Date(b.at) - new Date(a.at));
    const seen = new Set();
    const dedupedHistory = history.filter(item => {
        if (seen.has(item.at)) return false;
        seen.add(item.at);
        return true;
    }).slice(0, 12);
    return {
        ...current,
        version: APP_VERSION,
        workouts: [...map.values()],
        drafts: current.drafts || {},
        lastBackupAt: current.lastBackupAt || incoming.lastBackupAt || null,
        lastBackupWorkoutCount: current.lastBackupWorkoutCount || 0,
        backupHistory: dedupedHistory
    };
}

function resetCurrentUiAfterImport(resetDraft = true) {
    if (resetDraft) {
        currentWorkoutType = "";
        currentDraft = null;
        sessionArea.classList.add("hidden");
        saveDock.classList.add("hidden");
        workoutChoices.forEach(choice => choice.classList.remove("selected-workout"));
    } else if (currentWorkoutType) {
        currentDraft = normalizedDraft(currentWorkoutType);
        renderDraft();
    }
    renderHistory();
    renderProgress();
}

undoRestoreButton.addEventListener("click", () => {
    const raw = localStorage.getItem(PRE_RESTORE_KEY);
    if (!raw) return;
    if (!confirm("Undo the most recent restore or merge and return to the data that was on this device immediately before it?")) return;
    try {
        const currentSnapshot = JSON.stringify(appData);
        appData = normalizeAppData(JSON.parse(raw));
        localStorage.setItem(PRE_RESTORE_KEY, currentSnapshot);
        saveAppData();
        resetCurrentUiAfterImport();
        updateBackupStatus();
        showToast("Previous data restored. Tap Undo again to swap back if needed.");
    } catch {
        showToast("Could not undo the restore.");
    }
});

exportTextButton.addEventListener("click", () => {
    const sections = workoutOrder.map(type => {
        const workouts = sortWorkoutsNewest(appData.workouts.filter(w => w.workoutType === type));
        if (!workouts.length) return `${type}\nNo workouts saved.`;
        return `${type}\n${"=".repeat(type.length)}\n\n${workouts.map(workoutToText).join("\n\n--------------------\n\n")}`;
    });
    makeDownload(sections.join("\n\n\n"), `Workout-History-${todayValue()}.txt`, "text/plain;charset=utf-8");
    showToast("Workout history text export created.");
});

exportCsvButton.addEventListener("click", () => {
    const rows = [["date","workout_type","location","body_weight","exercise","set_number","set_result","set_note","exercise_note","cardio_type","distance","time","pace","speed","spm","steps","calories","feet_climbed"]];
    sortWorkoutsNewest(appData.workouts).reverse().forEach(workout => {
        const exercises = workout.exercises?.length ? workout.exercises : [{ name: "", sets: [{ entry: "", note: "" }] }];
        exercises.forEach(ex => {
            const sets = ex.sets?.length ? ex.sets : [{ entry: "", note: "" }];
            sets.forEach((set, index) => rows.push([
                workout.date || "", workout.workoutType || "", workout.location || "", workout.bodyWeight || "", ex.name || "", index + 1,
                set.entry || "", set.note || "", ex.note || "", workout.cardio?.type || "", workout.cardio?.distance || "", workout.cardio?.time || "",
                workout.cardio?.pace || "", workout.cardio?.speed || "", workout.cardio?.spm || "", workout.cardio?.steps || "", workout.cardio?.calories || "", workout.cardio?.feetClimbed || ""
            ]));
        });
    });
    const csv = rows.map(row => row.map(csvCell).join(",")).join("\n");
    makeDownload(csv, `Workout-History-${todayValue()}.csv`, "text/csv;charset=utf-8");
    showToast("CSV export created.");
});

function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

function showToast(message, pr = false, duration = 2500) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove("hidden", "pr-toast");
    if (pr) toast.classList.add("pr-toast");
    toastTimer = setTimeout(() => toast.classList.add("hidden"), duration);
}

function updateOnlineStatus() {
    topSaveStatus.classList.toggle("offline", !navigator.onLine);
    topSaveStatus.textContent = navigator.onLine ? "Saved" : "Offline · saved";
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

window.addEventListener("beforeunload", () => saveCurrentDraft());

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveCurrentDraft();
});


function setEditingFieldState(active) {
    document.body.classList.toggle("editing-field", active);
}

document.addEventListener("focusin", event => {
    if (event.target.matches("input, textarea, select")) setEditingFieldState(true);
});

document.addEventListener("focusout", event => {
    if (!event.target.matches("input, textarea, select")) return;
    setTimeout(() => {
        const active = document.activeElement;
        if (!active || !active.matches?.("input, textarea, select")) setEditingFieldState(false);
    }, 80);
});

async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
        registration.update().catch(() => {});
    } catch {
        // The app still works online if service-worker registration is unavailable.
    }
}

function init() {
    updateOnlineStatus();
    updateBackupReminder();
    updateBackupStatus();
    renderProgress();
    registerServiceWorker();
}

init();
