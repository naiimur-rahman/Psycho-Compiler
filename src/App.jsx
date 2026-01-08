import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, MeshDistortMaterial, Float, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Lock, Unlock, Zap } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

// --- 1. PROCEDURAL GENERATION ENGINE ---

// A seedable random number generator based on text
const cyrb128 = (str) => {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 286986028);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    return [(h1^h2^h3^h4) >>> 0]; // Return positive integer
};

const generateSignature = (text) => {
    const seed = cyrb128(text)[0];
    
    // Map seed to visual parameters
    const hue = seed % 360; // Unique Color
    const saturation = 60 + (seed % 40); // 60-100%
    const lightness = 40 + (seed % 30);  // 40-70%
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    
    const shapes = ['sphere', 'icosahedron', 'octahedron', 'torusKnot', 'dodecahedron'];
    const shape = shapes[seed % shapes.length];
    
    // Physical properties
    const roughness = (seed % 10) / 10; 
    const metalness = ((seed % 20) / 20) + 0.2;
    const distort = ((seed % 50) / 100) + 0.1; // 0.1 to 0.6
    
    // Audio Frequency (Pentatonic Scale Mapping to sound musical)
    const baseFreq = 200 + (seed % 600);
    
    return { color, shape, roughness, metalness, distort, baseFreq, seed };
};

// --- 2. AUDIO ENGINE (Updated for Unique Sounds) ---
class SoundEngine {
  constructor() { this.ctx = null; }
  
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playTone(freq, type, duration, vol = 0.1) {
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

  playUnique(signature) {
    if (!this.ctx) this.init();
    // Use the signature's unique frequency
    const types = ['sine', 'triangle', 'sawtooth', 'square'];
    const type = types[signature.seed % types.length];
    this.playTone(signature.baseFreq, type, 0.4, 0.1);
    
    // Add a harmonic
    setTimeout(() => {
        this.playTone(signature.baseFreq * 1.5, 'sine', 0.6, 0.05);
    }, 100);
  }

  playAmbient() {
      if(!this.ctx) return;
      this.playTone(100, 'sine', 2, 0.02);
  }
}
const soundEngine = new SoundEngine();

// --- 3. SCRAMBLE TEXT EFFECT (Decoder) ---
const ScrambleText = ({ text, revealed }) => {
    const [display, setDisplay] = useState("");
    const chars = "!@#$%^&*()_+-=[]{}|;:,.<>?/~";
    
    useEffect(() => {
        let interval;
        if (revealed) {
            let iteration = 0;
            interval = setInterval(() => {
                setDisplay(text.split("").map((letter, index) => {
                    if (index < iteration) return text[index];
                    return chars[Math.floor(Math.random() * chars.length)];
                }).join(""));
                
                if (iteration >= text.length) clearInterval(interval);
                iteration += 1 / 3; // Speed of decoding
            }, 30);
        } else {
            // Hash view
            setDisplay(Array(Math.min(text.length, 20)).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join(""));
        }
        return () => clearInterval(interval);
    }, [revealed, text]);

    return <span className="font-mono">{display}</span>;
};

// --- 4. 3D SCENE & GEOMETRY CACHE ---

const Geometries = {
    sphere: <sphereGeometry args={[1, 64, 64]} />,
    icosahedron: <icosahedronGeometry args={[1, 0]} />,
    octahedron: <octahedronGeometry args={[1, 0]} />,
    dodecahedron: <dodecahedronGeometry args={[1, 0]} />,
    torusKnot: <torusKnotGeometry args={[0.6, 0.2, 100, 16]} />
};

const MessageOrb = ({ id, position, signature, text, onClick, isNew }) => {
    const groupRef = useRef();
    const meshRef = useRef();
    const [hovered, setHover] = useState(false);
    
    // Travel Animation
    const startPos = useRef(new THREE.Vector3(0, 0, 40));
    const targetPos = useMemo(() => new THREE.Vector3(...position), [position]);
    const progress = useRef(isNew ? 0 : 1);

    useFrame((state, delta) => {
        // 1. Travel Logic
        if (progress.current < 1) {
            progress.current += delta * 0.5;
            if (progress.current > 1) progress.current = 1;
            const ease = 1 - Math.pow(1 - progress.current, 3);
            groupRef.current.position.lerpVectors(startPos.current, targetPos, ease);
        }

        // 2. Rotation & Scale
        if (meshRef.current) {
            meshRef.current.rotation.x += delta * 0.2;
            meshRef.current.rotation.y += delta * 0.25;
            
            const targetScale = hovered ? 1.4 : 1;
            meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        }
    });

    const handlePointerOver = () => {
        setHover(true);
        soundEngine.playUnique(signature);
        document.body.style.cursor = 'pointer';
    };

    const handlePointerOut = () => {
        setHover(false);
        document.body.style.cursor = 'auto';
    };

    return (
        <group ref={groupRef} position={isNew ? [0,0,40] : position}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <mesh
                    ref={meshRef}
                    onClick={(e) => { e.stopPropagation(); onClick({ id, text, signature }); }}
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                >
                    {Geometries[signature.shape] || Geometries.sphere}
                    <MeshDistortMaterial
                        color={signature.color}
                        distort={signature.distort}
                        speed={2}
                        roughness={signature.roughness}
                        metalness={signature.metalness}
                        toneMapped={false} // Crucial for Bloom
                        emissive={signature.color}
                        emissiveIntensity={hovered ? 2 : 0.5}
                    />
                </mesh>
            </Float>
        </group>
    );
};

const InfiniteScene = ({ messages, onOrbClick }) => {
    return (
        <Canvas camera={{ position: [0, 0, 18], fov: 50 }} gl={{ antialias: false }}>
            <fog attach="fog" args={['#050505', 10, 50]} />
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <Environment preset="city" />

            <group>
                {messages.map((msg) => (
                    <MessageOrb key={msg.id} {...msg} onClick={onOrbClick} />
                ))}
            </group>

            <EffectComposer disableNormalPass>
                <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.7} />
                <Noise opacity={0.05} />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>

            <OrbitControls enableZoom={true} minDistance={5} maxDistance={30} autoRotate autoRotateSpeed={0.3} enablePan={false} />
        </Canvas>
    );
};

// --- 5. UI COMPONENTS ---

const Typewriter = ({ text, onComplete, delay = 0 }) => {
    const [displayedText, setDisplayedText] = useState("");
    const index = useRef(0);

    useEffect(() => {
        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                setDisplayedText((prev) => prev + text.charAt(index.current));
                index.current++;
                if (index.current === text.length) {
                    clearInterval(interval);
                    if (onComplete) onComplete();
                }
            }, 50); // Typing speed
            return () => clearInterval(interval);
        }, delay);
        return () => clearTimeout(timeout);
    }, [text, delay, onComplete]);

    return <span>{displayedText}</span>;
};

const IntroScreen = ({ onComplete }) => {
    const [showButton, setShowButton] = useState(false);
    const [exiting, setExiting] = useState(false);

    const handleEnter = () => {
        setExiting(true);
        soundEngine.init();
        soundEngine.playAmbient();
        setTimeout(onComplete, 1000);
    };

    return (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 overflow-hidden">
             <AnimatePresence>
                {!exiting && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                        className="flex flex-col items-center text-center max-w-2xl"
                    >
                        {/* Animated Logo */}
                        <motion.div 
                            animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="w-24 h-24 mb-10 rounded-full border border-white/10 relative"
                        >
                            <div className="absolute inset-0 border-t-2 border-white/80 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                            <div className="absolute inset-2 border-b-2 border-white/40 rounded-full rotate-45" />
                        </motion.div>

                        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tracking-tighter mb-6">
                            LUMINANCE
                        </h1>

                        <div className="h-6 mb-12 text-sm md:text-base font-mono text-gray-400 tracking-[0.3em] uppercase">
                            <Typewriter text="Echoes in the Digital Void" delay={500} onComplete={() => setShowButton(true)} />
                            <span className="animate-pulse">_</span>
                        </div>

                        {showButton && (
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={handleEnter}
                                className="group relative px-10 py-4 bg-transparent border border-white/20 overflow-hidden transition-all duration-300 hover:border-white/60 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                            >
                                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                                <span className="relative z-10 font-mono text-xs font-bold uppercase tracking-widest text-white group-hover:text-black transition-colors duration-300 flex items-center gap-2">
                                    Initialize <Zap size={14} className="group-hover:fill-black" />
                                </span>
                            </motion.button>
                        )}
                    </motion.div>
                )}
             </AnimatePresence>
        </div>
    );
};

const DecoderOverlay = ({ message, onClose }) => {
    const [revealed, setRevealed] = useState(false);

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-4" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-black/60 border border-white/10 p-8 rounded-none relative max-w-md w-full shadow-2xl backdrop-blur-xl"
                >
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors">
                        <X size={20} />
                    </button>

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                            style={{ backgroundColor: message.signature.color }}
                        >
                            {revealed ? <Unlock size={20} className="text-black/70" /> : <Lock size={20} className="text-black/70" />}
                        </div>
                        <div>
                            <h2 className="text-sm font-mono text-white/50 uppercase tracking-widest">Signal Source</h2>
                            <p className="text-xs text-white/30 font-mono">{message.id.substring(0,8)}</p>
                        </div>
                    </div>

                    {/* Message Area */}
                    <div 
                        className="min-h-[140px] flex items-center justify-center text-center p-4 border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors mb-6 select-none"
                        onPointerDown={() => setRevealed(true)}
                        onPointerUp={() => setRevealed(false)}
                        onPointerLeave={() => setRevealed(false)}
                        onTouchStart={() => setRevealed(true)}
                        onTouchEnd={() => setRevealed(false)}
                    >
                         <p className={`text-xl md:text-2xl font-light leading-relaxed transition-all duration-300 ${revealed ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'text-gray-600'}`}>
                            <ScrambleText text={message.text} revealed={revealed} />
                         </p>
                    </div>

                    <div className="flex justify-between items-center border-t border-white/10 pt-4">
                        <span className="text-[10px] uppercase tracking-widest text-white/30 animate-pulse">
                            {revealed ? "Decryption Complete" : "Hold to Decrypt"}
                        </span>
                        <div className="flex gap-1">
                            <div className="w-1 h-1 bg-white/20 rounded-full" />
                            <div className="w-1 h-1 bg-white/20 rounded-full" />
                            <div className="w-1 h-1 bg-white/20 rounded-full" />
                        </div>
                    </div>

                </motion.div>
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
            <div className="pointer-events-auto flex w-full max-w-lg bg-black/80 backdrop-blur-xl border border-white/10 p-1 shadow-2xl hover:border-white/30 transition-all duration-300 group">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Broadcast to the void..."
                    className="flex-1 bg-transparent border-none outline-none text-white px-6 placeholder-white/20 font-mono text-sm"
                />
                <button
                    type="submit"
                    className="w-12 h-12 bg-white/5 flex items-center justify-center text-white/50 hover:bg-white hover:text-black transition-all duration-300"
                >
                    <Send size={16} />
                </button>
            </div>
        </form>
    );
};

// --- MAIN APPLICATION ---

export default function App() {
    const [started, setStarted] = useState(false);
    const [messages, setMessages] = useState([]);
    const [selectedMsg, setSelectedMsg] = useState(null);

    // Initial Seeds
    useEffect(() => {
        if (started && messages.length === 0) {
            ["Secrets lie within the noise", "Luminance online", "What do you see?"].forEach(t => addMessage(t, true, false));
        }
    }, [started]);

    const addMessage = (text, randomPos = false, isNew = true) => {
        const signature = generateSignature(text); // Generates UNIQUE look/sound
        
        const pos = randomPos ?
            [(Math.random() - 0.5) * 25, (Math.random() - 0.5) * 25, (Math.random() - 0.5) * 25] :
            [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8];
        
        setMessages(prev => [...prev, { id: uuidv4(), text, signature, position: pos, isNew }]);
    };

    return (
        <div className="w-full h-screen bg-black text-white overflow-hidden relative font-sans">
            
            {/* Intro Screen */}
            {!started && <IntroScreen onComplete={() => setStarted(true)} />}

            {/* Main Interface */}
            <div className={`transition-opacity duration-1000 ${started ? 'opacity-100' : 'opacity-0'}`}>
                {/* HUD */}
                <div className="absolute top-8 left-8 z-10 pointer-events-none select-none mix-blend-difference">
                    <h1 className="text-xl font-bold tracking-tight uppercase text-white">Luminance</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-white/60 tracking-widest">NETWORK: SECURE</span>
                    </div>
                </div>

                {/* 3D World */}
                <div className="absolute inset-0 z-0">
                    <InfiniteScene messages={messages} onOrbClick={setSelectedMsg} />
                </div>

                {/* Input */}
                <ComposeBar onSend={addMessage} />

                {/* Decoder Modal */}
                <AnimatePresence>
                    {selectedMsg && (
                        <DecoderOverlay message={selectedMsg} onClose={() => setSelectedMsg(null)} />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
