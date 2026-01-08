import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, MeshDistortMaterial, Float, Environment, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing'; // NEW: For the neon glow
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, X, Send } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

// --- AUDIO ENGINE (Unchanged, functionally sound) ---
class SoundEngine {
  constructor() {
    this.ctx = null;
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
    if (!this.ctx) return;
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
    if (!this.ctx) return;
    const isAngry = encoded.color === '#ef4444';
    const isCalm = encoded.color === '#3b82f6';
    const isSecret = encoded.color === '#22c55e';
    let freq = 440, type = 'sine';
    if (isAngry) { freq = 150; type = 'sawtooth'; }
    else if (isCalm) { freq = 600; type = 'sine'; }
    else if (isSecret) { freq = 800; type = 'square'; }
    else { freq = 300 + (encoded.hash % 500); }
    this.playTone(freq, type, 0.3, 0.05);
  }

  playDecrypt() {
    if (!this.ctx) return;
    for(let i=0; i<10; i++) {
        setTimeout(() => this.playTone(1000 + Math.random() * 2000, 'square', 0.05, 0.02), i * 50);
    }
  }

  playResonate() {
    if (!this.ctx) return;
    [261.63, 329.63, 392.00, 523.25].forEach((note, i) => {
        setTimeout(() => this.playTone(note, 'sine', 2.0, 0.1), i * 100);
    });
  }
}

const soundEngine = new SoundEngine();

// --- ENCODER LOGIC (Unchanged) ---
const encodeToVisuals = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const isAngry = /angry|hate|bad|mad|fire|red|sharp|pain/.test(text.toLowerCase());
  const isCalm = /calm|peace|blue|water|cool|love|soft|smooth/.test(text.toLowerCase());
  const isSecret = /secret|hidden|psst|code|mystery|unknown/.test(text.toLowerCase());

  let color = '#a855f7', distort = 0.3, speed = 1.5, shape = 'sphere';
  let pattern = { wireframe: false, roughness: 0.2, metalness: 0.8 };

  if (isAngry) {
    color = '#ef4444'; distort = 0.8; speed = 4; shape = 'icosahedron';
    pattern = { wireframe: true, roughness: 0.1, metalness: 0.5 };
  } else if (isCalm) {
    color = '#3b82f6'; distort = 0.2; speed = 0.8; shape = 'sphere';
    pattern = { wireframe: false, roughness: 0.0, metalness: 0.1 };
  } else if (isSecret) {
    color = '#22c55e'; distort = 0.6; speed = 2; shape = 'torusKnot';
    pattern = { wireframe: true, roughness: 0.5, metalness: 0.9 };
  } else {
    const colors = ['#f472b6', '#c084fc', '#fbbf24', '#60a5fa'];
    color = colors[Math.abs(hash) % colors.length];
    const shapes = ['sphere', 'octahedron', 'dodecahedron', 'tetrahedron'];
    shape = shapes[Math.abs(hash) % shapes.length];
    pattern.wireframe = Math.abs(hash) % 3 === 0;
  }
  return { color, distort, speed, hash, shape, pattern };
};

// --- GEOMETRY CACHE (Optimization) ---
// creating geometries inside the component causes re-instantiation on every render.
const Geometries = {
    sphere: <sphereGeometry args={[1, 64, 64]} />,
    icosahedron: <icosahedronGeometry args={[1, 0]} />,
    tetrahedron: <tetrahedronGeometry args={[1, 0]} />,
    octahedron: <octahedronGeometry args={[1, 0]} />,
    dodecahedron: <dodecahedronGeometry args={[1, 0]} />,
    torusKnot: <torusKnotGeometry args={[0.6, 0.2, 100, 16]} />
};

// --- 3D COMPONENTS ---

const MessageOrb = ({ id, position, encoded, text, onClick, resonating, isNew }) => {
  const groupRef = useRef(); // Moves the whole system (travel animation)
  const meshRef = useRef();  // Handles local rotation and scale (resonance)
  const [hovered, setHover] = useState(false);
  
  // Animation State
  const startPos = useRef(new THREE.Vector3(0, 0, 30)); 
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const progress = useRef(isNew ? 0 : 1);

  useFrame((state, delta) => {
    // 1. GLOBAL POSITIONING (Travel Logic)
    if (groupRef.current) {
        if (progress.current < 1) {
            progress.current += delta * 0.8; // Slightly faster travel
            if (progress.current > 1) progress.current = 1;
            
            // Cubic ease-out
            const t = progress.current;
            const ease = 1 - Math.pow(1 - t, 3);
            
            groupRef.current.position.lerpVectors(startPos.current, targetPos, ease);
        } else {
             // Ensure exact placement
             groupRef.current.position.lerp(targetPos, 0.1);
        }
    }

    // 2. MESH EFFECTS (Resonance & Hover)
    if (meshRef.current) {
        // Continuous rotation
        meshRef.current.rotation.x += delta * 0.2;
        meshRef.current.rotation.y += delta * 0.3;

        // Scale Logic
        let targetScale = hovered ? 1.4 : 1;
        if (resonating) {
            const pulse = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.3;
            targetScale = pulse * 1.5;
        }
        
        meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  const handlePointerOver = () => {
    setHover(true);
    soundEngine.playHover(encoded);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
      setHover(false);
      document.body.style.cursor = 'auto';
  }

  return (
    // FIX: Group handles the "Travel" position. Float handles the "Idle" motion.
    <group ref={groupRef} position={isNew ? [0,0,30] : position}>
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1} floatingRange={[-0.5, 0.5]}>
            <mesh
                ref={meshRef}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick({ id, text, encoded });
                }}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
            >
                {Geometries[encoded.shape] || Geometries.sphere}

                <MeshDistortMaterial
                    color={resonating ? '#ffffff' : encoded.color}
                    distort={encoded.distort}
                    speed={encoded.speed}
                    roughness={encoded.pattern.roughness}
                    metalness={encoded.pattern.metalness}
                    wireframe={encoded.pattern.wireframe}
                    // Increased toneMapped to false allows colors to exceed 1.0 for Bloom
                    toneMapped={false}
                    emissive={encoded.color}
                    emissiveIntensity={resonating ? 4 : (hovered ? 0.8 : 0.2)} 
                />
            </mesh>
        </Float>
    </group>
  );
};

const InfiniteScene = ({ messages, onOrbClick }) => {
  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 60 }} gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping }}>
      <fog attach="fog" args={['#000000', 10, 60]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      {/* Background */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Environment preset="city" />

      {/* Messages */}
      <group>
        {messages.map((msg) => (
          <MessageOrb key={msg.id} {...msg} onClick={onOrbClick} />
        ))}
      </group>

      {/* NEW: Post Processing for Sci-Fi Glow */}
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.6} />
      </EffectComposer>

      <OrbitControls enableZoom={true} minDistance={5} maxDistance={40} autoRotate autoRotateSpeed={0.5} enablePan={false} />
    </Canvas>
  );
};

// --- UI COMPONENTS (Optimized) ---

const GlassOverlay = ({ children, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.95 }}
    className={`bg-black/40 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl ${className}`}
  >
    {children}
  </motion.div>
);

const SplashScreen = ({ onComplete }) => {
    const [generating, setGenerating] = useState(false);

    const handleGenerate = () => {
        setGenerating(true);
        soundEngine.init(); 
        soundEngine.playDecrypt();
        setTimeout(() => {
            const identity = encodeToVisuals("USER_" + Math.random());
            onComplete(identity);
        }, 2500);
    };

    return (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
             <AnimatePresence mode="wait">
                {!generating ? (
                    <motion.div
                        key="intro"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center"
                    >
                        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-purple-900 mb-6 tracking-tighter">
                            CIPHER
                        </h1>
                        <p className="text-purple-300/60 mb-12 text-sm font-mono tracking-[0.3em] uppercase">
                            Digital Sentiment Visualizer
                        </p>
                        <button
                            onClick={handleGenerate}
                            className="px-10 py-4 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300"
                        >
                            <span className="text-white font-mono uppercase tracking-widest text-sm">
                                Initialize System
                            </span>
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="loading"
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         className="flex flex-col items-center"
                    >
                        <div className="w-16 h-16 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-8" />
                        <p className="text-xs text-purple-500/80 font-mono animate-pulse tracking-widest">DECRYPTING IDENTITY...</p>
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
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
          <GlassOverlay className="max-w-md w-full text-center relative overflow-hidden">
            <button onClick={onClose} className="absolute top-6 right-6 text-white/30 hover:text-white transition-colors">
              <X size={20} />
            </button>

            <motion.div
                animate={{ scale: revealed ? 1 : 0.9, filter: revealed ? 'blur(0px)' : 'blur(0px)' }}
                className="mb-8 flex justify-center relative"
            >
                 <div
                    className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500`}
                    style={{ 
                        backgroundColor: message.encoded.color,
                        boxShadow: revealed ? `0 0 60px ${message.encoded.color}80` : 'none'
                    }}
                 >
                    {revealed ? <Unlock size={40} className="text-black/50" /> : <Lock size={40} className="text-black/50" />}
                 </div>
            </motion.div>

            <div
                className="bg-black/50 border border-white/5 p-6 rounded-xl min-h-[120px] flex items-center justify-center cursor-pointer select-none active:scale-[0.98] transition-all hover:border-white/20"
                onPointerDown={() => setRevealed(true)}
                onPointerUp={() => setRevealed(false)}
                onPointerLeave={() => setRevealed(false)}
                onTouchStart={() => setRevealed(true)}
                onTouchEnd={() => setRevealed(false)}
            >
               <p className={`text-xl font-mono transition-all duration-200 ${revealed ? 'text-white' : 'text-green-500/50 blur-[4px]'}`}>
                 {revealed ? message.text : message.encoded.hash.toString(16).substring(0, 20)}
               </p>
            </div>

            <p className="mt-4 text-[10px] text-white/30 uppercase tracking-widest mb-8">
                {revealed ? "System Decrypted" : "Hold to Decrypt"}
            </p>

            {revealed && (
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    disabled={hasResonated}
                    onClick={handleResonate}
                    className={`w-full py-4 rounded-xl font-bold tracking-widest uppercase text-sm transition-all
                       ${hasResonated
                           ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                           : 'bg-white text-black hover:bg-gray-200'}`}
                >
                    {hasResonated ? "Signal Synced" : "Resonate"}
                </motion.button>
            )}
          </GlassOverlay>
      </div>
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
        <form onSubmit={handleSubmit} className="absolute bottom-10 left-0 right-0 flex justify-center px-4 z-40 pointer-events-none">
            <div className="pointer-events-auto flex w-full max-w-lg bg-black/60 backdrop-blur-xl border border-white/10 rounded-full p-2 shadow-2xl hover:border-purple-500/50 focus-within:border-purple-500 transition-all duration-300">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Broadcast your frequency..."
                    className="flex-1 bg-transparent border-none outline-none text-white px-6 placeholder-white/20 font-mono text-sm"
                />
                <button
                    type="submit"
                    className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all duration-300 active:scale-90"
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

  useEffect(() => {
    const seeds = ["Welcome to CipherCanvas", "Secrets hide in plain sight", "I am angry!", "Calm waves..."];
    seeds.forEach(txt => addMessage(txt, true, false));
  }, []);

  const addMessage = (text, randomPos = false, isNew = true) => {
    const encoded = encodeToVisuals(text);
    const pos = randomPos ?
        [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30] :
        [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12];
    
    setMessages(prev => [...prev, { id: uuidv4(), text, encoded, position: pos, resonating: false, isNew }]);
  };

  const triggerResonance = (id) => {
      setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, resonating: true } : msg));
      setTimeout(() => {
          setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, resonating: false } : msg));
      }, 3000);
  };

  if (!identity) return <SplashScreen onComplete={setIdentity} />;

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden relative font-sans">
      {/* HUD Layers */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none select-none">
        <h1 className="text-2xl font-black tracking-tight uppercase text-white/80">CipherCanvas</h1>
        <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: identity.color }} />
            <span className="text-[10px] font-mono text-white/40 tracking-widest">SIGNAL: ONLINE</span>
        </div>
      </div>

      <div className="absolute inset-0 z-0">
         <InfiniteScene messages={messages} onOrbClick={setSelectedMsg} />
      </div>

      <ComposeBar onSend={addMessage} />

      <AnimatePresence>
        {selectedMsg && (
            <DecoderOverlay message={selectedMsg} onClose={() => setSelectedMsg(null)} onResonate={triggerResonance} />
        )}
      </AnimatePresence>
    </div>
  );
}
