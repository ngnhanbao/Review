/* ===== STATE / STORAGE ===== */
const STORAGE_KEY = "ontap_chinhtri_progress_v1";

function loadProgress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    return {};
}
function saveProgress(p) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch (e) { }
}
let progress = loadProgress(); // { [questionIndex]: true }  true = known

QUIZ_DATA.forEach((q, i) => (q._idx = i));

const BAI_ORDER = [];
const baiMap = {};
QUIZ_DATA.forEach((q) => {
    if (!baiMap[q.bai]) {
        baiMap[q.bai] = { bai: q.bai, title: q.baiTitle, items: [] };
        BAI_ORDER.push(q.bai);
    }
    baiMap[q.bai].items.push(q);
});

const ALL_ANSWERS = QUIZ_DATA.map((q) => q.a);

/* ===== VIEW NAV ===== */
function showView(id) {
    document
        .querySelectorAll(".view")
        .forEach((v) => v.classList.remove("active"));
    document.getElementById(id).classList.add("active");
}

/* ===== HOME RENDER ===== */
function knownCount(items) {
    return items.filter((q) => progress[q._idx]).length;
}

function renderHome() {
    const total = QUIZ_DATA.length;
    const known = knownCount(QUIZ_DATA);
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-known").textContent = known;
    document.getElementById("stat-percent").textContent = total
        ? Math.round((known / total) * 100) + "%"
        : "0%";

    const headerSub = document.getElementById("header-sub");
    if (headerSub) {
        headerSub.textContent = `${total} câu hỏi · ${BAI_ORDER.length} chuyên đề · Flashcard & Trắc nghiệm`;
    }

    const list = document.getElementById("bai-list");
    list.innerHTML = "";
    BAI_ORDER.forEach((baiKey) => {
        const g = baiMap[baiKey];
        const k = knownCount(g.items);
        const pct = Math.round((k / g.items.length) * 100);
        const numOnly = (g.bai.match(/\d+/) || [""])[0];
        const div = document.createElement("div");
        div.className = "bai-item";
        div.innerHTML = `
      <div class="bai-num">${numOnly}</div>
      <div class="bai-info">
        <span class="bai-title">${escapeHtml(g.title)}</span>
        <div class="bai-meta">${g.items.length} câu &middot; ${k} đã nhớ</div>
        <div class="bai-bar"><div class="bai-bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="bai-actions">
        <button class="icon-btn" title="Flashcard">🗂️</button>
        <button class="icon-btn" title="Trắc nghiệm">📝</button>
      </div>
    `;
        div.querySelector(".bai-info").addEventListener("click", () =>
            startSession(
                g.items.map((q) => q._idx),
                `${g.bai}: ${g.title}`,
                false,
            ),
        );
        const icons = div.querySelectorAll(".icon-btn");
        icons[0].addEventListener("click", (e) => {
            e.stopPropagation();
            startSession(
                g.items.map((q) => q._idx),
                `${g.bai}: ${g.title}`,
                false,
            );
        });
        icons[1].addEventListener("click", (e) => {
            e.stopPropagation();
            startQuiz(
                g.items.map((q) => q._idx),
                `${g.bai}: ${g.title}`,
                false,
            );
        });
        list.appendChild(div);
    });
}

function escapeHtml(s) {
    return s.replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c],
    );
}

/* ===== SHUFFLE HELPER ===== */
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ===== FLASHCARD SESSION ===== */
let session = { ids: [], pos: 0, label: "" };

function startSession(ids, label, doShuffle) {
    let list = ids.slice();
    if (doShuffle) {
        const unknown = shuffle(list.filter((i) => !progress[i]));
        const known = shuffle(list.filter((i) => progress[i]));
        list = unknown.concat(known);
    }
    session = { ids: list, pos: 0, label: label };
    showView("view-study");
    renderCard();
}

function currentQ() {
    return QUIZ_DATA[session.ids[session.pos]];
}

function renderCard() {
    const card = document.getElementById("card");
    card.classList.remove("flipped");
    const q = currentQ();
    document.getElementById("study-title").textContent = session.label;
    document.getElementById("study-counter").textContent =
        session.pos + 1 + " / " + session.ids.length;
    document.getElementById("study-nav-dots").textContent =
        session.pos + 1 + " / " + session.ids.length;
    const pct = Math.round((session.pos / session.ids.length) * 100);
    document.getElementById("study-track-fill").style.width = pct + "%";

    document.getElementById("q-text").textContent = q.q;
    document.getElementById("a-text").textContent = q.a;

    const wrongBox = document.getElementById("wrong-box");
    const wrongUl = document.getElementById("wrong-ul");
    wrongUl.innerHTML = "";
    if (q.wrong && q.wrong.length) {
        wrongBox.style.display = "block";
        q.wrong.forEach((w) => {
            const li = document.createElement("li");
            li.textContent = w;
            wrongUl.appendChild(li);
        });
    } else {
        wrongBox.style.display = "none";
    }

    document.getElementById("action-row").style.visibility = "hidden";
    document.getElementById("flip-prompt").style.display = "block";

    document.getElementById("study-prev").disabled = session.pos === 0;
    document.getElementById("study-next").disabled =
        session.pos === session.ids.length - 1;
}

document.getElementById("card").addEventListener("click", () => {
    const card = document.getElementById("card");
    const flipped = card.classList.toggle("flipped");
    document.getElementById("action-row").style.visibility = flipped
        ? "visible"
        : "hidden";
    document.getElementById("flip-prompt").style.display = flipped
        ? "none"
        : "block";
});

function markAndAdvance(markKnown) {
    const q = currentQ();
    progress[q._idx] = !!markKnown;
    saveProgress(progress);

    if (session.pos + 1 >= session.ids.length) {
        document.getElementById("done-num").textContent = session.ids.length;
        document.getElementById("done-label").textContent =
            "câu đã ôn xong trong lượt này 🎉";
        document.getElementById("done-sub").style.display = "none";
        showView("view-done");
    } else {
        session.pos++;
        renderCard();
    }
}

document.getElementById("btn-again").addEventListener("click", (e) => {
    e.stopPropagation();
    markAndAdvance(false);
});
document.getElementById("btn-know").addEventListener("click", (e) => {
    e.stopPropagation();
    markAndAdvance(true);
});

/* free navigation arrows (don't force a rating) */
document.getElementById("study-prev").addEventListener("click", () => {
    if (session.pos > 0) {
        session.pos--;
        renderCard();
    }
});
document.getElementById("study-next").addEventListener("click", () => {
    if (session.pos < session.ids.length - 1) {
        session.pos++;
        renderCard();
    }
});

document.getElementById("btn-back").addEventListener("click", () => {
    quizSession.active = false;
    renderHome();
    showView("view-home");
});

document.getElementById("btn-done-home").addEventListener("click", () => {
    renderHome();
    showView("view-home");
});
document.getElementById("btn-done-again").addEventListener("click", () => {
    if (quizSession.active) {
        startQuiz(quizSession.ids, quizSession.label, false);
    } else {
        startSession(session.ids, session.label, false);
    }
});

document.getElementById("btn-all-shuffle").addEventListener("click", () => {
    startSession(
        QUIZ_DATA.map((q) => q._idx),
        "Ôn tất cả · Ngẫu nhiên",
        true,
    );
});
document.getElementById("btn-all-order").addEventListener("click", () => {
    startSession(
        QUIZ_DATA.map((q) => q._idx),
        "Ôn tất cả · Theo thứ tự",
        false,
    );
});

document.getElementById("btn-reset").addEventListener("click", () => {
    if (
        confirm(
            "Bạn có chắc muốn xóa toàn bộ tiến độ đã lưu? Hành động này không thể hoàn tác.",
        )
    ) {
        progress = {};
        saveProgress(progress);
        renderHome();
    }
});

/* keyboard shortcuts during flashcard study */
document.addEventListener("keydown", (e) => {
    if (document.getElementById("view-study").classList.contains("active")) {
        if (e.code === "Space") {
            e.preventDefault();
            document.getElementById("card").click();
        } else if (e.key === "ArrowRight" || e.key === "1") {
            if (document.getElementById("card").classList.contains("flipped"))
                markAndAdvance(true);
        } else if (e.key === "ArrowLeft" || e.key === "0") {
            if (document.getElementById("card").classList.contains("flipped"))
                markAndAdvance(false);
        }
    }
});

/* ===== QUIZ MODE ===== */
let quizSession = {
    active: false,
    ids: [],
    pos: 0,
    label: "",
    score: 0,
    answered: false,
    optionsCache: {},
};

function buildOptionsFor(q) {
    let distractors = [];
    if (q.wrong && q.wrong.length) {
        distractors = q.wrong.slice(0, 3);
    }
    if (distractors.length < 3) {
        const pool = shuffle(
            ALL_ANSWERS.filter((a) => a !== q.a && !distractors.includes(a)),
        );
        let i = 0;
        while (distractors.length < 3 && i < pool.length) {
            distractors.push(pool[i]);
            i++;
        }
    }
    const opts = shuffle([q.a, ...distractors.slice(0, 3)]);
    return opts;
}

function startQuiz(ids, label, doShuffle) {
    let list = ids.slice();
    if (doShuffle) list = shuffle(list);
    quizSession = {
        active: true,
        ids: list,
        pos: 0,
        label: label,
        score: 0,
        answered: false,
        optionsCache: {},
    };
    showView("view-quiz");
    renderQuiz();
}

function currentQuizQ() {
    return QUIZ_DATA[quizSession.ids[quizSession.pos]];
}

function renderQuiz() {
    const q = currentQuizQ();
    document.getElementById("quiz-title").textContent = quizSession.label;
    document.getElementById("quiz-counter").textContent =
        quizSession.pos + 1 + " / " + quizSession.ids.length;
    document.getElementById("quiz-nav-dots").textContent =
        quizSession.pos + 1 + " / " + quizSession.ids.length;
    document.getElementById("quiz-q-num").textContent = String(
        quizSession.pos + 1,
    ).padStart(2, "0");
    document.getElementById("quiz-q-text").textContent = q.q;
    document.getElementById("quiz-score-pill").textContent =
        quizSession.score + " đúng";
    const pct = Math.round((quizSession.pos / quizSession.ids.length) * 100);
    document.getElementById("quiz-track-fill").style.width = pct + "%";

    if (!quizSession.optionsCache[quizSession.pos]) {
        quizSession.optionsCache[quizSession.pos] = buildOptionsFor(q);
    }
    const opts = quizSession.optionsCache[quizSession.pos];

    const wrap = document.getElementById("quiz-options");
    wrap.innerHTML = "";
    const letters = ["A", "B", "C", "D"];
    quizSession.answered = false;
    opts.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "opt-btn";
        btn.innerHTML = `<span>${escapeHtml(opt)}</span><span class="opt-letter">${letters[idx]}</span>`;
        btn.addEventListener("click", () => selectQuizOption(opt, q.a, btn));
        wrap.appendChild(btn);
    });

    document.getElementById("btn-quiz-confirm").disabled = true;
    document.getElementById("btn-quiz-confirm").textContent =
        "Chọn một đáp án";

    document.getElementById("quiz-prev").disabled = quizSession.pos === 0;
    document.getElementById("quiz-next-arrow").disabled =
        quizSession.pos === quizSession.ids.length - 1;
}

function selectQuizOption(chosen, correct, btnEl) {
    if (quizSession.answered) return;
    quizSession.answered = true;
    const isCorrect = chosen === correct;
    if (isCorrect) quizSession.score++;
    document.getElementById("quiz-score-pill").textContent =
        quizSession.score + " đúng";

    const allBtns = document.querySelectorAll("#quiz-options .opt-btn");
    allBtns.forEach((b) => {
        const txt = b.querySelector("span").textContent;
        b.classList.add("locked");
        if (txt === correct) {
            b.classList.add("correct");
        } else if (b === btnEl) {
            b.classList.add("wrong");
        } else {
            b.classList.add("dim");
        }
    });

    const isLast = quizSession.pos === quizSession.ids.length - 1;
    const confirmBtn = document.getElementById("btn-quiz-confirm");
    confirmBtn.disabled = false;
    confirmBtn.textContent = isLast ? "Xem kết quả" : "Câu tiếp theo →";
}

document.getElementById("btn-quiz-confirm").addEventListener("click", () => {
    if (!quizSession.answered) return;
    if (quizSession.pos + 1 >= quizSession.ids.length) {
        document.getElementById("done-num").textContent =
            quizSession.score + "/" + quizSession.ids.length;
        document.getElementById("done-label").textContent =
            "câu trả lời đúng 🎉";
        const pct = Math.round(
            (quizSession.score / quizSession.ids.length) * 100,
        );
        document.getElementById("done-sub").style.display = "block";
        document.getElementById("done-sub").textContent =
            "Độ chính xác: " + pct + "%";
        showView("view-done");
    } else {
        quizSession.pos++;
        renderQuiz();
    }
});

document.getElementById("quiz-prev").addEventListener("click", () => {
    if (quizSession.pos > 0) {
        quizSession.pos--;
        renderQuiz();
    }
});
document.getElementById("quiz-next-arrow").addEventListener("click", () => {
    if (quizSession.pos < quizSession.ids.length - 1) {
        quizSession.pos++;
        renderQuiz();
    }
});

document.getElementById("btn-quiz-back").addEventListener("click", () => {
    quizSession.active = false;
    renderHome();
    showView("view-home");
});

document.getElementById("btn-quiz-shuffle").addEventListener("click", () => {
    startQuiz(
        QUIZ_DATA.map((q) => q._idx),
        "Trắc nghiệm · Ngẫu nhiên",
        true,
    );
});
document.getElementById("btn-quiz-order").addEventListener("click", () => {
    startQuiz(
        QUIZ_DATA.map((q) => q._idx),
        "Trắc nghiệm · Theo thứ tự",
        false,
    );
});

/* ===== INIT ===== */
renderHome();