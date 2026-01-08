import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, MeshDistortMaterial, Text, Float, Environment } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Lock, Unlock, Eye, Send, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

// --- ENCODER LOGIC (w1, w5) ---
// Simulates generating visual data from text sentiment
const encodeToVisuals = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Sentiment Simulation (Mocking w1)
  const isAngry = /angry|hate|bad|mad|fire|red/.test(text.toLowerCase());
  const isCalm = /calm|peace|blue|water|cool|love/.test(text.toLowerCase());
  const isSecret = /secret|hidden|psst/.test(text.toLowerCase());

  let color = '#a855f7'; // Default Purple
  let distort = 0.3;
  let speed = 1.5;

  if (isAngry) {
    color = '#ef4444'; // Red
    distort = 0.8;
    speed = 4;
  } else if (isCalm) {
    color = '#3b82f6'; // Blue
    distort = 0.2;
    speed = 0.8;
  } else if (isSecret) {
    color = '#22c55e'; // Green (Matrix-like)
    distort = 0.6;
    speed = 2;
  } else {
    // Random variations based on hash
    const colors = ['#f472b6', '#c084fc', '#fbbf24', '#60a5fa'];
    color = colors[Math.abs(hash) % colors.length];
  }

  return { color, distort, speed, hash };
};

// --- 3D COMPONENTS (w10) ---

const MessageOrb = ({ id, position, encoded, text, onClick }) => {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
        // Subtle floating rotation
        meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.2;
        meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh
        ref={meshRef}
        position={position}
        onClick={(e) => {
          e.stopPropagation();
          onClick({ id, text, encoded });
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        scale={hovered ? 1.2 : 1}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color={encoded.color}
          distort={encoded.distort}
          speed={encoded.speed}
          roughness={0.2}
          metalness={0.8}
          envMapIntensity={1}
        />
      </mesh>
    </Float>
  );
};

const InfiniteScene = ({ messages, onOrbClick }) => {
  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="white" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a855f7" />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
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

      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
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

const DecoderOverlay = ({ message, onClose }) => {
  const [revealed, setRevealed] = useState(false);

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

        <p className="mt-4 text-xs text-white/40 uppercase tracking-widest">
            {revealed ? "Release to Hide" : "Hold to Decrypt"}
        </p>
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

  // Initial Seed
  useEffect(() => {
    const seeds = [
        "Welcome to CipherCanvas",
        "Secrets hide in plain sight",
        "I am angry!",
        "Calm waves..."
    ];
    seeds.forEach(txt => addMessage(txt, true));
  }, []);

  const addMessage = (text, randomPos = false) => {
    const encoded = encodeToVisuals(text);
    const pos = randomPos ?
        [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 5] :
        [0, 0, 5]; // New messages start front/center

    const newMessage = {
      id: uuidv4(),
      text,
      encoded,
      position: pos
    };

    setMessages(prev => [...prev, newMessage]);
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden relative font-sans selection:bg-purple-500/30">

      {/* Background Title */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none opacity-50">
        <h1 className="text-4xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-br from-white to-transparent">
            CipherCanvas
        </h1>
        <p className="text-sm tracking-widest text-purple-400">Speak Without Words</p>
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
            />
        )}
      </AnimatePresence>
    </div>
  );
}
