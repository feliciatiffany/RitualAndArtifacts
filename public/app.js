// ============================================
// Firebase 配置 - 请替换为你的实际配置
// 获取方式：Firebase Console -> 项目设置 -> 常规 -> 你的应用
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

// 初始化 Firebase（配置无效或 SDK 加载失败时游戏仍可离线运行）
let db = null;
try {
    const hasValidConfig = firebaseConfig.apiKey && 
        !firebaseConfig.apiKey.includes('你的') &&
        firebaseConfig.projectId;
    if (typeof firebase !== 'undefined' && hasValidConfig) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log('Firebase initialized');
    } else if (!hasValidConfig) {
        console.warn('Firebase config incomplete - running in offline mode');
    } else {
        console.warn('Firebase SDK not loaded - running in offline mode');
    }
} catch (e) {
    console.warn('Firebase init failed:', e.message, '- running in offline mode');
}

// ============================================
// 游戏状态
// ============================================
let gameState = {
    userChoice: null,
    actualElevator: null,
    result: null
};

// 防止重复点击确认按钮
let isConfirming = false;
let resetTimeoutId = null;

// localStorage 存储 key
const STORAGE_KEY = 'elevator_bet_history';

// ============================================
// 界面控制函数
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// ============================================
// 游戏流程函数
// ============================================
function startGame() {
    console.log('Game started');
    showScreen('bet-screen');
}

function selectElevator(elevatorNumber) {
    console.log('Selected elevator:', elevatorNumber);
    gameState.userChoice = elevatorNumber;
    document.getElementById('user-choice').textContent = elevatorNumber;
    showScreen('confirm-screen');
}

function confirmBet(responseType) {
    // 防止重复点击导致多次触发
    if (isConfirming) return;
    if (gameState.userChoice === null) {
        console.warn('No elevator selected');
        return;
    }

    isConfirming = true;
    console.log('Bet confirmed with response:', responseType);
    
    // 随机选择实际到达的电梯 (1-4)，确保均匀分布
    gameState.actualElevator = Math.floor(Math.random() * 4) + 1;
    gameState.result = gameState.userChoice === gameState.actualElevator ? 'win' : 'lose';
    
    console.log('User choice:', gameState.userChoice, '| Actual:', gameState.actualElevator, '| Result:', gameState.result);
    
    // 保存数据（Firebase 优先，失败时 fallback 到 localStorage）
    saveBet();
    
    // 显示结果
    showResult();
}

// ============================================
// 结果显示
// ============================================
function showResult() {
    const messageEl = document.getElementById('result-message');
    const detailEl = document.getElementById('result-detail');
    
    if (!messageEl || !detailEl) {
        console.error('Result screen elements not found');
        showScreen('start-screen');
        isConfirming = false;
        return;
    }
    
    if (gameState.result === 'win') {
        messageEl.textContent = '🎉 YOU WIN! 🎉';
        messageEl.className = 'win';
    } else {
        messageEl.textContent = 'Maybe Next Time!';
        messageEl.className = 'lose';
    }
    
    detailEl.textContent = `You chose: E${gameState.userChoice} | Arrived: E${gameState.actualElevator}`;
    
    // 先切换界面，确保用户立即看到结果
    showScreen('result-screen');
    
    // 再生成 QR 码和更新统计（异步，不阻塞界面）
    generateQRCode();
    updateStats();
    
    // 清除之前的定时器，避免重复调度
    if (resetTimeoutId) clearTimeout(resetTimeoutId);
    resetTimeoutId = setTimeout(() => {
        resetTimeoutId = null;
        resetGame();
    }, 5000);
}

// ============================================
// 数据存储 - Firebase + localStorage fallback
// ============================================

/** 从 localStorage 读取投注历史 */
function getLocalBets() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error reading localStorage:', e);
        return [];
    }
}

/** 保存单条投注到 localStorage */
function saveBetToLocalStorage(bet) {
    const bets = getLocalBets();
    bets.push({
        ...bet,
        timestamp: Date.now()
    });
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
        console.log('Bet saved to localStorage');
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

/** 保存投注：优先 Firebase，失败时 fallback 到 localStorage */
async function saveBet() {
    const betData = {
        userChoice: gameState.userChoice,
        actualElevator: gameState.actualElevator,
        result: gameState.result
    };

    if (db) {
        try {
            await db.collection('bets').add({
                ...betData,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Bet saved to Firebase');
            return;
        } catch (error) {
            console.warn('Firebase save failed, using localStorage:', error.message);
        }
    }
    
    saveBetToLocalStorage(betData);
}

/** 更新统计显示：Firebase 优先，失败时 fallback 到 localStorage */
async function updateStats() {
    let totalBets = 0;
    let wins = 0;
    let useFirebase = false;

    if (db) {
        try {
            const snapshot = await db.collection('bets').get();
            totalBets = snapshot.size;
            snapshot.forEach(doc => {
                if (doc.data().result === 'win') wins++;
            });
            useFirebase = true;
            console.log('Stats from Firebase - Total:', totalBets, 'Wins:', wins);
        } catch (error) {
            console.warn('Firebase stats failed, using localStorage:', error.message);
        }
    }

    if (!useFirebase) {
        const localBets = getLocalBets();
        totalBets = localBets.length;
        wins = localBets.filter(b => b.result === 'win').length;
        console.log('Stats from localStorage - Total:', totalBets, 'Wins:', wins);
    }

    const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : 0;
    
    const totalEl = document.getElementById('total-bets');
    const rateEl = document.getElementById('win-rate');
    if (totalEl) totalEl.textContent = totalBets;
    if (rateEl) rateEl.textContent = winRate;
}

// ============================================
// QR 码生成
// ============================================
function generateQRCode() {
    const qrContainer = document.getElementById('qr-code');
    if (!qrContainer) return;
    qrContainer.innerHTML = '';
    
    try {
        // QRCode.toCanvas 需要先传入 canvas 元素
        const canvas = document.createElement('canvas');
        const statsUrl = window.location.origin + '/stats.html';
        
        QRCode.toCanvas(canvas, statsUrl, {
            width: 200,
            margin: 2,
            color: {
                dark: '#66c2a4',
                light: '#ffffff'
            }
        }, (error) => {
            if (error) {
                console.error('QR Code generation error:', error);
            } else {
                qrContainer.appendChild(canvas);
                console.log('QR Code generated for:', statsUrl);
            }
        });
    } catch (err) {
        console.error('QR Code setup error:', err);
    }
}

// ============================================
// 重置游戏
// ============================================
function resetGame() {
    if (resetTimeoutId) {
        clearTimeout(resetTimeoutId);
        resetTimeoutId = null;
    }
    isConfirming = false;
    gameState = {
        userChoice: null,
        actualElevator: null,
        result: null
    };
    showScreen('start-screen');
    console.log('Game reset');
}

// ============================================
// 页面加载时初始化
// ============================================
window.addEventListener('load', () => {
    console.log('Page loaded');
    updateStats();
});

// 防止意外刷新
window.addEventListener('beforeunload', (e) => {
    if (gameState.userChoice !== null) {
        e.preventDefault();
        e.returnValue = '';
    }
});
