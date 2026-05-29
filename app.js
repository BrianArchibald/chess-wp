let db = {};
let board = null;
let game = null;
let solutionMoves = [];
let currentMoveIndex = 0;
let isPaused = false;
let timerInterval = null;

let currentMode = localStorage.getItem('chess_mode') || 'easy';
let currentPuzzleNum, totalSeconds, correctMoves, incorrectMoves;

let puzzleMistakeMade = false;
let selectedSquare = null;
let isComputerMoving = false;
let isReviewing = false;

// --- CUSTOM DROPDOWN LOGIC ---
function toggleMenu(event) {
    document.getElementById("menu-content").classList.toggle("show");
    event.stopPropagation();
}

window.onclick = function(event) {
    if (!event.target.matches('.dropbtn') && !event.target.closest('.dropbtn')) {
        let dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            let openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

function setMode(newMode, event) {
    event.preventDefault();
    document.getElementById("menu-content").classList.remove("show");

    if (currentMode === newMode) return;

    currentMode = newMode;
    localStorage.setItem('chess_mode', currentMode);

    stopTimer();
    loadMemory();
    fetchDatabase();
}

function triggerReset(event) {
    event.preventDefault();
    document.getElementById("menu-content").classList.remove("show");
    resetProgress();
}
// -----------------------------

function loadMemory() {
    let defaultPuzzle = currentMode === 'easy' ? "1" : "223";

    currentPuzzleNum = localStorage.getItem(`${currentMode}_save_puzzle`) || defaultPuzzle;
    totalSeconds = parseInt(localStorage.getItem(`${currentMode}_save_time`)) || 0;
    correctMoves = parseInt(localStorage.getItem(`${currentMode}_save_correct`)) || 0;
    incorrectMoves = parseInt(localStorage.getItem(`${currentMode}_save_incorrect`)) || 0;

    let displayMode = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    document.getElementById('current-mode-text').innerText = displayMode;

    let m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    let s = (totalSeconds % 60).toString().padStart(2, '0');
    document.getElementById('time-display').innerText = `${m}:${s}`;
    updateAccuracyDisplay();
}

function resetProgress() {
    let modeName = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    if (confirm(`Are you sure you want to reset all your stats for ${modeName} mode and start over?`)) {
        let defaultPuzzle = currentMode === 'easy' ? "1" : "223";

        localStorage.setItem(`${currentMode}_save_puzzle`, defaultPuzzle);
        localStorage.setItem(`${currentMode}_save_time`, 0);
        localStorage.setItem(`${currentMode}_save_correct`, 0);
        localStorage.setItem(`${currentMode}_save_incorrect`, 0);

        stopTimer();
        loadMemory();
        loadPuzzle(defaultPuzzle);
    }
}

function updateAccuracyDisplay() {
    let totalMoves = correctMoves + incorrectMoves;
    let accuracy = totalMoves === 0 ? 100 : Math.round((correctMoves / totalMoves) * 100);
    document.getElementById('accuracy-display').innerText = `${accuracy}%`;
}

function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        totalSeconds++;
        localStorage.setItem(`${currentMode}_save_time`, totalSeconds);

        let m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        let s = (totalSeconds % 60).toString().padStart(2, '0');
        document.getElementById('time-display').innerText = `${m}:${s}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function togglePause() {
    let boardDiv = document.getElementById('board');
    let pauseBtn = document.getElementById('pause-btn');

    if (isPaused) {
        isPaused = false;
        boardDiv.classList.remove('blurred');
        pauseBtn.innerText = "Pause";
        startTimer();
    } else {
        isPaused = true;
        boardDiv.classList.add('blurred');
        pauseBtn.innerText = "Resume";
        stopTimer();
    }
}

function showHint() {
    if (isPaused || game.game_over()) return;

    let correctMove = solutionMoves[currentMoveIndex];
    if (!correctMove) return;

    // THE FIX: Strip checks and mates so the Hint button never fails!
    let cleanCorrect = correctMove.replace(/[+#]/g, '');
    let legalMoves = game.moves({ verbose: true });
    let correctMoveData = legalMoves.find(m => m.san.replace(/[+#]/g, '') === cleanCorrect);

    if (correctMoveData) {
        let squareEl = document.querySelector('.square-' + correctMoveData.from);
        if (squareEl && !squareEl.classList.contains('highlight-hint')) {
            squareEl.classList.add('highlight-hint');

            if (!isReviewing && !puzzleMistakeMade) {
                incorrectMoves++;
                localStorage.setItem(`${currentMode}_save_incorrect`, incorrectMoves);
                updateAccuracyDisplay();
                puzzleMistakeMade = true;
            }
        }
    }
}

function removeHighlights() {
    document.querySelectorAll('.highlight-hint').forEach(el => el.classList.remove('highlight-hint'));
}

// --- RESTART PUZZLE LOGIC ---
function restartCurrentPuzzle() {
    if (!db[currentPuzzleNum]) return;
    loadPuzzle(currentPuzzleNum, true);
}

function nextPuzzle() {
    currentPuzzleNum = (parseInt(currentPuzzleNum) + 1).toString();

    if (!db[currentPuzzleNum]) {
        alert(`Congratulations! You have completed all the ${currentMode} puzzles!`);
        return;
    }

    localStorage.setItem(`${currentMode}_save_puzzle`, currentPuzzleNum);
    startTimer();
    loadPuzzle(currentPuzzleNum);
}

function fetchDatabase() {
    let dbFile = currentMode === 'easy' ? 'database.json' : 'intermediate_database.json';

    fetch(dbFile)
        .then(response => response.json())
        .then(data => {
            db = data;
            loadPuzzle(currentPuzzleNum);
        })
        .catch(error => console.error("Error loading database:", error));
}

function loadPuzzle(puzzleNumber, reviewing = false) {
    let puzzle = db[puzzleNumber];
    if (!puzzle) return;

    let validFen = puzzle.fen.trim() + " - - 0 1";
    currentMoveIndex = 0;

    isPaused = false;
    puzzleMistakeMade = false;
    selectedSquare = null;
    isComputerMoving = false;
    isReviewing = reviewing;

    document.getElementById('board').classList.remove('blurred');
    document.getElementById('pause-btn').innerText = "Pause";
    document.getElementById('pause-btn').style.visibility = 'visible';
    document.getElementById('next-btn').style.display = 'none';

    document.getElementById('restart-btn').style.display = 'none';
    document.getElementById('hint-btn').style.display = 'flex';

    removeHighlights();

    game = new Chess(validFen);

    let rawSolution = puzzle.solution;
    let cleanSolution = rawSolution.replace(/\d+\.+/g, '').trim();
    solutionMoves = cleanSolution.split(/\s+/);

    document.getElementById('puzzle-title').innerText = `Puzzle ${puzzleNumber}`;

    if (isReviewing) {
        updateStatus("Review Mode - Stats Paused", "#ffb300");
    } else {
        updateStatus(game.turn() === 'w' ? 'White to move' : 'Black to move', "white");
    }

    let config = {
        position: validFen,
        draggable: true,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };

    board = Chessboard('board', config);
    if (game.turn() === 'b') {
        board.flip();
    }
}

// --- CORE MOVE VALIDATION LOGIC ---
function processPlayerMove(source, target) {
    let move = game.move({ from: source, to: target, promotion: 'q' });

    if (move === null) return 'snapback';

    removeHighlights();
    let correctMove = solutionMoves[currentMoveIndex];

    // THE FIX: Strip checks and mates from both moves before comparing!
    let cleanMoveSan = move.san.replace(/[+#]/g, '');
    let cleanCorrectMove = correctMove.replace(/[+#]/g, '');

    if (cleanMoveSan !== cleanCorrectMove) {
        game.undo();

        if (!isReviewing && !puzzleMistakeMade) {
            incorrectMoves++;
            localStorage.setItem(`${currentMode}_save_incorrect`, incorrectMoves);
            updateAccuracyDisplay();
            puzzleMistakeMade = true;
        }

        updateStatus("Incorrect move. Try again!", "#ff5252");
        return 'snapback';
    }

    if (!isReviewing) {
        correctMoves++;
        localStorage.setItem(`${currentMode}_save_correct`, correctMoves);
        updateAccuracyDisplay();
    }

    updateStatus("Correct!", "#4caf50");
    currentMoveIndex++;

    if (currentMoveIndex >= solutionMoves.length) {
        puzzleSolved();
        return 'valid';
    }

    isComputerMoving = true;
    window.setTimeout(makeComputerMove, 500);
    return 'valid';
}

function executeTapMove(targetSquare) {
    let fromSq = selectedSquare;
    selectedSquare = null;

    setTimeout(() => {
        let moveResult = processPlayerMove(fromSq, targetSquare);
        if (moveResult === 'snapback' || moveResult === 'valid') {
            board.position(game.fen(), false);
        }
    }, 10);
}

// --- HYBRID DRAG AND TAP ARCHITECTURE ---
function onDragStart (source, piece, position, orientation) {
    if (isPaused || game.game_over() || isComputerMoving) return false;

    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {

        if (selectedSquare) {
            executeTapMove(source);
        }
        return false;
    }

    if (selectedSquare && selectedSquare !== source) {
        removeHighlights();
        selectedSquare = null;
    }
}

function onDrop (source, target) {
    if (source === target) {
        selectedSquare = source;
        removeHighlights();
        $('.square-' + source).addClass('highlight-hint');
        return 'snapback';
    }

    let result = processPlayerMove(source, target);
    selectedSquare = null;
    return result;
}

$('#board').on('mousedown touchstart', '.square-55d63', function(e) {
    if (isPaused || game.game_over() || isComputerMoving) return;

    let square = $(this).attr('data-square');
    if (!square) return;

    let pieceObj = game.get(square);

    if (!pieceObj && selectedSquare) {
        e.preventDefault();
        executeTapMove(square);
    }
});
// -----------------------------

function makeComputerMove () {
    let computerMove = solutionMoves[currentMoveIndex];

    // We also dynamically strip the engine move here just in case chess.js chokes on the JSON string
    game.move(computerMove.replace(/[+#]/g, ''));

    board.position(game.fen());
    currentMoveIndex++;
    isComputerMoving = false;

    if (currentMoveIndex >= solutionMoves.length) {
        puzzleSolved();
    } else {
        if (!isReviewing) {
            updateStatus(game.turn() === 'w' ? 'White to move' : 'Black to move', "white");
        }
    }
}

function puzzleSolved() {
    if (!isReviewing) stopTimer();

    updateStatus("Puzzle Solved!", "#4caf50");
    document.getElementById('next-btn').style.display = 'block';

    document.getElementById('restart-btn').style.display = 'flex';
    document.getElementById('pause-btn').style.visibility = 'hidden';
    document.getElementById('hint-btn').style.display = 'none';
}

function onSnapEnd () {
    board.position(game.fen());
}

function updateStatus(text, color = "white") {
    let statusDiv = document.getElementById('status');
    statusDiv.innerText = text;
    statusDiv.style.color = color;
}

// INITIAL STARTUP
loadMemory();
fetchDatabase();
startTimer();
