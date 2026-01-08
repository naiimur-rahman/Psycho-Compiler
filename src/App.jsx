import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, MeshDistortMaterial, Float, Environment, TorusKnot, Icosahedron, Octahedron, Dodecahedron, Tetrahedron, Sphere } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Lock, Unlock, Eye, Send, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

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
        setFloatSpeed(2); 
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

const DecryptedText = ({ text, isDecrypting, progress }) => {
  const [displayText, setDisplayText] = useState('');
  const chars = '!@#$%^&*()_+~[]{}:;?><';

  useEffect(() => {
    if (!isDecrypting) {
      setDisplayText('');
      return;
    }

    const length = text.length;
    const revealedCount = Math.floor(progress * length);

    let result = '';
    for (let i = 0; i < length; i++) {
      if (i < revealedCount) {
        result += text[i];
      } else {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    setDisplayText(result);
  }, [text, isDecrypting, progress]);

  return (
    <motion.span
      className="font-mono text-cyan-300 glow-text"
      initial={{ opacity: 0 }}
      animate={{ opacity: isDecrypting ? 1 : 0 }}
    >
      {displayText}
    </motion.span>
  );
};

const UIOverlay = ({ onAddMessage, selectedMsg, onCloseSelected }) => {
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setInputFocused] = useState(false);
  const [isHolding, setHolding] = useState(false);
  const [decryptProgress, setDecryptProgress] = useState(0);
  const requestRef = useRef();
  const startTimeRef = useRef();
  const holdDuration = 500; 

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onAddMessage(inputText);
      setInputText('');
    }
  };

  const animate = (time) => {
    if (!startTimeRef.current) startTimeRef.current = time;
    const elapsed = time - startTimeRef.current;
    const progress = Math.min(elapsed / holdDuration, 1);

    setDecryptProgress(progress);

    if (progress < 1) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
       
    }
  };

  const handleHoldStart = () => {
    setHolding(true);
    setDecryptProgress(0);
    startTimeRef.current = null;
    requestRef.current = requestAnimationFrame(animate);
  };

  const handleHoldEnd = () => {
    setHolding(false);
    setDecryptProgress(0);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    onCloseSelected();
  };

  return (
    <>
      <div className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
           <h2 className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
             LUMINANCE
           </h2>
           <p className="text-xs text-white/50 tracking-widest uppercase">Visualizer Active</p>
        </div>
      </div>

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

      <AnimatePresence>
        {selectedMsg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl"
            onClick={(e) => {
              if (e.target === e.currentTarget) onCloseSelected();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-3xl bg-black/40 border border-white/10 rounded-3xl p-20 text-center select-none cursor-pointer shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden group"
              onPointerDown={handleHoldStart}
              onPointerUp={handleHoldEnd}
              onPointerLeave={handleHoldEnd}
              whileTap={{ scale: 0.98 }}
            >
              <div className={`absolute inset-0 rounded-3xl border-2 transition-colors duration-500 ${isHolding ? 'border-cyan-500/50' : 'border-white/5'}`} />

              {isHolding && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent animate-scan pointer-events-none" />
              )}

              <div className="relative z-10 flex flex-col items-center gap-10 min-h-[200px] justify-center">
                <div className="relative">
                   <Lock
                     size={48}
                     className={`text-white/40 transition-all duration-300 ${isHolding ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}
                   />
                   <Unlock
                     size={48}
                     className={`absolute top-0 left-0 text-cyan-400 transition-all duration-300 ${isHolding ? 'opacity-100 scale-110 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]' : 'opacity-0 scale-50'}`}
                   />
                </div>

                <div className="w-full relative h-20 flex items-center justify-center">
                  {isHolding && (
                     <p className="text-3xl md:text-5xl font-bold leading-relaxed tracking-wide break-words w-full">
                       <DecryptedText text={selectedMsg.text} isDecrypting={isHolding} progress={decryptProgress} />
                     </p>
                  )}
                </div>

                <motion.div
                  animate={{ opacity: isHolding ? 0 : 1, y: isHolding ? 20 : 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <p className="text-xs font-bold tracking-[0.3em] text-cyan-400/80 uppercase">
                    Hold to Decrypt
                  </p>
                  <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-cyan-500/50"
                      initial={{ width: "0%", x: "-100%" }}
                      animate={{ width: "30%", x: "400%" }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </motion.div>

                {isHolding && (
                   <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
                        style={{ width: `${decryptProgress * 100}%` }}
                      />
                   </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

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
          text="SECRETS IN LIGHT and ABSTRACT"
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
    ['Welcome to Luminance', 'SECRETS IN LIGHT and ABSTRACT', 'I am angry!', 'Calm waves...']
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
