# BGM Music Manager

## Audio Files (in this folder)
- `MAIN.wav` - Start screen (loop)
- `ALTERNATE.mp3` - Name + Elevator selection (loop)
- `REALLY.mp3` - Confirm screens (no loop)
- `SOUND BUTTON CLICK.mp3` - Transition + Thanks (loop)
- `WAITING.mp3` - Waiting screen (loop, when ≥1 player)

## Scene Mapping
| Scene | Screens | File | Loop |
|-------|---------|------|------|
| start | start-screen | MAIN.wav | yes |
| name-bet | name-screen, bet-screen | ALTERNATE.mp3 | yes |
| confirm | confirm1-4 | REALLY.mp3 | no |
| transition-thanks | transition-screen, thanks-screen | SOUND BUTTON CLICK.mp3 | yes |
| waiting | waiting-screen (when ≥1 player) | WAITING.mp3 | yes |

## Console API (in game window)
```javascript
BGM.play('start')           // Play scene
BGM.stop()                  // Stop current
BGM.playSfx('buttonClick')  // Button click
BGM.config.masterVolume = 0.7      // 0-1
BGM.config.idleVolumeTarget = 0.15 // Volume when idle overlay
BGM.config.idleFadeDuration = 800  // ms
BGM.setLoop('start', true)         // Loop on/off
BGM.setSceneFile('start', 'main')  // Change file per scene
BGM.getScenes()                    // List scenes
BGM.getAudioFiles()                // List files
BGM.saveConfig()                   // Persist to localStorage
```
