// ============================================
// Firebase Configuration
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyCpSpPI2Ak6Ts4uMJ3tBqPPLziGDKssZGE",
    authDomain: "elevator-game-8a4bb.firebaseapp.com",
    databaseURL: "https://elevator-game-8a4bb-default-rtdb.firebaseio.com",
    projectId: "elevator-game-8a4bb",
    storageBucket: "elevator-game-8a4bb.firebasestorage.app",
    messagingSenderId: "258702222821",
    appId: "1:258702222821:web:9000b3f408dc56bfb73b0c",
    measurementId: "G-BJPXKL7YPB"
};

var db = null;
try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log('Firebase initialized');
    }
} catch (e) {
    console.warn('Firebase init failed:', e.message);
}

// ============================================
// Game State
// ============================================
var gameState = {
    playerName: '',
    userChoice: null,
    confirmStep: 0
};

var roundResults = [];
var isConfirming = false;
var resetTimeoutId = null;
var gameStateListener = null;
var currentRoundBets = [];
var currentRoundStatus = 'idle';

var ELEVATOR_COLORS = {
    1: 'Blue',
    2: 'Red',
    3: 'Yellow',
    4: 'Teal'
};

var NAMES_KEY = 'elevator_player_names';
var STORAGE_KEY = 'elevator_bet_history';

// Idle timer variables
var idleTimerId = null;
var idleCountdownId = null;
var idleCountdownValue = 5;
var idleActive = false;
var idleBettingCountdownId = null;
var IDLE_TIMEOUT = 10000;  // 10 seconds - then 5 second countdown
var IDLE_TIMEOUT_ENABLED = true;

var IDLE_SCREENS = ['name-screen', 'bet-screen', 'confirm1-screen', 'confirm2-screen', 'confirm3-screen', 'confirm4-screen', 'thanks-screen', 'transition-screen', 'waiting-screen'];

var thanksScreenTimeoutId = null;
var lastScreenBeforeIdle = null;

// ============================================
// BGM Music - scene mapping
// ============================================
function updateBGMForScreen(screenId) {
    if (typeof BGM === 'undefined') return;
    var scene = null;
    if (screenId === 'start-screen') scene = 'start';
    else if (screenId === 'name-screen' || screenId === 'bet-screen') scene = 'name-bet';
    else if (screenId === 'confirm1-screen' || screenId === 'confirm2-screen' || screenId === 'confirm3-screen' || screenId === 'confirm4-screen') scene = 'confirm';
    else if (screenId === 'transition-screen') scene = 'transition';
    else if (screenId === 'thanks-screen') { BGM.stop(); return; }
    else if (screenId === 'waiting-screen' && currentRoundBets.length >= 1) scene = 'waiting';
    else if (screenId === 'results-screen') scene = 'results';
    if (scene) BGM.play(scene);
}

// ============================================
// Screen Control
// ============================================
function showThanksScreen() {
    if (thanksScreenTimeoutId) { clearTimeout(thanksScreenTimeoutId); thanksScreenTimeoutId = null; }
    var thanksBg = document.querySelector('#thanks-screen .thanks-bg');
    if (thanksBg) {
        thanksBg.style.animation = 'none';
        thanksBg.offsetHeight;
        thanksBg.style.animation = '';
    }
    showScreen('thanks-screen');
    thanksScreenTimeoutId = setTimeout(function() { proceedFromThanks(); }, 5000);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(function(screen) {
        screen.classList.remove('active');
    });
    var target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }
    if (IDLE_SCREENS.indexOf(screenId) !== -1) {
        resetIdleTimer();
    } else {
        clearIdleTimer();
    }
    updateBGMForScreen(screenId);
}

// ============================================
// Name Suggestions System
// ============================================
function getSavedNames() {
    try {
        var data = localStorage.getItem(NAMES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
}

function savePlayerName(name) {
    var names = getSavedNames();
    var upper = name.toUpperCase();
    var idx = names.indexOf(upper);
    if (idx !== -1) names.splice(idx, 1);
    names.unshift(upper);
    if (names.length > 20) names = names.slice(0, 20);
    try {
        localStorage.setItem(NAMES_KEY, JSON.stringify(names));
    } catch (e) {}
}

function showNameSuggestions() {
    var container = document.getElementById('name-suggestions');
    if (!container) return;
    var names = getSavedNames();
    if (names.length === 0) {
        container.style.display = 'none';
        return;
    }
    var html = '';
    names.slice(0, 8).forEach(function(n) {
        html += '<button class="name-suggestion-btn" onclick="pickName(\'' + n.replace(/'/g, "\\'") + '\')">' + n + '</button>';
    });
    container.innerHTML = html;
    container.style.display = 'flex';
}

function pickName(name) {
    var input = document.getElementById('player-name');
    if (input) input.value = name;
    filterNameSuggestions();
}

function filterNameSuggestions() {
    var input = document.getElementById('player-name');
    var container = document.getElementById('name-suggestions');
    if (!input || !container) return;
    var val = input.value.trim().toUpperCase();
    var names = getSavedNames();
    if (names.length === 0 || val.length === 0) {
        showNameSuggestions();
        return;
    }
    var filtered = names.filter(function(n) { return n.indexOf(val) !== -1; });
    if (filtered.length === 0) {
        container.style.display = 'none';
        return;
    }
    var html = '';
    filtered.slice(0, 6).forEach(function(n) {
        html += '<button class="name-suggestion-btn" onclick="pickName(\'' + n.replace(/'/g, "\\'") + '\')">' + n + '</button>';
    });
    container.innerHTML = html;
    container.style.display = 'flex';
}

// ============================================
// Ranking Popup (SEE YOUR RANKING + QR)
// ============================================
var rankingPopupCountdownId = null;

function showRankingPopup() {
    var popup = document.getElementById('ranking-popup');
    var qrContainer = document.getElementById('ranking-qr-code');
    var countdownEl = document.getElementById('ranking-countdown');
    if (!popup || !countdownEl) return;

    clearIdleTimer();
    if (rankingPopupCountdownId) { clearInterval(rankingPopupCountdownId); rankingPopupCountdownId = null; }

    var sec = 10;
    countdownEl.textContent = sec;
    popup.classList.add('active');

    rankingPopupCountdownId = setInterval(function() {
        sec--;
        countdownEl.textContent = sec;
        if (sec <= 0) {
            clearInterval(rankingPopupCountdownId);
            rankingPopupCountdownId = null;
            closeRankingPopup();
        }
    }, 1000);
}

function closeRankingPopup(ev) {
    if (ev && ev.target !== ev.currentTarget) return;
    var popup = document.getElementById('ranking-popup');
    if (!popup) return;
    if (rankingPopupCountdownId) {
        clearInterval(rankingPopupCountdownId);
        rankingPopupCountdownId = null;
    }
    popup.classList.remove('active');
    var activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id !== 'start-screen') resetIdleTimer();
}

// ============================================
// Game Flow
// ============================================

function startGame() {
    console.log('Game started');
    dismissIdle();
    dismissIdleBetting();
    hideNameWarning();

    showScreen('name-screen');
    showNameSuggestions();
    setTimeout(function() {
        var input = document.getElementById('player-name');
        if (input) {
            input.value = '';
            input.focus();
        }
    }, 500);
}

function submitName() {
    var nameInput = document.getElementById('player-name');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
        nameInput.style.animation = 'shake 0.4s ease';
        setTimeout(function() { nameInput.style.animation = ''; }, 400);
        return;
    }

    // Check for duplicate name in current round
    var upperName = name.toUpperCase();
    var duplicate = currentRoundBets.some(function(b) {
        return b.playerName.toUpperCase() === upperName;
    });
    if (duplicate) {
        showNameWarning('THIS PLAYER ALREADY JOINED! TRY A DIFFERENT NAME!');
        nameInput.style.animation = 'shake 0.4s ease';
        setTimeout(function() { nameInput.style.animation = ''; }, 400);
        return;
    }

    hideNameWarning();
    gameState.playerName = name;
    savePlayerName(name);
    console.log('Player name:', name);
    showScreen('bet-screen');
}

function showNameWarning(msg) {
    var el = document.getElementById('name-warning');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
}

function hideNameWarning() {
    var el = document.getElementById('name-warning');
    if (el) el.style.display = 'none';
}

function selectElevator(elevatorNumber) {
    console.log('Selected elevator:', elevatorNumber, '(' + ELEVATOR_COLORS[elevatorNumber] + ')');
    gameState.userChoice = elevatorNumber;

    document.querySelectorAll('.elevator-door').forEach(function(door) {
        door.classList.remove('selected');
    });
    var doors = document.querySelectorAll('.elevator-door');
    if (doors[elevatorNumber - 1]) {
        doors[elevatorNumber - 1].classList.add('selected');
    }

    gameState.confirmStep = 0;
    var confirmScreen = 'confirm' + elevatorNumber + '-screen';
    var target = document.getElementById(confirmScreen);
    if (target) target.classList.add('confirm-entering');
    showScreen(confirmScreen);
    setTimeout(function() {
        if (target) target.classList.remove('confirm-entering');
    }, 450);
}

function confirmStep(step) {
    if (isConfirming) return;
    console.log('Confirm elevator:', step);
    isConfirming = true;
    submitBetToFirebase();
}

function goBack(fromScreen) {
    if (fromScreen === 'name') {
        showScreen('start-screen');
    } else if (fromScreen === 'bet') {
        showScreen('name-screen');
        showNameSuggestions();
    } else if (fromScreen === 'confirm1' || fromScreen === 'confirm2' || fromScreen === 'confirm3' || fromScreen === 'confirm4') {
        showScreen('bet-screen');
    }
}

// ============================================
// Firebase Game State - Multi-player betting
// ============================================

async function submitBetToFirebase() {
    // Show transition screen with chosen elevator image
    var img = document.getElementById('transition-elevator-img');
    if (img) img.src = 'images/transition-' + gameState.userChoice + '.png';
    showScreen('transition-screen');

    var newBet = {
        playerName: gameState.playerName,
        userChoice: gameState.userChoice
    };

    if (db) {
        try {
            var docRef = db.collection('gameState').doc('current');
            var doc = await docRef.get();

            if (doc.exists && doc.data().status === 'betting') {
                await docRef.update({
                    bets: firebase.firestore.FieldValue.arrayUnion(newBet),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await docRef.set({
                    status: 'betting',
                    bets: [newBet],
                    actualElevator: null,
                    results: [],
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            console.log('Bet added to round:', newBet.playerName, '-> E' + newBet.userChoice);
            startListeningForResults();
            // After transition animation, show thanks screen with entrance effect
            setTimeout(function() { showThanksScreen(); }, 1800);
        } catch (error) {
            console.warn('Firebase submit failed, using random fallback:', error.message);
            fallbackRandom();
            return;
        }
    } else {
        fallbackRandom();
        return;
    }

    // Thanks screen: wait for click to continue (no auto timeout)
}

function proceedFromThanks() {
    var activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id !== 'thanks-screen') return;

    if (thanksScreenTimeoutId) { clearTimeout(thanksScreenTimeoutId); thanksScreenTimeoutId = null; }
    isConfirming = false;
    gameState.playerName = '';
    gameState.userChoice = null;
    gameState.confirmStep = 0;
    var nameInput = document.getElementById('player-name');
    if (nameInput) nameInput.value = '';
    document.querySelectorAll('.elevator-door').forEach(function(door) {
        door.classList.remove('selected');
    });

    var active = document.querySelector('.screen.active');
    if (active && active.id !== 'results-screen') {
        var thanksEl = document.getElementById('thanks-screen');
        var waitingEl = document.getElementById('waiting-screen');
        updateWaitingCount();
        if (thanksEl) thanksEl.classList.add('thanks-exiting');
        if (waitingEl) {
            waitingEl.classList.add('active', 'waiting-entering');
            waitingEl.style.zIndex = '11';
        }
        if (thanksEl) thanksEl.style.zIndex = '12';
        clearIdleTimer();
        updateBGMForScreen('waiting-screen');
        setTimeout(function() {
            if (thanksEl) {
                thanksEl.classList.remove('active', 'thanks-exiting');
                thanksEl.style.zIndex = '';
            }
            if (waitingEl) {
                waitingEl.style.zIndex = '';
                setTimeout(function() {
                    if (waitingEl) waitingEl.classList.remove('waiting-entering');
                }, 50);
            }
        }, 450);
    }
    console.log('On waiting screen - ready for more players');
}

function updateWaitingCount() {
    var countEl = document.getElementById('waiting-count');
    if (countEl) {
        var n = currentRoundBets.length;
        countEl.textContent = n + (n === 1 ? ' PLAYER' : ' PLAYERS') + ' BETTING';
    }
}

function fallbackRandom() {
    var actualElevator = Math.floor(Math.random() * 4) + 1;
    var result = gameState.userChoice === actualElevator ? 'win' : 'lose';
    roundResults = [{
        playerName: gameState.playerName,
        userChoice: gameState.userChoice,
        result: result
    }];
    saveBetLocally(gameState.playerName, gameState.userChoice, actualElevator, result);

    setTimeout(function() {
        showScreen('results-screen');
        renderResultsScreen(roundResults, actualElevator);
        autoResetAfterResult();
    }, 2000);
}

// Listen for round state changes (new bets + resolution)
function startListeningForResults() {
    if (gameStateListener) return;

    gameStateListener = db.collection('gameState').doc('current').onSnapshot(function(doc) {
        if (!doc.exists) return;
        var data = doc.data();

        // Track current round state
        currentRoundBets = data.bets || [];
        currentRoundStatus = data.status || 'idle';

        // Update waiting screen count if visible
        var activeScreen = document.querySelector('.screen.active');
        if (activeScreen && activeScreen.id === 'waiting-screen') {
            updateWaitingCount();
        }

        if (data.status === 'resolved' && data.actualElevator) {
            roundResults = data.results || [];
            console.log('Round resolved! Elevator:', data.actualElevator, 'Results:', roundResults.length, 'players');

            if (gameStateListener) {
                gameStateListener();
                gameStateListener = null;
            }

            // Close any idle overlays
            dismissIdle();
            dismissIdleBetting();

            showScreen('results-screen');
            renderResultsScreen(roundResults, data.actualElevator);
            autoResetAfterResult();
        }
    });
}

function autoResetAfterResult() {
    if (resetTimeoutId) clearTimeout(resetTimeoutId);
    resetTimeoutId = setTimeout(function() {
        resetTimeoutId = null;
        resetGameToIdle();
    }, 10000);
}

async function resetGameToIdle() {
    if (db) {
        try {
            await db.collection('gameState').doc('current').set({
                status: 'idle',
                bets: [],
                actualElevator: null,
                results: [],
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.warn('Reset Firebase failed:', e.message);
        }
    }
    resetGame();
}

// ============================================
// Results Screen Rendering (Multi-player)
// ============================================
function renderResultsScreen(results, actualElevator) {
    var container = document.getElementById('results-content');
    if (!container) return;

    var elevName = 'E' + actualElevator + ' (' + ELEVATOR_COLORS[actualElevator] + ')';
    var winners = results.filter(function(r) { return r.result === 'win'; });
    var losers = results.filter(function(r) { return r.result === 'lose'; });

    var html = '<div class="results-elevator">ELEVATOR ' + elevName + ' ARRIVED!</div>';

    if (winners.length > 0) {
        html += '<div class="results-section">';
        html += '<div class="results-section-title results-win-title">WINNERS!</div>';
        winners.forEach(function(w) {
            html += '<div class="results-player results-player-win">' +
                    '<span class="results-player-name">' + w.playerName.toUpperCase() + '</span>' +
                    '<span class="results-player-bet">BET E' + w.userChoice + '</span>' +
                    '</div>';
        });
        html += '</div>';
    }

    if (losers.length > 0) {
        html += '<div class="results-section">';
        html += '<div class="results-section-title results-lose-title">BETTER LUCK NEXT TIME</div>';
        losers.forEach(function(l) {
            html += '<div class="results-player results-player-lose">' +
                    '<span class="results-player-name">' + l.playerName.toUpperCase() + '</span>' +
                    '<span class="results-player-bet">BET E' + l.userChoice + '</span>' +
                    '</div>';
        });
        html += '</div>';
    }

    html += '<div class="results-total">' + results.length + ' PLAYERS THIS ROUND</div>';

    container.innerHTML = html;
    generateQRCode();
}

// ============================================
// Local Storage fallback
// ============================================
function getLocalBets() {
    try {
        var data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
}

function saveBetLocally(playerName, userChoice, actualElevator, result) {
    var bets = getLocalBets();
    bets.push({
        playerName: playerName,
        userChoice: userChoice,
        actualElevator: actualElevator,
        result: result,
        timestamp: Date.now()
    });
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
    } catch (e) {}
}

// ============================================
// QR Code
// ============================================
function generateQRCode() {
    var qrContainer = document.getElementById('qr-code');
    if (!qrContainer) return;
    qrContainer.innerHTML = '';

    try {
        var statsUrl = window.location.origin + '/stats.html';
        var statsCanvas = document.createElement('canvas');
        QRCode.toCanvas(statsCanvas, statsUrl, {
            width: 100, margin: 2,
            color: { dark: '#2a2a7e', light: '#ffffff' }
        }, function(error) {
            if (!error) {
                var wrap = document.createElement('div');
                wrap.style.cssText = 'display:inline-block;text-align:center;margin-right:10px;';
                wrap.appendChild(statsCanvas);
                var label = document.createElement('div');
                label.style.cssText = 'font-family:Bangers,cursive;font-size:11px;color:#fff;letter-spacing:1px;margin-top:4px;';
                label.textContent = 'VIEW STATS';
                wrap.appendChild(label);
                qrContainer.appendChild(wrap);
            }
        });

        var adminUrl = window.location.origin + '/admin.html';
        var adminCanvas = document.createElement('canvas');
        QRCode.toCanvas(adminCanvas, adminUrl, {
            width: 100, margin: 2,
            color: { dark: '#e63946', light: '#ffffff' }
        }, function(error) {
            if (!error) {
                var wrap = document.createElement('div');
                wrap.style.cssText = 'display:inline-block;text-align:center;';
                wrap.appendChild(adminCanvas);
                var label = document.createElement('div');
                label.style.cssText = 'font-family:Bangers,cursive;font-size:11px;color:#fff;letter-spacing:1px;margin-top:4px;';
                label.textContent = 'CONTROLLER';
                wrap.appendChild(label);
                qrContainer.appendChild(wrap);
            }
        });
    } catch (err) {}
}

// ============================================
// Reset Game
// ============================================
function resetGame() {
    if (resetTimeoutId) {
        clearTimeout(resetTimeoutId);
        resetTimeoutId = null;
    }
    if (gameStateListener) {
        gameStateListener();
        gameStateListener = null;
    }
    clearIdleTimer();
    idleActive = false;
    dismissIdle();
    dismissIdleBetting();

    isConfirming = false;
    roundResults = [];
    currentRoundBets = [];
    currentRoundStatus = 'idle';
    gameState = {
        playerName: '',
        userChoice: null,
        confirmStep: 0
    };

    var nameInput = document.getElementById('player-name');
    if (nameInput) nameInput.value = '';
    document.querySelectorAll('.elevator-door').forEach(function(door) {
        door.classList.remove('selected');
    });

    showScreen('start-screen');
    console.log('Game reset');
}

// ============================================
// Idle Timer System
// ============================================
function resetIdleTimer() {
    if (!IDLE_TIMEOUT_ENABLED) return;
    clearIdleTimer();
    idleTimerId = setTimeout(function() { handleIdleTimeout(); }, IDLE_TIMEOUT);
}

function clearIdleTimer() {
    if (idleTimerId) { clearTimeout(idleTimerId); idleTimerId = null; }
    if (idleCountdownId) { clearInterval(idleCountdownId); idleCountdownId = null; }
    if (idleBettingCountdownId) { clearInterval(idleBettingCountdownId); idleBettingCountdownId = null; }
}

function isRankingPopupVisible() {
    var p = document.getElementById('ranking-popup');
    return p && p.classList.contains('active');
}

function handleIdleTimeout() {
    if (isRankingPopupVisible()) return;
    var activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id === 'start-screen') return;
    if (activeScreen && activeScreen.id === 'waiting-screen') return;
    if (currentRoundStatus === 'betting' && currentRoundBets.length > 0) {
        showIdleBettingOverlay();
    } else {
        showIdleOverlay();
    }
}

// Original idle overlay: no active bets, countdown to reset
function showIdleOverlay() {
    idleActive = true;
    var activeScreen = document.querySelector('.screen.active');
    lastScreenBeforeIdle = activeScreen ? activeScreen.id : 'start-screen';
    idleCountdownValue = 5;
    var overlay = document.getElementById('idle-overlay');
    var countdownEl = document.getElementById('idle-countdown');
    if (!overlay || !countdownEl) return;
    countdownEl.textContent = idleCountdownValue;
    overlay.classList.add('active');
    if (typeof BGM !== 'undefined') BGM.startIdleFade();
    idleCountdownId = setInterval(function() {
        idleCountdownValue--;
        countdownEl.textContent = idleCountdownValue;
        if (idleCountdownValue <= 0) {
            clearInterval(idleCountdownId);
            idleCountdownId = null;
            overlay.classList.remove('active');
            idleActive = false;
            if (typeof BGM !== 'undefined') BGM.endIdleFade();
            resetGame();
        }
    }, 1000);
}

function dismissIdle() {
    if (!idleActive) {
        var overlay = document.getElementById('idle-overlay');
        if (overlay) overlay.classList.remove('active');
        return;
    }
    if (typeof BGM !== 'undefined') BGM.endIdleFade();
    clearIdleTimer();
    idleActive = false;
    var overlay = document.getElementById('idle-overlay');
    if (overlay) overlay.classList.remove('active');
    var targetScreen = lastScreenBeforeIdle || 'start-screen';
    showScreen(targetScreen);
    if (targetScreen === 'waiting-screen') updateWaitingCount();
    resetIdleTimer();
}

// Betting-active idle overlay: same as no-bets (bg + countdown), 5s then waiting
function showIdleBettingOverlay() {
    if (idleBettingCountdownId) { clearInterval(idleBettingCountdownId); idleBettingCountdownId = null; }
    var activeScreen = document.querySelector('.screen.active');
    lastScreenBeforeIdle = activeScreen ? activeScreen.id : 'start-screen';
    var overlay = document.getElementById('idle-betting-overlay');
    var countdownEl = document.getElementById('idle-betting-countdown');
    if (!overlay || !countdownEl) return;

    var count = 5;
    countdownEl.textContent = count;
    overlay.classList.add('active');
    if (typeof BGM !== 'undefined') BGM.startIdleFade();

    idleBettingCountdownId = setInterval(function() {
        count--;
        countdownEl.textContent = count;
        if (count <= 0) {
            clearInterval(idleBettingCountdownId);
            idleBettingCountdownId = null;
            overlay.classList.remove('active');
            if (typeof BGM !== 'undefined') BGM.endIdleFade();
            if (currentRoundBets.length > 0) {
                showScreen('waiting-screen');
                updateWaitingCount();
            } else {
                resetGame();
            }
        }
    }, 1000);
}

function dismissIdleBetting() {
    var overlay = document.getElementById('idle-betting-overlay');
    if (!overlay) return;
    if (idleBettingCountdownId) {
        clearInterval(idleBettingCountdownId);
        idleBettingCountdownId = null;
    }
    if (overlay.classList.contains('active')) {
        if (typeof BGM !== 'undefined') BGM.endIdleFade();
        overlay.classList.remove('active');
        var targetScreen = (currentRoundBets.length > 0) ? 'waiting-screen' : (lastScreenBeforeIdle || 'start-screen');
        showScreen(targetScreen);
        if (targetScreen === 'waiting-screen') updateWaitingCount();
        resetIdleTimer();
    }
}

document.addEventListener('click', function() {
    if (isRankingPopupVisible()) return;
    if (!idleActive) {
        var s = document.querySelector('.screen.active');
        if (s && IDLE_SCREENS.indexOf(s.id) !== -1) resetIdleTimer();
    }
});
document.addEventListener('touchstart', function() {
    if (isRankingPopupVisible()) return;
    if (!idleActive) {
        var s = document.querySelector('.screen.active');
        if (s && IDLE_SCREENS.indexOf(s.id) !== -1) resetIdleTimer();
    }
});

// ============================================
// Keyboard Support
// ============================================
document.addEventListener('keydown', function(e) {
    if (isRankingPopupVisible()) return;
    if (!idleActive) {
        var s = document.querySelector('.screen.active');
        if (s && IDLE_SCREENS.indexOf(s.id) !== -1) resetIdleTimer();
    }
    if (e.key === 'Enter') {
        var nameScreen = document.getElementById('name-screen');
        if (nameScreen && nameScreen.classList.contains('active')) submitName();
    }
});

// ============================================
// Page Load
// ============================================
window.addEventListener('load', function() {
    console.log('Elevator Bet Game loaded - Multi-player Firebase Edition');
    updateBGMForScreen('start-screen');
    resetIdleTimer();
    if (db) {
        startListeningForResults();
        db.collection('gameState').doc('current').get().then(function(doc) {
            if (doc.exists) {
                var data = doc.data();
                currentRoundBets = data.bets || [];
                currentRoundStatus = data.status || 'idle';
            }
        }).catch(function() {});
    }
    function unlockBGM() {
        var s = document.querySelector('.screen.active');
        if (s) updateBGMForScreen(s.id);
    }
    document.addEventListener('click', unlockBGM, { once: true });
    document.addEventListener('touchstart', unlockBGM, { once: true });
});
