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

  const startPos = useRef(new THREE.Vector3(0, 0, 20));
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const progress = useRef(isNew ? 0 : 1);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (progress.current < 1) {
      progress.current += delta * 0.5;
      if (progress.current > 1) progress.current = 1;

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
    <Float speed={progress.current < 1 ? 0 : 2} rotationIntensity={1} floatIntensity={2}>
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

// --- MAIN APP ---

export default function App() {
  const [messages, setMessages] = useState([]);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    ['Welcome to CipherCanvas', 'Secrets hide in plain sight', 'I am angry!', 'Calm waves...']
      .forEach(txt => addMessage(txt, true, false));
  }, []);

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

  if (!identity) {
    return <div className="w-full h-screen bg-black text-white flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden relative">
      <InfiniteScene messages={messages} onOrbClick={setSelectedMsg} />
    </div>
  );
}
