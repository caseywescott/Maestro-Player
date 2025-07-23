# Maestro Player

A comprehensive example demonstrating how to use [Maestro](https://github.com/caseywescott/Maestro) for interactive music applications with React.

## 🎵 Features

- **Smart Transitions**: Intelligent musical transitions with context awareness
- **Layer Management**: Real-time audio layer control and fade effects
- **MIDI Analysis**: Comprehensive MIDI file analysis and visualization
- **Real-time Controls**: Tempo, transpose, reverb, and instrument switching
- **Adaptive Music**: Dynamic layer adjustments based on user actions

## 🚀 Quick Start

```bash
npm install
npm start
```

In another terminal:
```bash
cd public
python3 -m http.server 8080
```

Open http://localhost:8080 in your browser.

## 📚 What You'll Learn

- How to integrate Maestro with React using custom hooks
- Creating and managing musical cues from MIDI files
- Implementing smart transitions with context awareness
- Real-time audio layer management and control
- Building interactive music interfaces with TypeScript

## 🎯 Key Maestro Concepts

```typescript
// Cue creation from MIDI files
import { createCueFromMidi } from "maestro/dist/useImuse"
const cue = createCueFromMidi("my-cue", midiFile)

// Smart transitions with options
iMuse.transitionToCue(targetCue, {
  waitForBar: true,
  matchKey: true,
  matchTempo: true,
  fadeInDuration: 500,
  fadeOutDuration: 500
})

// Layer management
iMuse.fadeInLayer(channel, 1000)   // 1 second fade
iMuse.fadeOutLayer(channel, 500)   // 0.5 second fade

// Transport control
iMuse.play()
iMuse.pause()
iMuse.seek(0.5)  // Seek to 50%
```

## 🔧 Setup

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/caseywescott/Maestro-Player.git
   cd Maestro-Player
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   ```

4. **Serve static files**
   ```bash
   cd public
   python3 -m http.server 8080
   ```

5. **Open in browser**
   Navigate to http://localhost:8080

## 🎼 Adding SoundFonts

Due to GitHub's file size limits, SoundFont files are not included. To use the example:

1. **Download a SoundFont file** (e.g., from [Musical Artifacts](https://musical-artifacts.com/artifacts?tags=soundfont))
2. **Place it in `public/soundfonts/`** with the name `chiptune_soundfont_4.0.sf2`
3. **Update the URL** in `src/App.tsx` if you use a different filename

## 🤝 Contributing

We welcome contributions! To contribute:

1. **Fork this repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Submit a pull request**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **[Maestro](https://github.com/caseywescott/Maestro)** - The main Maestro library
- **[Documentation](https://github.com/caseywescott/Maestro)** - Maestro documentation
- **[Issues](https://github.com/caseywescott/Maestro/issues)** - Report bugs or request features

---

**Built with ❤️ using Maestro, React, and TypeScript**
