const STORAGE_KEY =
    "gursehajWorkoutTracker_v3";


const workoutPresets = {

    "Push Day": [
        "ISMP",
        "CF",
        "LR",
        "TPD",
        "SC",
        "CD"
    ],

    "Pull Day": [
        "DL",
        "PU",
        "LPD",
        "SCR",
        "RDM",
        "PC",
        "IDC"
    ],

    "Cardio + Abs": [
        "KR",
        "DS",
        "MC",
        "Regular Sit-ups",
        "Hollow Body Hold"
    ],

    "Legs Day": [
        "LP",
        "LE",
        "LC",
        "CR",
        "AD"
    ]
};


/* ========================= */
/* ELEMENTS */
/* ========================= */

const logScreen =
    document.getElementById("logScreen");

const historyScreen =
    document.getElementById("historyScreen");

const backupScreen =
    document.getElementById("backupScreen");

const navButtons =
    document.querySelectorAll(".nav-button");


const workoutChoices =
    document.querySelectorAll(".workout-choice");

const sessionArea =
    document.getElementById("sessionArea");

const currentWorkoutTitle =
    document.getElementById("currentWorkoutTitle");

const workoutDate =
    document.getElementById("workoutDate");

const bodyWeight =
    document.getElementById("bodyWeight");

const sessionLocation =
    document.getElementById("sessionLocation");

const sessionNote =
    document.getElementById("sessionNote");

const overallWorkoutNote =
    document.getElementById("overallWorkoutNote");


const cardioSection =
    document.getElementById("cardioSection");

const cardioType =
    document.getElementById("cardioType");

const calories =
    document.getElementById("calories");

const distance =
    document.getElementById("distance");

const cardioTime =
    document.getElementById("cardioTime");

const pace =
    document.getElementById("pace");

const speed =
    document.getElementById("speed");

const feetClimbed =
    document.getElementById("feetClimbed");

const steps =
    document.getElementById("steps");

const spm =
    document.getElementById("spm");

const cardioNote =
    document.getElementById("cardioNote");


const exerciseList =
    document.getElementById("exerciseList");

const addExerciseButton =
    document.getElementById("addExerciseButton");

const newSessionButton =
    document.getElementById("newSessionButton");

const saveWorkoutButton =
    document.getElementById("saveWorkoutButton");

const saveDock =
    document.getElementById("saveDock");

const topSaveStatus =
    document.getElementById("topSaveStatus");


const historyList =
    document.getElementById("historyList");

const historyFilters =
    document.querySelectorAll(".history-filter");


const exportBackupButton =
    document.getElementById("exportBackupButton");

const importBackupButton =
    document.getElementById("importBackupButton");

const importBackupInput =
    document.getElementById("importBackupInput");

const exportTextButton =
    document.getElementById("exportTextButton");

const backupStatusText =
    document.getElementById("backupStatusText");


/* ========================= */
/* DATA */
/* ========================= */

let appData =
    loadAppData();

let currentWorkoutType =
    "";

let currentDraft =
    null;

let autosaveTimer =
    null;

let historyFilter =
    "All";


function loadAppData() {

    try {

        const raw =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!raw) {

            return {
                version: 3,
                workouts: [],
                drafts: {},
                lastBackupAt: null
            };
        }


        const data =
            JSON.parse(raw);


        return {

            version: 3,

            workouts:
                Array.isArray(data.workouts)
                    ?
                    data.workouts
                    :
                    [],

            drafts:
                data.drafts
                &&
                typeof data.drafts
                === "object"
                    ?
                    data.drafts
                    :
                    {},

            lastBackupAt:
                data.lastBackupAt
                ||
                null
        };

    } catch {

        return {
            version: 3,
            workouts: [],
            drafts: {},
            lastBackupAt: null
        };
    }
}


function saveAppData() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(appData)
    );
}


/* ========================= */
/* DATE HELPERS */
/* ========================= */

function todayValue() {

    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;
}


function formatDate(value) {

    if (!value) {

        return "No Date";
    }


    const parts =
        value
            .split("-")
            .map(Number);


    const date =
        new Date(
            parts[0],
            parts[1] - 1,
            parts[2]
        );


    return date.toLocaleDateString(
        "en-US",
        {
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    );
}


/* ========================= */
/* DRAFTS */
/* ========================= */

function emptySet() {

    return {
        entry: "",
        note: ""
    };
}


function emptyExercise(name = "") {

    return {

        name,

        note: "",

        sets: [
            emptySet()
        ]
    };
}


function freshDraft(type) {

    return {

        workoutType:
            type,

        date:
            todayValue(),

        bodyWeight:
            "",

        location:
            "",

        sessionNote:
            "",

        overallWorkoutNote:
            "",

        cardio: {

            type:
                "Treadmill",

            calories:
                "",

            distance:
                "",

            time:
                "",

            pace:
                "",

            speed:
                "",

            feetClimbed:
                "",

            steps:
                "",

            spm:
                "",

            note:
                ""
        },

        exercises:
            (
                workoutPresets[type]
                || []
            ).map(
                name =>
                    emptyExercise(name)
            ),

        existingWorkoutId:
            null,

        savedAt:
            null
    };
}


function normalizedDraft(type) {

    const stored =
        appData.drafts[type];


    if (!stored) {

        return freshDraft(type);
    }


    const blank =
        freshDraft(type);


    return {

        ...blank,

        ...stored,

        workoutType:
            type,

        cardio: {

            ...blank.cardio,

            ...(stored.cardio || {})
        },

        exercises:

            Array.isArray(stored.exercises)
            &&
            stored.exercises.length

                ?

                stored.exercises

                :

                blank.exercises
    };
}


/* ========================= */
/* SCREEN NAVIGATION */
/* ========================= */

function showScreen(name) {

    logScreen.classList.remove(
        "active-screen"
    );

    historyScreen.classList.remove(
        "active-screen"
    );

    backupScreen.classList.remove(
        "active-screen"
    );


    navButtons.forEach(
        button =>
            button.classList.remove(
                "active-nav"
            )
    );


    if (name === "log") {

        logScreen.classList.add(
            "active-screen"
        );

    } else if (name === "history") {

        historyScreen.classList.add(
            "active-screen"
        );

        renderHistory();

    } else {

        backupScreen.classList.add(
            "active-screen"
        );

        updateBackupStatus();
    }


    document
        .querySelector(
            `[data-screen="${name}"]`
        )
        .classList.add(
            "active-nav"
        );


    if (
        name === "log"
        &&
        currentWorkoutType
    ) {

        saveDock.classList.remove(
            "hidden"
        );

    } else {

        saveDock.classList.add(
            "hidden"
        );
    }


    window.scrollTo(
        0,
        0
    );
}


navButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                saveCurrentDraft();

                showScreen(
                    button.dataset.screen
                );
            }
        );
    }
);


/* ========================= */
/* WORKOUT SELECTION */
/* ========================= */

workoutChoices.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                saveCurrentDraft();


                currentWorkoutType =
                    button.dataset.workout;


                workoutChoices.forEach(
                    choice =>
                        choice.classList.remove(
                            "selected-workout"
                        )
                );


                button.classList.add(
                    "selected-workout"
                );


                currentDraft =
                    normalizedDraft(
                        currentWorkoutType
                    );


                appData.drafts[
                    currentWorkoutType
                ] =
                    currentDraft;


                saveAppData();

                renderDraft();
            }
        );
    }
);


function renderDraft() {

    if (!currentDraft) {

        return;
    }


    sessionArea.classList.remove(
        "hidden"
    );

    saveDock.classList.remove(
        "hidden"
    );


    currentWorkoutTitle.textContent =
        currentWorkoutType;


    workoutDate.value =
        currentDraft.date
        ||
        todayValue();


    bodyWeight.value =
        currentDraft.bodyWeight
        ||
        "";


    sessionLocation.value =
        currentDraft.location
        ||
        "";


    sessionNote.value =
        currentDraft.sessionNote
        ||
        "";


    overallWorkoutNote.value =
        currentDraft.overallWorkoutNote
        ||
        "";


    if (
        currentWorkoutType
        ===
        "Cardio + Abs"
    ) {

        cardioSection.classList.remove(
            "hidden"
        );

    } else {

        cardioSection.classList.add(
            "hidden"
        );
    }


    cardioType.value =
        currentDraft.cardio.type
        ||
        "Treadmill";

    calories.value =
        currentDraft.cardio.calories
        ||
        "";

    distance.value =
        currentDraft.cardio.distance
        ||
        "";

    cardioTime.value =
        currentDraft.cardio.time
        ||
        "";

    pace.value =
        currentDraft.cardio.pace
        ||
        "";

    speed.value =
        currentDraft.cardio.speed
        ||
        "";

    feetClimbed.value =
        currentDraft.cardio.feetClimbed
        ||
        "";

    steps.value =
        currentDraft.cardio.steps
        ||
        "";

    spm.value =
        currentDraft.cardio.spm
        ||
        "";

    cardioNote.value =
        currentDraft.cardio.note
        ||
        "";


    exerciseList.innerHTML =
        "";


    currentDraft.exercises.forEach(
        exercise => {

            exerciseList.appendChild(
                createExerciseCard(
                    exercise
                )
            );
        }
    );


    if (
        currentDraft.existingWorkoutId
    ) {

        saveWorkoutButton.textContent =
            "Update Workout";

    } else {

        saveWorkoutButton.textContent =
            "Save Workout";
    }
}


/* ========================= */
/* EXERCISES */
/* ========================= */

function createExerciseCard(exercise) {

    const card =
        document.createElement(
            "section"
        );


    card.className =
        "exercise-card";


    const inner =
        document.createElement(
            "div"
        );


    inner.className =
        "exercise-inner";


    const heading =
        document.createElement(
            "div"
        );


    heading.className =
        "exercise-heading";


    const title =
        document.createElement(
            "h3"
        );


    title.textContent =
        exercise.name
        ||
        "Exercise";


    const remove =
        document.createElement(
            "button"
        );


    remove.className =
        "remove-button";

    remove.type =
        "button";

    remove.textContent =
        "Remove";


    heading.append(
        title,
        remove
    );


    const name =
        document.createElement(
            "input"
        );


    name.type =
        "text";

    name.className =
        "exercise-name";

    name.placeholder =
        "Exercise name";

    name.value =
        exercise.name
        ||
        "";


    name.addEventListener(
        "input",
        () => {

            title.textContent =
                name.value
                ||
                "Exercise";
        }
    );


    const note =
        document.createElement(
            "textarea"
        );


    note.className =
        "exercise-note";

    note.placeholder =
        "Exercise note — form, machine difference, reminder for next time...";

    note.value =
        exercise.note
        ||
        "";


    const last =
        createLastWorkoutBox(
            exercise.name
        );


    const sets =
        document.createElement(
            "div"
        );


    sets.className =
        "sets-container";


    (
        exercise.sets
        ||
        [
            emptySet()
        ]
    ).forEach(
        (
            set,
            index
        ) => {

            sets.appendChild(
                createSetCard(
                    set,
                    index + 1
                )
            );
        }
    );


    const addSet =
        document.createElement(
            "button"
        );


    addSet.className =
        "add-set-button";

    addSet.type =
        "button";

    addSet.textContent =
        "＋ Add Set";


    addSet.addEventListener(
        "click",
        () => {

            sets.appendChild(
                createSetCard(
                    emptySet(),
                    sets.children.length + 1
                )
            );

            scheduleAutosave();
        }
    );


    remove.addEventListener(
        "click",
        () => {

            if (
                confirm(
                    `Remove ${
                        name.value
                        ||
                        "this exercise"
                    }?`
                )
            ) {

                card.remove();

                scheduleAutosave();
            }
        }
    );


    inner.append(
        heading,
        name,
        note
    );


    if (last) {

        inner.appendChild(last);
    }


    inner.append(
        sets,
        addSet
    );


    card.appendChild(inner);


    return card;
}


function createSetCard(
    set,
    number
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "set-card";


    const heading =
        document.createElement(
            "div"
        );


    heading.className =
        "set-heading";


    const label =
        document.createElement(
            "span"
        );


    label.className =
        "set-number";

    label.textContent =
        `Set ${number}`;


    const remove =
        document.createElement(
            "button"
        );


    remove.className =
        "remove-button";

    remove.type =
        "button";

    remove.textContent =
        "✕";


    heading.append(
        label,
        remove
    );


    const entry =
        document.createElement(
            "input"
        );


    entry.className =
        "set-entry";

    entry.type =
        "text";

    entry.placeholder =
        "90 x 6";

    entry.value =
        set.entry
        ||
        "";


    const note =
        document.createElement(
            "textarea"
        );


    note.className =
        "set-note";

    note.placeholder =
        "Optional note";

    note.value =
        set.note
        ||
        "";


    remove.addEventListener(
        "click",
        () => {

            const container =
                card.parentElement;


            card.remove();

            renumberSets(container);


            if (
                container.children.length
                ===
                0
            ) {

                container.appendChild(
                    createSetCard(
                        emptySet(),
                        1
                    )
                );
            }


            scheduleAutosave();
        }
    );


    card.append(
        heading,
        entry,
        note
    );


    return card;
}


function renumberSets(container) {

    container
        .querySelectorAll(
            ".set-card"
        )
        .forEach(
            (
                card,
                index
            ) => {

                card
                    .querySelector(
                        ".set-number"
                    )
                    .textContent
                    =
                    `Set ${index + 1}`;
            }
        );
}


/* ========================= */
/* LAST WORKOUT -->
/* ========================= */

function findPreviousExercise(name) {

    if (!name) {

        return null;
    }


    const lowerName =
        name
            .trim()
            .toLowerCase();


    const workouts =
        [...appData.workouts]

            .filter(
                workout =>

                    workout.workoutType
                    ===
                    currentWorkoutType

                    &&

                    workout.id
                    !==
                    currentDraft
                        ?.existingWorkoutId
            )

            .sort(
                (
                    a,
                    b
                ) =>

                    String(
                        b.date
                        ||
                        ""
                    ).localeCompare(
                        String(
                            a.date
                            ||
                            ""
                        )
                    )
            );


    for (
        const workout
        of workouts
    ) {

        const exercise =
            (
                workout.exercises
                ||
                []
            ).find(
                item =>

                    String(
                        item.name
                        ||
                        ""
                    )
                        .trim()
                        .toLowerCase()

                    ===

                    lowerName
            );


        if (exercise) {

            return {
                workout,
                exercise
            };
        }
    }


    return null;
}


function createLastWorkoutBox(name) {

    const previous =
        findPreviousExercise(name);


    if (!previous) {

        return null;
    }


    const details =
        document.createElement(
            "details"
        );


    details.className =
        "last-workout";


    const summary =
        document.createElement(
            "summary"
        );


    summary.textContent =
        `Last time • ${
            formatDate(
                previous.workout.date
            )
        }`;


    const content =
        document.createElement(
            "div"
        );


    content.className =
        "last-workout-content";


    const text =
        document.createElement(
            "pre"
        );


    const lines =
        [];


    if (
        previous.exercise.note
    ) {

        lines.push(
            previous.exercise.note
        );
    }


    (
        previous.exercise.sets
        ||
        []
    ).forEach(
        set => {

            if (
                set.entry
            ) {

                let line =
                    set.entry;


                if (
                    set.note
                ) {

                    line +=
                        ` (${set.note})`;
                }


                lines.push(line);
            }
        }
    );


    text.textContent =
        lines.join("\n");


    const useLast =
        document.createElement(
            "button"
        );


    useLast.type =
        "button";

    useLast.className =
        "use-last-button";

    useLast.textContent =
        "Use Last Sets";


    useLast.addEventListener(
        "click",
        event => {

            event.preventDefault();


            const exerciseCard =
                details.closest(
                    ".exercise-card"
                );


            const container =
                exerciseCard.querySelector(
                    ".sets-container"
                );


            container.innerHTML =
                "";


            (
                previous.exercise.sets
                ||
                []
            ).forEach(
                (
                    set,
                    index
                ) => {

                    container.appendChild(
                        createSetCard(
                            {
                                entry:
                                    set.entry
                                    ||
                                    "",

                                note:
                                    ""
                            },

                            index + 1
                        )
                    );
                }
            );


            scheduleAutosave();
        }
    );


    content.append(
        text,
        useLast
    );


    details.append(
        summary,
        content
    );


    return details;
}


/* ========================= */
/* COLLECT DATA */
/* ========================= */

function collectDraft() {

    if (
        !currentWorkoutType
    ) {

        return null;
    }


    const exercises =
        Array.from(
            document.querySelectorAll(
                ".exercise-card"
            )
        ).map(
            card => {

                const sets =
                    Array.from(
                        card.querySelectorAll(
                            ".set-card"
                        )
                    ).map(
                        set => ({

                            entry:
                                set
                                    .querySelector(
                                        ".set-entry"
                                    )
                                    .value
                                    .trim(),

                            note:
                                set
                                    .querySelector(
                                        ".set-note"
                                    )
                                    .value
                                    .trim()
                        })
                    );


                return {

                    name:
                        card
                            .querySelector(
                                ".exercise-name"
                            )
                            .value
                            .trim(),

                    note:
                        card
                            .querySelector(
                                ".exercise-note"
                            )
                            .value
                            .trim(),

                    sets
                };
            }
        );


    return {

        workoutType:
            currentWorkoutType,

        date:
            workoutDate.value
            ||
            todayValue(),

        bodyWeight:
            bodyWeight.value,

        location:
            sessionLocation
                .value
                .trim(),

        sessionNote:
            sessionNote
                .value
                .trim(),

        overallWorkoutNote:
            overallWorkoutNote
                .value
                .trim(),

        cardio: {

            type:
                cardioType.value,

            calories:
                calories.value,

            distance:
                distance.value,

            time:
                cardioTime.value,

            pace:
                pace.value,

            speed:
                speed.value,

            feetClimbed:
                feetClimbed.value,

            steps:
                steps.value,

            spm:
                spm.value,

            note:
                cardioNote
                    .value
                    .trim()
        },

        exercises,

        existingWorkoutId:
            currentDraft
                ?.existingWorkoutId
            ||
            null,

        savedAt:
            currentDraft
                ?.savedAt
            ||
            null
    };
}


/* ========================= */
/* AUTOSAVE */
/* ========================= */

function saveCurrentDraft() {

    if (
        !currentWorkoutType
        ||
        !currentDraft
    ) {

        return;
    }


    currentDraft =
        collectDraft();


    appData.drafts[
        currentWorkoutType
    ] =
        currentDraft;


    saveAppData();


    topSaveStatus.textContent =
        "Saved";
}


function scheduleAutosave() {

    if (
        !currentWorkoutType
    ) {

        return;
    }


    clearTimeout(
        autosaveTimer
    );


    topSaveStatus.textContent =
        "Saving...";


    autosaveTimer =
        setTimeout(
            saveCurrentDraft,
            300
        );
}


sessionArea.addEventListener(
    "input",
    scheduleAutosave
);


sessionArea.addEventListener(
    "change",
    scheduleAutosave
);


/* ========================= */
/* SAVE WORKOUT */
/* ========================= */

function draftHasData(draft) {

    if (!draft) {

        return false;
    }


    return (
        draft.location
        ||
        draft.bodyWeight
        ||
        draft.sessionNote
        ||
        draft.overallWorkoutNote

        ||

        draft.exercises.some(
            exercise =>

                exercise.note

                ||

                exercise.sets.some(
                    set =>

                        set.entry
                        ||
                        set.note
                )
        )

        ||

        Object.entries(
            draft.cardio
        ).some(
            (
                [
                    key,
                    value
                ]
            ) =>

                key !== "type"
                &&
                value
        )
    );
}


function saveWorkout() {

    saveCurrentDraft();


    if (
        !draftHasData(
            currentDraft
        )
    ) {

        alert(
            "Log something first before saving the workout."
        );

        return;
    }


    const now =
        new Date()
            .toISOString();


    let id =
        currentDraft
            .existingWorkoutId;


    if (!id) {

        id =
            `workout_${Date.now()}`;
    }


    const workout = {

        ...currentDraft,

        id,

        savedAt:
            now
    };


    delete workout.existingWorkoutId;


    const index =
        appData.workouts
            .findIndex(
                item =>
                    item.id === id
            );


    if (
        index >= 0
    ) {

        appData.workouts[index] =
            workout;

    } else {

        appData.workouts.push(
            workout
        );
    }


    currentDraft
        .existingWorkoutId
        =
        id;


    currentDraft.savedAt =
        now;


    appData.drafts[
        currentWorkoutType
    ] =
        currentDraft;


    saveAppData();


    saveWorkoutButton.textContent =
        "Saved ✓";


    topSaveStatus.textContent =
        "Workout Saved";


    setTimeout(
        () => {

            saveWorkoutButton.textContent =
                "Update Workout";

            topSaveStatus.textContent =
                "Saved";

        },
        1200
    );
}


saveWorkoutButton.addEventListener(
    "click",
    saveWorkout
);


/* ========================= */
/* NEW SESSION */
/* ========================= */

newSessionButton.addEventListener(
    "click",
    () => {

        saveCurrentDraft();


        if (
            currentDraft
            &&
            draftHasData(
                currentDraft
            )
            &&
            !currentDraft
                .existingWorkoutId
        ) {

            const okay =
                confirm(
                    "This workout has not been saved yet. Start a new session anyway?"
                );


            if (!okay) {

                return;
            }
        }


        currentDraft =
            freshDraft(
                currentWorkoutType
            );


        appData.drafts[
            currentWorkoutType
        ] =
            currentDraft;


        saveAppData();

        renderDraft();


        window.scrollTo(
            0,
            0
        );
    }
);


/* ========================= */
/* ADD EXERCISE */
/* ========================= */

addExerciseButton.addEventListener(
    "click",
    () => {

        exerciseList.appendChild(
            createExerciseCard(
                emptyExercise()
            )
        );


        scheduleAutosave();
    }
);


/* ========================= */
/* TEXT OUTPUT */
/* ========================= */

function cardioToText(cardio) {

    const lines =
        [];


    const hasData =
        cardio.calories
        ||
        cardio.distance
        ||
        cardio.time
        ||
        cardio.pace
        ||
        cardio.speed
        ||
        cardio.feetClimbed
        ||
        cardio.steps
        ||
        cardio.spm
        ||
        cardio.note;


    if (!hasData) {

        return "";
    }


    lines.push(
        cardio.type
        ||
        "Cardio"
    );


    if (cardio.calories) {
        lines.push(
            `Calories: ${cardio.calories}`
        );
    }


    if (cardio.distance) {
        lines.push(
            `Distance: ${cardio.distance} miles`
        );
    }


    if (cardio.feetClimbed) {
        lines.push(
            `Feet climbed: ${cardio.feetClimbed} ft`
        );
    }


    if (cardio.time) {
        lines.push(
            `Time: ${cardio.time}`
        );
    }


    if (cardio.speed) {
        lines.push(
            `Speed: ${cardio.speed} mph`
        );
    }


    if (cardio.pace) {
        lines.push(
            `Pace: ${cardio.pace} min/mile`
        );
    }


    if (cardio.steps) {
        lines.push(
            `Steps: ${cardio.steps}`
        );
    }


    if (cardio.spm) {
        lines.push(
            `SPM: ${cardio.spm}`
        );
    }


    if (cardio.note) {
        lines.push(
            `(${cardio.note})`
        );
    }


    return lines.join("\n");
}


function workoutToText(workout) {

    let heading =
        formatDate(
            workout.date
        );


    if (
        workout.location
    ) {

        heading +=
            ` (${workout.location})`;
    }


    if (
        workout.sessionNote
    ) {

        heading +=
            ` - ${workout.sessionNote}`;
    }


    const lines =
        [
            heading,
            ""
        ];


    if (
        workout.bodyWeight
    ) {

        lines.push(
            `Weight: ${workout.bodyWeight}`,
            ""
        );
    }


    if (
        workout.workoutType
        ===
        "Cardio + Abs"
    ) {

        const cardio =
            cardioToText(
                workout.cardio
            );


        if (cardio) {

            lines.push(
                cardio,
                ""
            );
        }
    }


    (
        workout.exercises
        ||
        []
    ).forEach(
        exercise => {

            const useful =
                (
                    exercise.sets
                    ||
                    []
                ).filter(
                    set =>
                        set.entry
                        ||
                        set.note
                );


            if (
                !exercise.note
                &&
                useful.length === 0
            ) {

                return;
            }


            let title =
                exercise.name
                ||
                "Exercise";


            if (
                exercise.note
            ) {

                title +=
                    ` (${exercise.note})`;
            }


            lines.push(title);


            useful.forEach(
                set => {

                    let result =
                        set.entry
                        ||
                        "Set";


                    if (
                        set.note
                    ) {

                        result +=
                            ` (${set.note})`;
                    }


                    lines.push(result);
                }
            );


            lines.push("");
        }
    );


    if (
        workout.overallWorkoutNote
    ) {

        lines.push(
            `Workout note: ${workout.overallWorkoutNote}`
        );
    }


    return lines
        .join("\n")
        .trim();
}


/* ========================= */
/* HISTORY */
/* ========================= */

function renderHistory() {

    historyList.innerHTML =
        "";


    let workouts =
        [...appData.workouts];


    if (
        historyFilter !== "All"
    ) {

        workouts =
            workouts.filter(
                workout =>

                    workout.workoutType
                    ===
                    historyFilter
            );
    }


    workouts.sort(
        (
            a,
            b
        ) =>

            String(
                b.date
                ||
                ""
            ).localeCompare(
                String(
                    a.date
                    ||
                    ""
                )
            )
    );


    if (
        workouts.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "empty-state";


        empty.textContent =
            "No workouts saved here yet.";


        historyList.appendChild(
            empty
        );


        return;
    }


    workouts.forEach(
        workout => {

            const details =
                document.createElement(
                    "details"
                );


            details.className =
                "history-entry";


            const summary =
                document.createElement(
                    "summary"
                );


            summary.textContent =
                `${
                    workout.workoutType
                } • ${
                    formatDate(
                        workout.date
                    )
                }`;


            const text =
                document.createElement(
                    "pre"
                );


            text.textContent =
                workoutToText(
                    workout
                );


            const actions =
                document.createElement(
                    "div"
                );


            actions.className =
                "history-actions";


            const copy =
                document.createElement(
                    "button"
                );


            copy.textContent =
                "Copy";


            copy.addEventListener(
                "click",
                async event => {

                    event.preventDefault();


                    await copyText(
                        workoutToText(
                            workout
                        )
                    );


                    copy.textContent =
                        "Copied ✓";


                    setTimeout(
                        () =>
                            copy.textContent =
                                "Copy",
                        1000
                    );
                }
            );


            const remove =
                document.createElement(
                    "button"
                );


            remove.className =
                "delete-history";


            remove.textContent =
                "Delete";


            remove.addEventListener(
                "click",
                event => {

                    event.preventDefault();


                    if (
                        !confirm(
                            "Delete this workout permanently?"
                        )
                    ) {

                        return;
                    }


                    appData.workouts =
                        appData.workouts
                            .filter(
                                item =>
                                    item.id
                                    !==
                                    workout.id
                            );


                    saveAppData();

                    renderHistory();
                }
            );


            actions.append(
                copy,
                remove
            );


            details.append(
                summary,
                text,
                actions
            );


            historyList.appendChild(
                details
            );
        }
    );
}


historyFilters.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                historyFilters.forEach(
                    item =>
                        item.classList.remove(
                            "active-filter"
                        )
                );


                button.classList.add(
                    "active-filter"
                );


                historyFilter =
                    button.dataset.filter;


                renderHistory();
            }
        );
    }
);


/* ========================= */
/* COPY */
/* ========================= */

async function copyText(text) {

    try {

        await navigator
            .clipboard
            .writeText(text);

    } catch {

        const area =
            document.createElement(
                "textarea"
            );


        area.value =
            text;


        document.body
            .appendChild(area);


        area.select();


        document.execCommand(
            "copy"
        );


        area.remove();
    }
}


/* ========================= */
/* DOWNLOAD -->
/* ========================= */

function downloadFile(
    name,
    contents,
    type
) {

    const blob =
        new Blob(
            [contents],
            {
                type
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;

    link.download =
        name;


    document.body
        .appendChild(link);


    link.click();

    link.remove();


    setTimeout(
        () =>
            URL.revokeObjectURL(
                url
            ),
        1000
    );
}


/* ========================= */
/* BACKUP */
/* ========================= */

function updateBackupStatus() {

    if (
        !appData.lastBackupAt
    ) {

        backupStatusText.textContent =
            "No backup exported yet.";

        return;
    }


    const date =
        new Date(
            appData.lastBackupAt
        );


    backupStatusText.textContent =
        `Last backup: ${
            date.toLocaleDateString(
                "en-US",
                {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                }
            )
        }`;
}


exportBackupButton.addEventListener(
    "click",
    () => {

        saveCurrentDraft();


        appData.lastBackupAt =
            new Date()
                .toISOString();


        saveAppData();

        updateBackupStatus();


        downloadFile(

            `WorkoutTracker-Backup-${todayValue()}.json`,

            JSON.stringify(
                appData,
                null,
                2
            ),

            "application/json"
        );
    }
);


importBackupButton.addEventListener(
    "click",
    () => {

        importBackupInput.click();
    }
);


importBackupInput.addEventListener(
    "change",
    () => {

        const file =
            importBackupInput
                .files[0];


        if (!file) {

            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            () => {

                try {

                    const data =
                        JSON.parse(
                            reader.result
                        );


                    if (
                        !Array.isArray(
                            data.workouts
                        )
                    ) {

                        throw new Error();
                    }


                    if (
                        !confirm(
                            "Restore this backup? It will replace the workout data currently stored on this device."
                        )
                    ) {

                        return;
                    }


                    appData = {

                        version:
                            3,

                        workouts:
                            data.workouts,

                        drafts:
                            data.drafts
                            ||
                            {},

                        lastBackupAt:
                            data.lastBackupAt
                            ||
                            null
                    };


                    saveAppData();

                    currentWorkoutType =
                        "";

                    currentDraft =
                        null;

                    sessionArea
                        .classList
                        .add(
                            "hidden"
                        );

                    saveDock
                        .classList
                        .add(
                            "hidden"
                        );


                    workoutChoices.forEach(
                        button =>
                            button.classList.remove(
                                "selected-workout"
                            )
                    );


                    updateBackupStatus();

                    alert(
                        "Workout backup restored."
                    );

                } catch {

                    alert(
                        "That does not appear to be a valid Workout Tracker backup."
                    );
                }
            };


        reader.readAsText(
            file
        );


        importBackupInput.value =
            "";
    }
);


exportTextButton.addEventListener(
    "click",
    () => {

        saveCurrentDraft();


        if (
            appData.workouts.length === 0
        ) {

            alert(
                "You do not have any saved workouts yet."
            );

            return;
        }


        const types =
            [
                "Push Day",
                "Pull Day",
                "Cardio + Abs",
                "Legs Day"
            ];


        const text =
            types

                .map(
                    type => {

                        const workouts =
                            appData.workouts

                                .filter(
                                    workout =>
                                        workout.workoutType
                                        ===
                                        type
                                )

                                .sort(
                                    (
                                        a,
                                        b
                                    ) =>

                                        String(
                                            b.date
                                            ||
                                            ""
                                        ).localeCompare(
                                            String(
                                                a.date
                                                ||
                                                ""
                                            )
                                        )
                                );


                        if (
                            workouts.length
                            ===
                            0
                        ) {

                            return "";
                        }


                        return (

                            type.toUpperCase()

                            +

                            "\n\n"

                            +

                            workouts
                                .map(
                                    workoutToText
                                )
                                .join(
                                    "\n\n--------------------\n\n"
                                )
                        );
                    }
                )

                .filter(Boolean)

                .join(
                    "\n\n========================================\n\n"
                );


        downloadFile(

            `Workout-History-${todayValue()}.txt`,

            text,

            "text/plain"
        );
    }
);


/* ========================= */
/* PAGE EXIT */
/* ========================= */

window.addEventListener(
    "beforeunload",
    saveCurrentDraft
);


updateBackupStatus();