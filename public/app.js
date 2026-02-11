// ============================================
// Firebase 配置 - 请替换为你的实际配置
// ============================================
const firebaseConfig = {
    apiKey: "你的API KEY",
    authDomain: "elevator-game-8a4bb.firebaseapp.com",
    projectId: "elevator-game-8a4bb",
    storageBucket: "elevator-game-8a4bb.firebasestorage.app",
    messagingSenderId: "你的SENDER ID",
    appId: "你的APP ID"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================
// 游戏状态
// ============================================
let gameState = {
    userChoice: null,
    actualElevator: null,
    result: null
};

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
    console.log('Bet confirmed with response:', responseType);
    
    // 随机选择实际到达的电梯 (1-4)
    gameState.actualElevator = Math.floor(Math.random() * 4) + 1;
    gameState.result = gameState.userChoice === gameState.actualElevator ? 'win' : 'lose';
    
    console.log('User choice:', gameState.userChoice);
    console.log('Actual elevator:', gameState.actualElevator);
    console.log('Result:', gameState.result);
    
    // 保存到 Firebase
    saveBetToFirebase();
    
    // 显示结果
    showResult();
}

// ============================================
// 结果显示
// ============================================
function showResult() {
    const messageEl = document.getElementById('result-message');
    const detailEl = document.getElementById('result-detail');
    
    if (gameState.result === 'win') {
        messageEl.textContent = '🎉 YOU WIN! 🎉';
        messageEl.className = 'win';
    } else {
        messageEl.textContent = 'Maybe Next Time!';
        messageEl.className = 'lose';
    }
    
    detailEl.textContent = `You chose: E${gameState.userChoice} | Arrived: E${gameState.actualElevator}`;
    
    // 生成 QR 码
    generateQRCode();
    
    showScreen('result-screen');
    
    // 更新统计
    updateStats();
    
    // 5秒后返回开始界面
    setTimeout(() => {
        resetGame();
    }, 5000);
}

// ============================================
// Firebase 操作
// ============================================
async function saveBetToFirebase() {
    try {
        const docRef = await db.collection('bets').add({
            userChoice: gameState.userChoice,
            actualElevator: gameState.actualElevator,
            result: gameState.result,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('Bet saved successfully with ID:', docRef.id);
    } catch (error) {
        console.error('Error saving bet:', error);
    }
}

async function updateStats() {
    try {
        const snapshot = await db.collection('bets').get();
        const totalBets = snapshot.size;
        let wins = 0;
        
        snapshot.forEach(doc => {
            if (doc.data().result === 'win') {
                wins++;
            }
        });
        
        const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : 0;
        
        document.getElementById('total-bets').textContent = totalBets;
        document.getElementById('win-rate').textContent = winRate;
        
        console.log('Stats updated - Total:', totalBets, 'Win Rate:', winRate + '%');
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// ============================================
// QR 码生成
// ============================================
function generateQRCode() {
    const qrContainer = document.getElementById('qr-code');
    qrContainer.innerHTML = '';
    
    // 生成指向统计页面的 QR 码
    const statsUrl = window.location.origin + '/stats.html';
    
    QRCode.toCanvas(statsUrl, {
        width: 200,
        margin: 2,
        color: {
            dark: '#66c2a4',
            light: '#ffffff'
        }
    }, (error, canvas) => {
        if (error) {
            console.error('QR Code generation error:', error);
        } else {
            qrContainer.appendChild(canvas);
            console.log('QR Code generated for:', statsUrl);
        }
    });
}

// ============================================
// 重置游戏
// ============================================
function resetGame() {
    console.log('Game reset');
    gameState = {
        userChoice: null,
        actualElevator: null,
        result: null
    };
    showScreen('start-screen');
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
