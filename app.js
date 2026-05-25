let db = {};
let board = null;
let game = null;
let solutionMoves = [];
let currentMoveIndex = 0;
let isPaused = false;
let timerInterval = null;

let currentMode = localStorage.getItem('chess_mode') || 'easy';
let currentPuzzleNum, totalSeconds, correctMoves, incorrectMoves;

// --- CUSTOM DROPDOWN LOGIC ---
function toggleMenu(event) {
    document.getElementById("menu-content").classList.toggle("show");
    event.stopPropagation(); // Prevents the click from immediately closing it
}

// Close the dropdown if the user clicks anywhere else on the screen
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
    event.preventDefault(); // Prevents the page from jumping to top
    document.getElementById("menu-content").classList.remove("show"); // Close menu

    if (currentMode === newMode) return;

    currentMode = newMode;
    localStorage.setItem('chess_mode', currentMode);

    stopTimer();
    loadMemory();
    fetchDatabase();
}

function triggerReset(event) {
    event.preventDefault();
    document.getElementById("menu-content").classList.remove("show"); // Close menu
    resetProgress();
}
// -----------------------------

function loadMemory() {
    let defaultPuzzle = currentMode === 'easy' ? "1" : "223";

    currentPuzzleNum = localStorage.getItem(`${currentMode}_save_puzzle`) || defaultPuzzle;
    totalSeconds = parseInt(localStorage.getItem(`${currentMode}_save_time`)) || 0;
    correctMoves = parseInt(localStorage.getItem(`${currentMode}_save_correct`)) || 0;
    incorrectMoves = parseInt(localStorage.getItem(`${currentMode}_save_incorrect`)) || 0;

    // Update the text on our custom dropdown button
    let displayMode = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    document.getElementById('current-mode-text').innerText = displayMode;

    let m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    let s = (totalSeconds % 60).toString().padStart(2, '0');
    document.getElementById('time-display').innerText = `${m}:${s}`;
    updateAccuracyDisplay();
}

loadMemory();

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

    let legalMoves = game.moves({ verbose: true });
    let correctMoveData = legalMoves.find(m => m.san === correctMove);

    if (correctMoveData) {
        let squareEl = document.querySelector('.square-' + correctMoveData.from);
        if (squareEl && !squareEl.classList.contains('highlight-hint')) {
            squareEl.classList.add('highlight-hint');

            incorrectMoves++;
            localStorage.setItem(`${currentMode}_save_incorrect`, incorrectMoves);
            updateAccuracyDisplay();
        }
    }
}

function removeHighlights() {
    document.querySelectorAll('.highlight-hint').forEach(el => el.classList.remove('highlight-hint'));
}

startTimer();

function nextPuzzle() {
    currentPuzzleNum = (parseInt(currentPuzzleNum) + 1).toString();

    if (!db[currentPuzzleNum]) {
        alert(`Congratulations! You have completed all the ${currentMode} puzzles!`);
        return;
    }

    localStorage.setItem(`${currentMode}_save_puzzle`, currentPuzzleNum);
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('pause-btn').style.display = 'block';
    document.getElementById('hint-btn').style.display = 'block';

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

fetchDatabase();

function loadPuzzle(puzzleNumber) {
    let puzzle = db[puzzleNumber];
    if (!puzzle) return;

    let validFen = puzzle.fen.trim() + " - - 0 1";
    currentMoveIndex = 0;
    isPaused = false;
    document.getElementById('board').classList.remove('blurred');
    document.getElementById('pause-btn').innerText = "Pause";
    removeHighlights();

    game = new Chess(validFen);

    let rawSolution = puzzle.solution;
    let cleanSolution = rawSolution.replace(/\d+\.+/g, '').trim();
    solutionMoves = cleanSolution.split(/\s+/);

    document.getElementById('puzzle-title').innerText = `Puzzle ${puzzleNumber}`;
    updateStatus(game.turn() === 'w' ? 'White to move' : 'Black to move', "white");

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

function onDragStart (source, piece, position, orientation) {
    if (isPaused) return false;
    if (game.game_over()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
    removeHighlights();
}

function onDrop (source, target) {
    let move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    removeHighlights();
    let correctMove = solutionMoves[currentMoveIndex];

    if (move.san !== correctMove) {
        game.undo();
        incorrectMoves++;
        localStorage.setItem(`${currentMode}_save_incorrect`, incorrectMoves);
        updateAccuracyDisplay();

        updateStatus("Incorrect move. Try again!", "#ff5252");
        return 'snapback';
    }

    correctMoves++;
    localStorage.setItem(`${currentMode}_save_correct`, correctMoves);
    updateAccuracyDisplay();

    updateStatus("Correct!", "#4caf50");
    currentMoveIndex++;

    if (currentMoveIndex >= solutionMoves.length) {
        puzzleSolved();
        return;
    }

    window.setTimeout(makeComputerMove, 500);
}

function makeComputerMove () {
    let computerMove = solutionMoves[currentMoveIndex];
    game.move(computerMove);
    board.position(game.fen());
    currentMoveIndex++;

    if (currentMoveIndex >= solutionMoves.length) {
        puzzleSolved();
    } else {
        updateStatus(game.turn() === 'w' ? 'White to move' : 'Black to move', "white");
    }
}

function puzzleSolved() {
    stopTimer();
    updateStatus("Puzzle Solved!", "#4caf50");
    document.getElementById('next-btn').style.display = 'block';
    document.getElementById('pause-btn').style.display = 'none';
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
