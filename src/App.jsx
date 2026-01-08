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
    if (!this.ctx) return;

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
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.playTone(1000 + Math.random() * 2000, 'square', 0.05, 0.02);
      }, i * 50);
    }
  }

  playResonate() {
    if (!this.ctx) return;
    const chord = [261.63, 329.63, 392.0, 523.25];
    chord.forEach((note, i) => {
      setTimeout(() => {
        this.playTone(note, 'sine', 2.0, 0.1);
      }, i * 100);
    });
  }
}

const soundEngine = new SoundEngine();

// --- ENCODER LOGIC ---
const encodeToVisuals = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }

  const isAngry = /angry|hate|bad|mad|fire|red|sharp|pain/.test(text.toLowerCase());
  const isCalm = /calm|peace|blue|water|cool|love|soft|smooth/.test(text.toLowerCase());
  const isSecret = /secret|hidden|psst|code|mystery|unknown/.test(text.toLowerCase());

  let color = '#a855f7';
  let distort = 0.3;
  let speed = 1.5;
  let shape = 'sphere';
  let pattern = { wireframe: false, roughness: 0.2, metalness: 0.8 };

  if (isAngry) {
    color = '#ef4444';
    distort = 0.8;
    speed = 4;
    shape = 'icosahedron';
    pattern = { wireframe: true, roughness: 0.1, metalness: 0.5 };
  } else if (isCalm) {
    color = '#3b82f6';
    distort = 0.2;
    speed = 0.8;
    shape = 'sphere';
    pattern = { wireframe: false, roughness: 0.0, metalness: 0.1 };
  } else if (isSecret) {
    color = '#22c55e';
    distort = 0.6;
    speed = 2;
    shape = 'torusKnot';
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

// --- 3D COMPONENTS ---

const MessageOrb = ({ id, position, encoded, text, onClick, resonating, isNew }) => {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);
  const glow = useRef(0);
  const [floatSpeed, setFloatSpeed] = useState(isNew ? 0 : 2);

  const startPos = useRef(new THREE.Vector3(0, 0, 20));
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const progress = useRef(isNew ? 0 : 1);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (progress.current < 1) {
      progress.current += delta * 0.5;
      if (progress.current >= 1) {
        progress.current = 1;
        setFloatSpeed(2); // Enable floating once arrived
      }

      meshRef.current.position.lerpVectors(startPos.current, targetPos, progress.current);
      meshRef.current.rotation.x += delta * 10;
      meshRef.current.rotation.y += delta * 10;
    } else {
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.2;
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
      meshRef.current.position.lerp(targetPos, 0.1);
    }

    if (resonating) {
      glow.current += delta * 5;
      const s = 1 + Math.sin(glow.current) * 0.2;
      meshRef.current.scale.set(s, s, s);
    } else {
      meshRef.current.scale.lerp(
        new THREE.Vector3(hovered ? 1.2 : 1, hovered ? 1.2 : 1, hovered ? 1.2 : 1),
        0.1
      );
    }
  });

  return (
    <Float speed={floatSpeed} rotationIntensity={1} floatIntensity={2}>
      <mesh
        ref={meshRef}
        position={isNew ? [0, 0, 20] : position}
        onClick={(e) => {
          e.stopPropagation();
          onClick({ id, text, encoded });
        }}
        onPointerOver={() => {
          setHover(true);
          soundEngine.playHover(encoded);
        }}
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

const InfiniteScene = ({ messages, onOrbClick }) => (
  <Canvas camera={{ position: [0, 0, 20], fov: 60 }}>
    <fog attach="fog" args={['#000000', 10, 50]} />
    <ambientLight intensity={0.5} />
    <pointLight position={[10, 10, 10]} intensity={1.5} />
    <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a855f7" />
    <Stars radius={150} depth={100} count={7000} factor={6} saturation={0} fade speed={0.5} />
    <Environment preset="night" />
    <group>
      {messages.map((msg) => (
        <MessageOrb key={msg.id} {...msg} onClick={onOrbClick} />
      ))}
    </group>
    <OrbitControls enableZoom minDistance={5} maxDistance={40} autoRotate autoRotateSpeed={0.3} enablePan />
  </Canvas>
);

// --- UI OVERLAY ---

const UIOverlay = ({ onAddMessage, selectedMsg, onCloseSelected }) => {
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setInputFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onAddMessage(inputText);
      setInputText('');
      soundEngine.playDecrypt();
    }
  };

  return (
    <>
      {/* Top Bar / Brand */}
      <div className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
           <h2 className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
             LUMINANCE
           </h2>
           <p className="text-xs text-white/50 tracking-widest uppercase">Visualizer Active</p>
        </div>
      </div>

      {/* Message Input - Bottom Center */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg z-10 px-4">
        <form onSubmit={handleSubmit} className="relative group">
          <div className={`absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-20 transition-opacity duration-500 ${isInputFocused ? 'opacity-50' : ''}`} />
          <div className="relative flex items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-2 transition-all duration-300 focus-within:border-white/30 focus-within:bg-black/60">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Type a secret to visualize..."
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30 px-4 py-2 font-light"
            />
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              type="submit"
              className="p-2 bg-white/10 rounded-xl hover:bg-white/20 text-purple-400 transition-colors"
            >
              <Send size={20} />
            </motion.button>
          </div>
        </form>
      </div>

      {/* Selected Message Panel - Right Side */}
      <AnimatePresence>
        {selectedMsg && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="absolute top-0 right-0 h-full w-full md:w-96 bg-black/60 backdrop-blur-2xl border-l border-white/10 z-20 p-8 flex flex-col shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-mono text-white/70 uppercase tracking-widest">Decrypted Data</h3>
              <button
                onClick={onCloseSelected}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <p className="text-2xl font-light leading-relaxed relative z-10">"{selectedMsg.text}"</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-white/40 uppercase block mb-1">Resonance</span>
                  <span className="text-lg font-mono text-purple-300">{(selectedMsg.encoded.hash % 1000).toString().padStart(4, '0')}Hz</span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                   <span className="text-xs text-white/40 uppercase block mb-1">Stability</span>
                   <div className="flex items-center gap-2">
                     <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500" style={{ width: `${(1 - selectedMsg.encoded.distort) * 100}%` }} />
                     </div>
                   </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-white/40 uppercase">Visual Signature</p>
                <div className="flex items-center gap-2 text-sm text-white/60 font-mono">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedMsg.encoded.color }} />
                  {selectedMsg.encoded.color} / {selectedMsg.encoded.shape}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/10">
              <button
                onClick={() => {
                    soundEngine.playResonate();
                }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all uppercase tracking-widest text-sm font-medium flex items-center justify-center gap-2 group"
              >
                <RotateCcw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                Resonate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// --- LANDING PAGE ---

const TypewriterText = ({ text, delay = 0, className }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let timeout;
    if (displayedText.length < text.length) {
      timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, 100);
    }
    return () => clearTimeout(timeout);
  }, [displayedText, text]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className={className}
    >
      {displayedText}
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
      >|</motion.span>
    </motion.div>
  );
};

const LandingPage = ({ onEnter }) => {
  return (
    <div className="w-full h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
       {/* Background Elements */}
       <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[100px]" />
       </div>

      <div className="z-10 flex flex-col items-center space-y-8 text-center p-8">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-6xl md:text-8xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50"
        >
          Luminance
        </motion.h1>

        <TypewriterText
          text="Secrets in Light and sound"
          delay={1}
          className="text-xl md:text-2xl text-blue-200 font-light tracking-widest uppercase"
        />

        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.5, duration: 0.5 }}
        >
          <motion.button
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.5)",
              backgroundColor: "rgba(255, 255, 255, 0.1)"
            }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
                soundEngine.init();
                onEnter();
            }}
            className="px-8 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-white font-medium tracking-wide transition-all group relative overflow-hidden"
          >
            <span className="relative z-10">Enter Luminance</span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [messages, setMessages] = useState([]);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [identity, setIdentity] = useState(null);

  const addMessage = (text, randomPos = false, isNew = true) => {
    const encoded = encodeToVisuals(text);
    const pos = randomPos
      ? [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30]
      : [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10];

    setMessages(prev => [...prev, {
      id: uuidv4(),
      text,
      encoded,
      position: pos,
      resonating: false,
      isNew
    }]);
  };

  useEffect(() => {
    ['Welcome to Luminance', 'Secrets in Light and sound', 'I am angry!', 'Calm waves...']
      .forEach(txt => addMessage(txt, true, false));
  }, []);

  if (!identity) {
    return <LandingPage onEnter={() => setIdentity(true)} />;
  }

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden relative">
      <UIOverlay
        onAddMessage={addMessage}
        selectedMsg={selectedMsg}
        onCloseSelected={() => setSelectedMsg(null)}
      />
      <InfiniteScene messages={messages} onOrbClick={setSelectedMsg} />
    </div>
  );
}
