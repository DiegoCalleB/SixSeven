import { useState, useEffect, useRef } from 'react';
import { auth, db, signInWithGoogle, subscribeToAuth } from './lib/firebase';
import { generateId, handleFirestoreError, OperationType } from './lib/gameLogic';
import { GameData, GameAction } from './types';
import { useGameState } from './hooks/useGameState';
import { setDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { cn } from './lib/utils';
import { User, Copy, Users, Play, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';

const PATTERNS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];

const generateCard = () => {
    return {
        value: Math.floor(Math.random() * 10) + 1, // 1 to 10. To increase 6 and 7 chance, we can skew it.
        pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)]
    }
};

// Skewed probability to make 6 and 7 appear more often
const generateWeightedCard = () => {
    const isSixSeven = Math.random() > 0.5; // 50% chance of 6 or 7
    let val = 1;
    if (isSixSeven) {
        val = Math.random() > 0.5 ? 6 : 7;
    } else {
        val = Math.floor(Math.random() * 10) + 1;
    }
    return {
        value: val,
        pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
        id: Math.random().toString(36).substr(2, 9)
    }
}

export default function App() {
  const [init, setInit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  
  const { game, derivedState } = useGameState(gameId);

  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      if (user) {
         setUserId(user.uid);
         if (!playerName && user.displayName) {
             setPlayerName(user.displayName.split(' ')[0].toUpperCase());
         }
      } else {
         setUserId(null);
      }
      setInit(true);
    });
    return unsub;
  }, []);

  if (!init) return <div className="min-h-screen text-white flex items-center justify-center font-bold tracking-widest uppercase">LOADING SYSTEM...</div>;

  if (!userId) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center text-white space-y-12">
              <div className="text-center space-y-2">
                <h1 className="text-6xl md:text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 transform -skew-x-6 tracking-tighter">
                   SIX SEVEN
                </h1>
                <p className="text-xl md:text-2xl font-bold tracking-widest text-gray-400 uppercase">Chaos Royale</p>
              </div>
              <button 
                onClick={signInWithGoogle} 
                className="px-8 py-5 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-xl shadow-white/10"
              >
                  Authenticate to Enter
              </button>
          </div>
      )
  }

  const createGame = async () => {
      if (!playerName) return;
      try {
          const newId = generateId();
          await setDoc(doc(db, 'games', newId), {
              ownerId: userId,
              status: 'waiting',
              createdAt: serverTimestamp(),
              players: {
                  [userId!]: {
                      name: playerName,
                      joinedAt: serverTimestamp()
                  }
              }
          });
          setGameId(newId);
      } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'games');
      }
  };

  const joinGame = async (id: string) => {
      if (!playerName) return;
      try {
         await updateDoc(doc(db, 'games', id), {
            [`players.${userId}`]: {
                name: playerName,
                joinedAt: serverTimestamp()
            }
         });
         setGameId(id);
      } catch (err) {
         handleFirestoreError(err, OperationType.UPDATE, `games/${id}`);
      }
  };

  if (!gameId || !game) {
      return <HomeView playerName={playerName} setPlayerName={setPlayerName} onCreate={createGame} onJoin={joinGame} />
  }

  if (game.status === 'waiting') {
      return <LobbyView game={game} userId={userId!} onStart={() => updateDoc(doc(db, 'games', game.id), { status: 'playing' })} />
  }

  if (game.status === 'playing') {
      return <GameView game={game} derivedState={derivedState} userId={userId!} />
  }

  if (game.status === 'finished') {
      return <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
          <h1 className="text-4xl font-black text-white">GAME OVER</h1>
          <button onClick={() => setGameId(null)} className="px-6 py-3 bg-white text-black font-bold uppercase tracking-wider rounded-xl hover:bg-gray-200">Return to Menu</button>
      </div>
  }

  return null;
}

function HomeView({ playerName, setPlayerName, onCreate, onJoin }: any) {
    const [joinId, setJoinId] = useState('');
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-12">
            <div className="text-center space-y-2">
                <h1 className="text-6xl md:text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 transform -skew-x-6 tracking-tighter">
                   SIX SEVEN
                </h1>
                <p className="text-xl md:text-2xl font-bold tracking-widest text-gray-400">CHAOS ROYALE</p>
            </div>
            
            <div className="w-full max-w-sm space-y-6 bg-slate-800/50 p-8 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Alias</label>
                   <div className="relative">
                     <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                     <input 
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value.toUpperCase())}
                        maxLength={12}
                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-pink-500 transition-colors uppercase tracking-widest"
                        placeholder="ENTER NAME"
                     />
                   </div>
                </div>

                <div className="pt-4 space-y-4">
                    <button 
                       disabled={!playerName}
                       onClick={onCreate}
                       className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white uppercase tracking-widest shadow-lg shadow-pink-500/25 transition-all active:scale-95"
                    >
                       Host Game
                    </button>
                    
                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase tracking-widest">Or</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    <div className="flex space-x-2">
                        <input 
                            value={joinId}
                            onChange={e => setJoinId(e.target.value)}
                            className="flex-grow bg-slate-900 border-2 border-slate-700 rounded-xl py-4 px-4 text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors uppercase text-center tracking-widest"
                            placeholder="ROOM ID"
                        />
                        <button 
                            disabled={!playerName || !joinId}
                            onClick={() => onJoin(joinId)}
                            className="px-6 bg-white text-slate-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold uppercase tracking-widest transition-all active:scale-95"
                        >
                           Join
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function LobbyView({ game, userId, onStart }: any) {
    const isOwner = game.ownerId === userId;
    const players = Object.values(game.players || {}) as any[];

    return (
        <div className="min-h-screen flex flex-col items-center p-6 pt-24 space-y-8">
            <div className="text-center space-y-2">
                <p className="text-pink-500 font-bold tracking-widest uppercase">Room Code</p>
                <div className="flex items-center justify-center space-x-4 bg-slate-800 px-8 py-4 rounded-2xl border-2 border-slate-700">
                    <h2 className="text-4xl font-black tracking-widest">{game.id}</h2>
                    <button onClick={() => navigator.clipboard.writeText(game.id)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                        <Copy className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
            </div>

            <div className="w-full max-w-sm bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50">
                <div className="flex items-center space-x-3 mb-6">
                    <Users className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-gray-400 uppercase tracking-widest">Players ({players.length}/7)</h3>
                </div>
                <div className="space-y-3">
                    {players.map((p, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-900/50 px-4 py-3 rounded-xl border border-slate-700/50">
                            <span className="font-bold tracking-wider">{p.name}</span>
                            {p.name === game.players[game.ownerId]?.name && <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-1 rounded font-bold uppercase">Host</span>}
                        </div>
                    ))}
                </div>
            </div>

            {isOwner ? (
                <button 
                   onClick={onStart}
                   className="w-full max-w-sm py-5 bg-white text-black hover:bg-gray-200 rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                   <Play className="w-6 h-6" />
                   <span>Start Chaos</span>
                </button>
            ) : (
                <div className="animate-pulse text-gray-400 font-bold tracking-widest uppercase">Waiting for host...</div>
            )}
        </div>
    )
}

function GameView({ game, derivedState, userId }: any) {
    const { currentPile, scores, penalties } = derivedState;
    const [deck, setDeck] = useState(() => Array.from({length: 30}, generateWeightedCard));
    const [audioAllowed, setAudioAllowed] = useState(false);
    
    // Glitch logic
    const penaltyTimestamp = penalties[userId];
    const isGlitched = penaltyTimestamp && (Date.now() - penaltyTimestamp < 2500);

    // Audio Loop Engine
    useEffect(() => {
        if (!audioAllowed) return;
        let isLooping = true;
        const msg = new SpeechSynthesisUtterance("six... seven...");
        msg.rate = 1.2;
        msg.pitch = 0.8;
        msg.lang = 'en-US';

        const speakLoop = () => {
             if (!isLooping) return;
             window.speechSynthesis.speak(msg);
        };
        msg.onend = () => setTimeout(speakLoop, 100);
        speakLoop();

        return () => {
            isLooping = false;
            window.speechSynthesis.cancel();
        }
    }, [audioAllowed]);

    // Request audio on first interaction
    useEffect(() => {
        const handler = () => setAudioAllowed(true);
        window.addEventListener('click', handler, {once:true});
        window.addEventListener('touchstart', handler, {once:true});
        return () => {
            window.removeEventListener('click', handler);
            window.removeEventListener('touchstart', handler);
        }
    }, []);

    // Haptics & Visuals for glitch
    useEffect(() => {
        if (isGlitched) {
             if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
             // Visual shake is handled by CSS class on the wrapper
        }
    }, [isGlitched, penaltyTimestamp]);

    const handleThrow = async () => {
        if (isGlitched || deck.length === 0) return;
        const cardToThrow = deck[0];
        setDeck(prev => prev.slice(1));

        try {
            const actionId = generateId();
            await setDoc(doc(db, `games/${game.id}/actions`, actionId), {
                uid: userId,
                type: 'throw',
                cardValue: cardToThrow.value,
                pattern: cardToThrow.pattern,
                createdAt: serverTimestamp(),
                playerIds: Object.keys(game.players)
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleSmash = async () => {
        if (isGlitched) return;
        try {
            const actionId = generateId();
            await setDoc(doc(db, `games/${game.id}/actions`, actionId), {
                uid: userId,
                type: 'smash',
                createdAt: serverTimestamp(),
                playerIds: Object.keys(game.players)
            });
        } catch(err) {
             console.error(err);
        }
    };

    // Confetti effect on score change
    const myScore = scores[userId] || 0;
    const prevScore = useRef(myScore);
    useEffect(() => {
        if (myScore > prevScore.current) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        prevScore.current = myScore;
    }, [myScore]);

    return (
        <div className={cn("min-h-screen flex flex-col", isGlitched && "animate-shake bg-red-950")}>
            {/* Scoreboard Header */}
            <div className="flex justify-between items-start p-4 z-10 pointer-events-none">
                <div className="bg-black/50 p-3 rounded-xl backdrop-blur-md border border-white/10">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Your Score</p>
                    <p className="text-3xl font-black text-pink-500">{myScore}</p>
                </div>
                <div className="flex space-x-2">
                    {Object.entries(game.players).map(([id, p]: any) => {
                        if (id === userId) return null;
                        return (
                            <div key={id} className="bg-black/50 px-3 py-1 rounded-lg backdrop-blur-md border border-white/10">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate max-w-[60px]">{p.name}</p>
                                <p className="text-lg font-black text-white">{scores[id] || 0}</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {isGlitched && (
                <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                     <h1 className="text-8xl font-black text-red-500 opacity-80 uppercase tracking-tighter skew-x-6 mix-blend-screen animate-pulse">GLITCH</h1>
                </div>
            )}

            {/* Central Drop Zone */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center -z-10 opacity-20">
                    <div className="w-64 h-64 rounded-full border-4 border-dashed border-slate-600 animate-spin-slow"></div>
                </div>

                <div className="relative w-48 h-64">
                    <AnimatePresence>
                        {currentPile.slice(0, 3).map((action, idx) => {
                            // Calculate rotation based on ID to be deterministic but chaotic
                            const hash = action.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                            const rotation = (hash % 40) - 20;

                            return (
                                <motion.div
                                    key={action.id}
                                    initial={{ scale: 1.5, opacity: 0, y: 100, rotate: 0 }}
                                    animate={{ scale: 1, opacity: 1, y: 0, rotate: rotation }}
                                    exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                    className={cn(
                                        "absolute inset-0 rounded-2xl shadow-2xl flex items-center justify-center border-4 border-white/20",
                                        action.pattern,
                                        idx === 0 ? "z-30" : idx === 1 ? "z-20 scale-95 -translate-y-4" : "z-10 scale-90 -translate-y-8 opacity-50"
                                    )}
                                >
                                    <h2 className="text-8xl font-black text-white/90 mix-blend-overlay">{action.cardValue}</h2>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                    {currentPile.length === 0 && (
                        <div className="absolute inset-0 rounded-2xl border-4 border-dashed border-slate-700 flex items-center justify-center text-slate-600 font-bold uppercase tracking-widest text-center px-4">
                            Waiting for throws...
                        </div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="h-64 sm:h-80 relative flex items-center justify-center">
                 {/* Smash Button */}
                 <button 
                    onClick={handleSmash}
                    disabled={isGlitched}
                    className="absolute z-40 bg-red-600 hover:bg-red-500 rounded-full w-32 h-32 flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.5)] border-4 border-red-400 text-white font-black text-2xl tracking-widest active:scale-90 transition-transform active:bg-red-700 disabled:opacity-50 disabled:grayscale disabled:scale-100"
                 >
                    SMASH
                 </button>

                 {/* Deck / Throw Interaction */}
                 {deck.length > 0 ? (
                     <motion.div 
                        onPanEnd={(e, info) => {
                            if (info.velocity.y < -200 || info.offset.y < -50) {
                                handleThrow();
                            }
                        }}
                        className={cn(
                            "absolute bottom-4 z-50 w-32 h-48 rounded-2xl cursor-grab active:cursor-grabbing border-2 border-white/20 shadow-2xl flex items-center justify-center touch-none",
                            deck[0].pattern
                        )}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        whileTap={{ scale: 0.95 }}
                        whileDrag={{ 
                             scaleX: 0.8, // Squash 
                             scaleY: 1.2, // Stretch
                             opacity: 0.8 
                        }}
                    >
                         <div className="text-white text-center space-y-2 pointer-events-none">
                            <p className="text-xs uppercase font-bold tracking-widest opacity-70">Swipe Up</p>
                            <h2 className="text-6xl font-black mix-blend-overlay">{deck[0].value}</h2>
                         </div>
                         <div className="absolute -top-3 -right-3 bg-black text-white text-xs font-bold px-2 py-1 rounded-full border border-white/20">
                             {deck.length}
                         </div>
                     </motion.div>
                 ) : (
                     <div className="absolute bottom-8 text-gray-500 font-bold uppercase tracking-widest text-center">
                        Deck Emptied<br/><span className="text-xs opacity-50">Wait for next round</span>
                     </div>
                 )}
            </div>
            
            {/* Safe area padding for mobile browsers */}
            <div className="h-8"></div>
        </div>
    )
}
