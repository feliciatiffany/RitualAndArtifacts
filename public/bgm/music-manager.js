// ============================================
// BGM Music Manager - Configurable per scene
// ============================================
// Console API:
//   BGM.play('start'|'name-bet'|'confirm'|'transition-thanks'|'waiting')
//   BGM.stop()
//   BGM.playSfx('buttonClick')
//   BGM.config.masterVolume = 0.7
//   BGM.config.idleVolumeTarget = 0.15
//   BGM.config.idleFadeDuration = 800
//   BGM.setLoop('start', true)
//   BGM.setSceneFile('start', 'main')
//   BGM.saveConfig() / BGM.loadConfig()

(function(global) {
    'use strict';

    var BGM_BASE = 'bgm/';
    var STORAGE_KEY = 'elevator_bgm_config';
    var AUDIO_FILES = {
        'main': 'MAIN.wav',
        'alternate': 'ALTERNATE.mp3',
        'really': 'REALLY.mp3',
        'finishBet': 'SOUND FINISH BET.wav',
        'buttonClick': 'SOUND BUTTON CLICK.mp3',
        'waiting': 'WAITING.mp3'
    };

    var SCENE_CONFIG = {
        'start': { file: 'main', loop: true },
        'name-bet': { file: 'alternate', loop: true },
        'confirm': { file: 'really', loop: false },
        'transition': { file: 'buttonClick', loop: false },
        'waiting': { file: 'waiting', loop: true },
        'results': { file: 'finishBet', loop: false }
    };

    var audioPool = {};
    var currentScene = null;
    var currentAudio = null;
    var masterVolume = 0.7;
    var idleVolumeTarget = 0.15;
    var idleFadeDuration = 800;
    var idleFadeInterval = null;

    function getUrl(filename) {
        return BGM_BASE + encodeURIComponent(filename);
    }

    function createAudio(key) {
        var file = AUDIO_FILES[key];
        if (!file) return null;
        var a = new Audio(getUrl(file));
        a.preload = 'auto';
        audioPool[key] = a;
        return a;
    }

    function getAudio(key) {
        if (!audioPool[key]) createAudio(key);
        return audioPool[key];
    }

    function stopCurrent() {
        if (currentAudio) {
            try {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            } catch (e) {}
            currentAudio = null;
        }
        currentScene = null;
    }

    function playScene(sceneKey) {
        if (currentScene === sceneKey && currentAudio && !currentAudio.paused) return;
        var cfg = SCENE_CONFIG[sceneKey];
        if (!cfg) return;
        stopCurrent();
        var a = getAudio(cfg.file);
        if (!a) return;
        a.loop = cfg.loop !== false;
        a.volume = masterVolume;
        a.currentTime = 0;
        a.play().catch(function(e) { console.warn('BGM play failed:', e); });
        currentAudio = a;
        currentScene = sceneKey;
    }

    function playSfx(key) {
        var a = getAudio(key);
        if (!a) return;
        var clone = a.cloneNode();
        clone.volume = masterVolume;
        clone.play().catch(function() {});
    }

    function fadeToVolume(target, duration, callback) {
        if (!currentAudio) {
            if (callback) callback();
            return;
        }
        var startVol = currentAudio.volume;
        var startTime = Date.now();
        if (idleFadeInterval) clearInterval(idleFadeInterval);
        idleFadeInterval = setInterval(function() {
            var elapsed = Date.now() - startTime;
            var t = Math.min(1, elapsed / duration);
            currentAudio.volume = startVol + (target - startVol) * t;
            if (t >= 1) {
                clearInterval(idleFadeInterval);
                idleFadeInterval = null;
                if (callback) callback();
            }
        }, 30);
    }

    function startIdleFade() {
        fadeToVolume(idleVolumeTarget, idleFadeDuration);
    }

    function endIdleFade() {
        fadeToVolume(masterVolume, idleFadeDuration);
    }

    function loadConfig() {
        try {
            var s = localStorage.getItem(STORAGE_KEY);
            if (s) {
                var c = JSON.parse(s);
                if (c.masterVolume != null) masterVolume = Math.max(0, Math.min(1, c.masterVolume));
                if (c.idleVolumeTarget != null) idleVolumeTarget = Math.max(0, Math.min(1, c.idleVolumeTarget));
                if (c.idleFadeDuration != null) idleFadeDuration = Math.max(100, c.idleFadeDuration);
                if (c.sceneConfig && typeof c.sceneConfig === 'object') {
                    for (var k in c.sceneConfig) SCENE_CONFIG[k] = c.sceneConfig[k];
                }
            }
        } catch (e) {}
    }

    function saveConfig() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                masterVolume: masterVolume,
                idleVolumeTarget: idleVolumeTarget,
                idleFadeDuration: idleFadeDuration,
                sceneConfig: JSON.parse(JSON.stringify(SCENE_CONFIG))
            }));
        } catch (e) {}
    }

    loadConfig();

    var BGM = {
        config: {
            get sceneConfig() { return JSON.parse(JSON.stringify(SCENE_CONFIG)); },
            set sceneConfig(v) {
                if (typeof v === 'object') {
                    for (var k in v) SCENE_CONFIG[k] = v[k];
                    saveConfig();
                }
            },
            get masterVolume() { return masterVolume; },
            set masterVolume(v) {
                masterVolume = Math.max(0, Math.min(1, parseFloat(v) || 0.7));
                if (currentAudio) currentAudio.volume = masterVolume;
                saveConfig();
            },
            get idleVolumeTarget() { return idleVolumeTarget; },
            set idleVolumeTarget(v) {
                idleVolumeTarget = Math.max(0, Math.min(1, parseFloat(v) || 0.15));
                saveConfig();
            },
            get idleFadeDuration() { return idleFadeDuration; },
            set idleFadeDuration(v) {
                idleFadeDuration = Math.max(100, parseInt(v, 10) || 800);
                saveConfig();
            }
        },
        play: function(sceneKey) { playScene(sceneKey); },
        stop: stopCurrent,
        playSfx: function(key) { playSfx(key); },
        startIdleFade: startIdleFade,
        endIdleFade: endIdleFade,
        getCurrentScene: function() { return currentScene; },
        setLoop: function(sceneKey, loop) {
            if (SCENE_CONFIG[sceneKey]) {
                SCENE_CONFIG[sceneKey].loop = !!loop;
                saveConfig();
            }
        },
        setSceneFile: function(sceneKey, fileKey) {
            if (SCENE_CONFIG[sceneKey] && AUDIO_FILES[fileKey]) {
                SCENE_CONFIG[sceneKey].file = fileKey;
                saveConfig();
            }
        },
        getAudioFiles: function() { return Object.keys(AUDIO_FILES); },
        getScenes: function() { return Object.keys(SCENE_CONFIG); },
        saveConfig: saveConfig,
        loadConfig: loadConfig
    };

    global.BGM = BGM;
})(typeof window !== 'undefined' ? window : this);
