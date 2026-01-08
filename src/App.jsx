import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, MeshDistortMaterial, Text, Float, Environment, TorusKnot, Icosahedron, Octahedron, Dodecahedron, Tetrahedron, Sphere } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Lock, Unlock, Eye, Send, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

// --- AUDIO ENGINE (w1, w3) ---
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.osc = null;
    this.gain = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.5, vol = 0.1) {
    if (!this.ctx) this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playHover(encoded) {
    if (!this.ctx) return; // Wait for interaction

    // Map color/sentiment to frequency
    const isAngry = encoded.color === '#ef4444';
    const isCalm = encoded.color === '#3b82f6';
    const isSecret = encoded.color === '#22c55e';

    let freq = 440;
    let type = 'sine';

    if (isAngry) { freq = 150; type = 'sawtooth'; }
    else if (isCalm) { freq = 600; type = 'sine'; }
    else if (isSecret) { freq = 800; type = 'square'; }
    else { freq = 300 + (encoded.hash % 500); }

    this.playTone(freq, type, 0.3, 0.05);
  }

  playDecrypt() {
    if (!this.ctx) return;
    // Data stream effect
    for(let i=0; i<10; i++) {
        setTimeout(() => {
            this.playTone(1000 + Math.random() * 2000, 'square', 0.05, 0.02);
        }, i * 50);
    }
  }

  playResonate() {
    if (!this.ctx) return;
    // Harmonious chord
    const chord = [261.63, 329.63, 392.00, 523.25]; // C Major
    chord.forEach((note, i) => {
        setTimeout(() => {
            this.playTone(note, 'sine', 2.0, 0.1);
        }, i * 100);
    });
  }
}

const soundEngine = new SoundEngine();

// --- ENCODER LOGIC (w1, w4, w5) ---
// Simulates generating visual data from text sentiment
const encodeToVisuals = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Sentiment Simulation (Mocking w1)
  const isAngry = /angry|hate|bad|mad|fire|red|sharp|pain/.test(text.toLowerCase());
  const isCalm = /calm|peace|blue|water|cool|love|soft|smooth/.test(text.toLowerCase());
  const isSecret = /secret|hidden|psst|code|mystery|unknown/.test(text.toLowerCase());

  let color = '#a855f7'; // Default Purple
  let distort = 0.3;
  let speed = 1.5;
  let shape = 'sphere'; // Default
  let pattern = { wireframe: false, roughness: 0.2, metalness: 0.8 };

  if (isAngry) {
    color = '#ef4444'; // Red
    distort = 0.8;
    speed = 4;
    shape = 'icosahedron'; // Sharp edges
    pattern = { wireframe: true, roughness: 0.1, metalness: 0.5 }; // Jagged look
  } else if (isCalm) {
    color = '#3b82f6'; // Blue
    distort = 0.2;
    speed = 0.8;
    shape = 'sphere'; // Smooth
    pattern = { wireframe: false, roughness: 0.0, metalness: 0.1 }; // Glossy, glassy
  } else if (isSecret) {
    color = '#22c55e'; // Green (Matrix-like)
    distort = 0.6;
    speed = 2;
    shape = 'torusKnot'; // Complex
    pattern = { wireframe: true, roughness: 0.5, metalness: 0.9 }; // Techy
  } else {
    // Random variations based on hash
    const colors = ['#f472b6', '#c084fc', '#fbbf24', '#60a5fa'];
    color = colors[Math.abs(hash) % colors.length];

    const shapes = ['sphere', 'octahedron', 'dodecahedron', 'tetrahedron'];
    shape = shapes[Math.abs(hash) % shapes.length];

    pattern.wireframe = Math.abs(hash) % 3 === 0;
  }

  return { color, distort, speed, hash, shape, pattern };
};

// --- 3D COMPONENTS (w10) ---

const MessageOrb = ({ id, position, encoded, text, onClick, resonating, isNew }) => {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);
  const glow = useRef(0);

  // Transmission Animation (Theme 9)
  const startPos = useRef(new THREE.Vector3(0, 0, 20)); // Start from camera/void
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const progress = useRef(isNew ? 0 : 1);

  useFrame((state, delta) => {
    if (meshRef.current) {
        // Transmission Travel Logic
        if (progress.current < 1) {
            progress.current += delta * 0.5; // Travel speed
            if (progress.current > 1) progress.current = 1;

            // Lerp position
            meshRef.current.position.lerpVectors(startPos.current, targetPos, progress.current);

            // Spin wildly while traveling
            meshRef.current.rotation.x += delta * 10;
            meshRef.current.rotation.y += delta * 10;
        } else {
            // Idle Motion
            meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.2;
            meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;

            // Ensure final position
            meshRef.current.position.lerp(targetPos, 0.1);
        }

        // Resonance Logic
        if (resonating) {
           glow.current += delta * 5;
           const s = 1 + Math.sin(glow.current) * 0.2;
           meshRef.current.scale.set(s, s, s);
        } else {
           meshRef.current.scale.lerp(new THREE.Vector3(hovered ? 1.2 : 1, hovered ? 1.2 : 1, hovered ? 1.2 : 1), 0.1);
        }
    }
  });

  const handlePointerOver = () => {
    setHover(true);
    soundEngine.playHover(encoded);
  };

  return (
    <Float speed={progress.current < 1 ? 0 : 2} rotationIntensity={1} floatIntensity={2}>
      <mesh
        ref={meshRef}
        // Initial position handling is done in useFrame for 'isNew'
        position={isNew ? [0,0,20] : position}
        onClick={(e) => {
          e.stopPropagation();
          onClick({ id, text, encoded });
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={() => setHover(false)}
      >
        {encoded.shape === 'sphere' && <sphereGeometry args={[1, 64, 64]} />}
        {encoded.shape === 'icosahedron' && <icosahedronGeometry args={[1, 0]} />}
        {encoded.shape === 'tetrahedron' && <tetrahedronGeometry args={[1, 0]} />}
        {encoded.shape === 'octahedron' && <octahedronGeometry args={[1, 0]} />}
        {encoded.shape === 'dodecahedron' && <dodecahedronGeometry args={[1, 0]} />}
        {encoded.shape === 'torusKnot' && <torusKnotGeometry args={[0.6, 0.2, 100, 16]} />}

        <MeshDistortMaterial
          color={resonating ? '#ffffff' : encoded.color}
          distort={encoded.distort}
          speed={encoded.speed}
          roughness={encoded.pattern.roughness}
          metalness={encoded.pattern.metalness}
          wireframe={encoded.pattern.wireframe}
          emissive={resonating ? encoded.color : '#000000'}
          emissiveIntensity={resonating ? 2 : 0}
          envMapIntensity={1}
        />
      </mesh>
    </Float>
  );
};

const InfiniteScene = ({ messages, onOrbClick }) => {
  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 60 }}>
      <fog attach="fog" args={['#000000', 10, 50]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="white" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a855f7" />

      <Stars radius={150} depth={100} count={7000} factor={6} saturation={0} fade speed={0.5} />
      {/* Background Environment for reflections */}
      <Environment preset="night" />

      <group>
        {messages.map((msg) => (
          <MessageOrb
            key={msg.id}
            {...msg}
            onClick={onOrbClick}
          />
        ))}
      </group>

      <OrbitControls
        enableZoom={true}
        minDistance={5}
        maxDistance={40}
        autoRotate
        autoRotateSpeed={0.3}
        enablePan={true}
      />
    </Canvas>
  );
};

// --- UI COMPONENTS (Glassmorphism) ---

const GlassOverlay = ({ children, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className={`bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl ${className}`}
  >
    {children}
  </motion.div>
);

const SplashScreen = ({ onComplete }) => {
    const [generating, setGenerating] = useState(false);

    const handleGenerate = () => {
        setGenerating(true);
        soundEngine.init(); // Init audio context
        soundEngine.playDecrypt();
        setTimeout(() => {
            // Generate random identity params
            const identity = encodeToVisuals("USER_" + Math.random());
            onComplete(identity);
        }, 2000);
    };

    return (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
             <AnimatePresence>
                {!generating ? (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-center"
                    >
                        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-blue-600 mb-8 tracking-tighter">
                            CIPHER CANVAS
                        </h1>
                        <p className="text-white/50 mb-12 text-lg font-light tracking-widest uppercase">
                            What is your frequency?
                        </p>
                        <button
                            onClick={handleGenerate}
                            className="group relative px-8 py-4 bg-white/5 border border-white/20 rounded-full overflow-hidden hover:border-purple-500/50 transition-colors"
                        >
                            <div className="absolute inset-0 bg-purple-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                            <span className="relative z-10 text-white font-mono uppercase tracking-widest">
                                Establish Signal
                            </span>
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         className="flex flex-col items-center"
                    >
                        <div className="w-24 h-24 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-8" />
                        <p className="text-purple-400 font-mono animate-pulse">CALIBRATING VISUAL SIGNATURE...</p>
                    </motion.div>
                )}
             </AnimatePresence>
        </div>
    );
};

const DecoderOverlay = ({ message, onClose, onResonate }) => {
  const [revealed, setRevealed] = useState(false);
  const [hasResonated, setHasResonated] = useState(false);

  const handleResonate = () => {
    setHasResonated(true);
    soundEngine.playResonate();
    onResonate(message.id);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
      <GlassOverlay className="max-w-md w-full text-center relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
          <X size={24} />
        </button>

        <motion.div
            animate={{ scale: revealed ? 1 : 0.8, opacity: revealed ? 1 : 0.5 }}
            className="mb-8 flex justify-center"
        >
             <div
                className={`w-32 h-32 rounded-full flex items-center justify-center transition-colors duration-500 shadow-[0_0_50px_rgba(0,0,0,0.5)]`}
                style={{ backgroundColor: message.encoded.color }}
             >
                {revealed ? <Unlock size={48} /> : <Lock size={48} />}
             </div>
        </motion.div>

        <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          {revealed ? "Message Decoded" : "Encrypted Signal"}
        </h2>

        <div
            className="bg-black/40 p-4 rounded-lg min-h-[100px] flex items-center justify-center cursor-pointer select-none active:scale-95 transition-transform"
            onPointerDown={() => setRevealed(true)}
            onPointerUp={() => setRevealed(false)}
            onPointerLeave={() => setRevealed(false)}
            onTouchStart={() => setRevealed(true)}
            onTouchEnd={() => setRevealed(false)}
        >
           <p className={`text-lg font-mono transition-all duration-300 ${revealed ? 'text-white blur-none' : 'text-green-500/50 blur-sm'}`}>
             {revealed ? message.text : message.encoded.hash.toString(16).repeat(4).substring(0, message.text.length * 2)}
           </p>
        </div>

        <p className="mt-4 text-xs text-white/40 uppercase tracking-widest mb-6">
            {revealed ? "Release to Hide" : "Hold to Decrypt"}
        </p>

        {/* Theme 3: Connection/Resonance */}
        {revealed && (
            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                disabled={hasResonated}
                onClick={handleResonate}
                className={`w-full py-3 rounded-xl font-bold tracking-widest uppercase transition-all
                    ${hasResonated
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}`}
            >
                {hasResonated ? "Connection Established" : "Resonate Signal"}
            </motion.button>
        )}
      </GlassOverlay>
    </div>
  );
};

const ComposeBar = ({ onSend }) => {
    const [text, setText] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if(!text.trim()) return;
        onSend(text);
        setText("");
    };

    return (
        <form onSubmit={handleSubmit} className="absolute bottom-8 left-0 right-0 flex justify-center px-4 z-40">
            <div className="flex w-full max-w-lg bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-2 shadow-2xl hover:border-white/20 transition-colors">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a hidden message..."
                    className="flex-1 bg-transparent border-none outline-none text-white px-6 placeholder-white/30"
                />
                <button
                    type="submit"
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90"
                >
                    <Send size={18} />
                </button>
            </div>
        </form>
    );
};

// --- MAIN APP ---

export default function App() {
  const [messages, setMessages] = useState([]);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [identity, setIdentity] = useState(null);

  // Initial Seed
  useEffect(() => {
    const seeds = [
        "Welcome to CipherCanvas",
        "Secrets hide in plain sight",
        "I am angry!",
        "Calm waves..."
    ];
    seeds.forEach(txt => addMessage(txt, true, false)); // false = not new (instant)
  }, []);

  // Simulation: Random Resonance (Theme 3 - Others understanding you)
  useEffect(() => {
      const interval = setInterval(() => {
          if (messages.length > 0) {
              const randomIndex = Math.floor(Math.random() * messages.length);
              const id = messages[randomIndex].id;
              triggerResonance(id);
          }
      }, 8000); // Every 8 seconds someone "connects"
      return () => clearInterval(interval);
  }, [messages]);

  const addMessage = (text, randomPos = false, isNew = true) => {
    // If user has identity, bias the visuals towards it, but still encode text
    let encoded = encodeToVisuals(text);

    // Theme 2: Apply user identity color as a tint if available
    if (identity && !randomPos) {
       // Ideally we mix colors, but for simplicity let's just keep the encoded sentiment
       // to ensure the riddles (Angry=Red) still work visually.
    }

    const pos = randomPos ?
        [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30] :
        [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10];

    const newMessage = {
      id: uuidv4(),
      text,
      encoded,
      position: pos,
      resonating: false,
      isNew: isNew
    };

    setMessages(prev => [...prev, newMessage]);
  };

  const triggerResonance = (id) => {
      setMessages(prev => prev.map(msg =>
          msg.id === id ? { ...msg, resonating: true } : msg
      ));

      // Stop resonating after a while
      setTimeout(() => {
          setMessages(prev => prev.map(msg =>
              msg.id === id ? { ...msg, resonating: false } : msg
          ));
      }, 3000);
  };

  if (!identity) {
      return <SplashScreen onComplete={setIdentity} />;
  }

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden relative font-sans selection:bg-purple-500/30">

      {/* Background Title */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none opacity-50">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-br from-white to-transparent">
            CipherCanvas
        </h1>
        <p className="text-sm tracking-widest text-purple-400">Speak Without Words</p>

        {/* Identity Badge */}
        <div className="mt-4 flex items-center gap-2 opacity-50">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: identity.color }} />
            <span className="text-xs font-mono text-white/50">SIGNAL ACTIVE</span>
        </div>
      </div>

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
         <InfiniteScene messages={messages} onOrbClick={setSelectedMsg} />
      </div>

      {/* Interaction Layers */}
      <ComposeBar onSend={addMessage} />

      <AnimatePresence>
        {selectedMsg && (
            <DecoderOverlay
                message={selectedMsg}
                onClose={() => setSelectedMsg(null)}
                onResonate={triggerResonance}
            />
        )}
      </AnimatePresence>
    </div>
  );
}
