import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  CARD_COLORS,
  CardItem,
  PlayerSide,
  RoundState,
  createInitialRoundState,
  evaluateBoard,
  advanceTurnCard,
  resolvePlayerTap,
  finishTapResolution,
  getMatchStatusBanner,
} from './lib/sixSevenEngine';
import { sound } from './lib/soundEngine';

type ScreenMode = 'HOME' | 'KING_SETUP' | 'GAME';
type GameMode = 'duel' | 'king' | 'ai';
type AIDifficulty = 'novato' | 'competitivo' | 'maestro';

interface KingPlayerStats {
  name: string;
  wins: number;
  played: number;
  bestStreak: number;
}

interface FloatingBanner {
  id: number;
  title: string;
  subtitle: string;
  isValid: boolean;
  scoringName: string;
}

const COLOR_MAP: Record<string, { hex: string; textHex: string; name: string }> = {
  lime: { hex: '#ccff00', textHex: '#000000', name: 'VERDE' },
  magenta: { hex: '#ff00ff', textHex: '#ffffff', name: 'ROSA' },
  cyan: { hex: '#00ffff', textHex: '#000000', name: 'CIAN' },
  red: { hex: '#ff2200', textHex: '#ffffff', name: 'ROJO' },
};

export default function App() {
  const [screen, setScreen] = useState<ScreenMode>('HOME');
  const [mode, setMode] = useState<GameMode>('duel');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('competitivo');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // Nombres de los dos jugadores activos en pista (left = Jugador 1 / Arriba, right = Jugador 2 / Abajo o IA)
  const [leftName, setLeftName] = useState('JUGADOR 1');
  const [rightName, setRightName] = useState('JUGADOR 2');

  // Estado Rey de la Pista
  const [kingPlayers, setKingPlayers] = useState<string[]>(['ALEX', 'MARTA', 'DIEGO']);
  const [newPlayerInput, setNewPlayerInput] = useState('');
  const [kingStats, setKingStats] = useState<Record<string, KingPlayerStats>>({});
  const [kingIdx, setKingIdx] = useState<number>(0);
  const [challengerIdx, setChallengerIdx] = useState<number>(1);
  const [queueIndices, setQueueIndices] = useState<number[]>([2]);
  const [kingCurrentStreak, setKingCurrentStreak] = useState<number>(0);
  const [kingChampion, setKingChampion] = useState<string | null>(null);
  const [kingTargetCrowns, setKingTargetCrowns] = useState<number>(3);

  // Estado de la partida / ronda activa
  const [round, setRound] = useState<RoundState>(() => createInitialRoundState(3));
  const [countdown, setCountdown] = useState<number | null>(null);
  const [floatingFeedback, setFloatingFeedback] = useState<FloatingBanner | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Referencias para timers limpios y evitar condiciones de carrera
  const dealTimerRef = useRef<number | null>(null);
  const aiTimerRef = useRef<number | null>(null);
  const resolveTimerRef = useRef<number | null>(null);
  const roundRef = useRef<RoundState>(round);
  roundRef.current = round;

  const clearAllGameTimers = useCallback(() => {
    if (dealTimerRef.current !== null) {
      window.clearTimeout(dealTimerRef.current);
      dealTimerRef.current = null;
    }
    if (aiTimerRef.current !== null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    if (resolveTimerRef.current !== null) {
      window.clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearAllGameTimers();
  }, [clearAllGameTimers]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    sound.enabled = next;
  };

  // Inicia una ronda con cuenta atrás 3-2-1
  const beginRoundWithCountdown = useCallback(
    (pLeft: string, pRight: string, selectedMode: GameMode) => {
      clearAllGameTimers();
      setLeftName(pLeft);
      setRightName(pRight);
      setMode(selectedMode);
      setFloatingFeedback(null);
      setRound(createInitialRoundState(3));
      setScreen('GAME');
      setCountdown(3);
    },
    [clearAllGameTimers]
  );

  // Efecto para la cuenta atrás 3, 2, 1, ¡YA!
  useEffect(() => {
    if (screen !== 'GAME' || countdown === null) return;
    if (countdown > 0) {
      sound.playCardDeal();
      const t = window.setTimeout(() => {
        setCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 650);
      return () => window.clearTimeout(t);
    } else {
      // Arranca la partida
      setCountdown(null);
      setRound((prev) => advanceTurnCard({ ...prev, gameActive: true, isResolvingTap: false }));
    }
  }, [screen, countdown]);

  // Función de pulsación (Tap) de cualquier jugador o IA
  const handlePlayerTap = useCallback(
    (side: PlayerSide) => {
      const current = roundRef.current;
      if (countdown !== null || !current.gameActive || current.isResolvingTap) return;
      if (!current.leftCard && !current.rightCard) return;

      // Bloqueamos timers inmediatamente
      clearAllGameTimers();

      const result = resolvePlayerTap(current, side);
      if (!result.evaluation || !result.scoringSide) return;

      setRound(result.state);

      const tapperName = side === 'left' ? leftName : rightName;
      const scorerName = result.scoringSide === 'left' ? leftName : rightName;

      if (result.evaluation.valid) {
        sound.playHit(false);
        sound.speak('¡Six Seven!');
        setFloatingFeedback({
          id: Date.now(),
          title: result.evaluation.label,
          subtitle: `PUNTO PARA ${scorerName}`,
          isValid: true,
          scoringName: scorerName,
        });
      } else {
        sound.playFail(false);
        setScreenShake(true);
        window.setTimeout(() => setScreenShake(false), 420);

        if (result.evaluation.reason === 'trap_7_6') {
          sound.speak('¡Trampa siete seis!');
        } else {
          sound.speak('¡Fallo!');
        }

        setFloatingFeedback({
          id: Date.now(),
          title: `${result.evaluation.label}`,
          subtitle: `FALLO DE ${tapperName} · +1 PARA ${scorerName}`,
          isValid: false,
          scoringName: scorerName,
        });
      }

      // Comprobar si entramos en Muerte Súbita para aviso sonoro
      const bannerAfter = getMatchStatusBanner(
        result.state.scoreLeft,
        result.state.scoreRight,
        leftName,
        rightName,
        result.state.targetPoints
      );

      if (result.state.winner) {
        // ¡Fin del set / partida!
        sound.playVictory();
        confetti({
          particleCount: 110,
          spread: 80,
          origin: { y: 0.55 },
        });
        sound.speak(`¡Victoria para ${ scorerName }!`);

        // Si estamos en modo Rey de la Pista, actualizamos estadísticas del torneo
        if (mode === 'king') {
          const winnerIsLeft = result.state.winner === 'left';
          const winningPlayerName = winnerIsLeft ? leftName : rightName;
          const losingPlayerName = winnerIsLeft ? rightName : leftName;

          setKingStats((prev) => {
            const copy = { ...prev };
            const wStat = copy[winningPlayerName] || {
              name: winningPlayerName,
              wins: 0,
              played: 0,
              bestStreak: 0,
            };
            const lStat = copy[losingPlayerName] || {
              name: losingPlayerName,
              wins: 0,
              played: 0,
              bestStreak: 0,
            };
            const nextWins = wStat.wins + 1;
            const nextStreak = winnerIsLeft ? kingCurrentStreak + 1 : 1;

            copy[winningPlayerName] = {
              ...wStat,
              wins: nextWins,
              played: wStat.played + 1,
              bestStreak: Math.max(wStat.bestStreak, nextStreak),
            };
            copy[losingPlayerName] = {
              ...lStat,
              played: lStat.played + 1,
            };

            if (nextWins >= kingTargetCrowns) {
              setKingChampion(winningPlayerName);
            }
            return copy;
          });

          setKingCurrentStreak((prev) => (result.state.winner === 'left' ? prev + 1 : 1));
        }

        resolveTimerRef.current = window.setTimeout(() => {
          setRound((prev) => finishTapResolution(prev));
        }, 700);
        return;
      }

      if (bannerAfter.type === 'deuce') {
        window.setTimeout(() => {
          sound.playSuddenDeathAlert();
          sound.speak('¡Muerte súbita! Hay que ganar de dos');
        }, 350);
      }

      // Desbloquear la mesa tras una breve pausa para que se vea el feedback y seguir repartiendo
      resolveTimerRef.current = window.setTimeout(() => {
        setFloatingFeedback(null);
        setRound((prev) => {
          const unlocked = finishTapResolution(prev);
          return advanceTurnCard(unlocked);
        });
      }, 900);
    },
    [countdown, clearAllGameTimers, leftName, rightName, mode, kingCurrentStreak, kingTargetCrowns]
  );

  // Ciclo automático de reparto de cartas y reacción del Bot en modo Reto IA
  useEffect(() => {
    if (screen !== 'GAME' || countdown !== null) return;
    if (!round.gameActive || round.isResolvingTap || round.winner !== null) return;

    // Velocidad dinámica: acelera ligeramente en Muerte Súbita para máxima adrenalina
    const isSuddenDeath = round.scoreLeft >= 2 && round.scoreRight >= 2;
    const baseDelay = isSuddenDeath ? 820 : 1020;

    dealTimerRef.current = window.setTimeout(() => {
      sound.playCardDeal();
      setRound((prev) => advanceTurnCard(prev));
    }, baseDelay);

    // Si estamos en modo Reto IA ('ai'), evaluamos si el Bot (lado 'right') pulsa en este turno
    if (mode === 'ai' && (round.leftCard || round.rightCard)) {
      const currentEval = evaluateBoard(round.leftCard, round.rightCard);

      const difficultyProfile = {
        novato: { reactionMs: 690, jitterMs: 180, hitChance: 0.72, trapMistakeChance: 0.14 },
        competitivo: { reactionMs: 490, jitterMs: 120, hitChance: 0.88, trapMistakeChance: 0.06 },
        maestro: { reactionMs: 350, jitterMs: 75, hitChance: 0.96, trapMistakeChance: 0.015 },
      }[aiDifficulty];

      if (currentEval.valid) {
        if (Math.random() < difficultyProfile.hitChance) {
          const delay =
            difficultyProfile.reactionMs + Math.floor(Math.random() * difficultyProfile.jitterMs);
          if (delay < baseDelay - 40) {
            aiTimerRef.current = window.setTimeout(() => {
              handlePlayerTap('right');
            }, delay);
          }
        }
      } else if (
        currentEval.reason === 'trap_7_6' &&
        Math.random() < difficultyProfile.trapMistakeChance
      ) {
        // El bot puede caer ocasionalmente en la trampa 7-6 en niveles bajos
        const delay = difficultyProfile.reactionMs + 90;
        if (delay < baseDelay - 40) {
          aiTimerRef.current = window.setTimeout(() => {
            handlePlayerTap('right');
          }, delay);
        }
      }
    }

    return () => {
      if (dealTimerRef.current !== null) {
        window.clearTimeout(dealTimerRef.current);
        dealTimerRef.current = null;
      }
      if (aiTimerRef.current !== null) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [
    screen,
    countdown,
    round.turnId,
    round.gameActive,
    round.isResolvingTap,
    round.winner,
    round.leftCard,
    round.rightCard,
    round.scoreLeft,
    round.scoreRight,
    mode,
    aiDifficulty,
    handlePlayerTap,
  ]);

  // Soporte de teclado para jugar cómodamente en PC además de pantallas táctiles
  useEffect(() => {
    if (screen !== 'GAME') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'a' || key === 's' || key === 'w' || key === ' ') {
        e.preventDefault();
        handlePlayerTap('left');
      } else if (
        mode !== 'ai' &&
        (key === 'l' || key === 'p' || key === 'enter' || key === 'arrowup' || key === 'arrowright')
      ) {
        e.preventDefault();
        handlePlayerTap('right');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, mode, handlePlayerTap]);

  // Iniciar Duelo 1v1 directo
  const startDuelMode = () => {
    beginRoundWithCountdown('JUGADOR 1', 'JUGADOR 2', 'duel');
  };

  // Iniciar Reto IA con la dificultad elegida
  const startAiMode = (diff: AIDifficulty) => {
    setAiDifficulty(diff);
    setShowAiModal(false);
    const botLabel =
      diff === 'novato' ? 'BOT NOVATO' : diff === 'competitivo' ? 'BOT PRO' : 'BOT MAESTRO';
    beginRoundWithCountdown('JUGADOR 1', botLabel, 'ai');
  };

  // Configurar e iniciar Rey de la Pista
  const openKingSetup = () => {
    setKingChampion(null);
    setScreen('KING_SETUP');
  };

  const addKingPlayer = () => {
    const clean = newPlayerInput.trim().toUpperCase();
    if (!clean || kingPlayers.includes(clean) || kingPlayers.length >= 8) return;
    setKingPlayers((prev) => [...prev, clean]);
    setNewPlayerInput('');
  };

  const removeKingPlayer = (idx: number) => {
    if (kingPlayers.length <= 3) return;
    setKingPlayers((prev) => prev.filter((_, i) => i !== idx));
  };

  const startKingTournament = () => {
    if (kingPlayers.length < 3) return;
    const initialStats: Record<string, KingPlayerStats> = {};
    kingPlayers.forEach((name) => {
      initialStats[name] = { name, wins: 0, played: 0, bestStreak: 0 };
    });
    setKingStats(initialStats);
    setKingIdx(0);
    setChallengerIdx(1);
    setQueueIndices(kingPlayers.map((_, i) => i).slice(2));
    setKingCurrentStreak(0);
    setKingChampion(null);
    beginRoundWithCountdown(kingPlayers[0], kingPlayers[1], 'king');
  };

  // Siguiente duelo en Rey de la Pista
  const nextKingMatch = () => {
    if (!round.winner) return;
    const winnerIdx = round.winner === 'left' ? kingIdx : challengerIdx;
    const loserIdx = round.winner === 'left' ? challengerIdx : kingIdx;

    const updatedQueue = [...queueIndices, loserIdx];
    const nextChallenger = updatedQueue[0];
    const remainingQueue = updatedQueue.slice(1);

    setKingIdx(winnerIdx);
    setChallengerIdx(nextChallenger);
    setQueueIndices(remainingQueue);

    beginRoundWithCountdown(kingPlayers[winnerIdx], kingPlayers[nextChallenger], 'king');
  };

  // Compartir resultado viral
  const handleViralShare = async () => {
    const winnerName = round.winner === 'left' ? leftName : rightName;
    const isSudden = round.scoreLeft >= 2 && round.scoreRight >= 2;
    const text = `⚡ ¡${winnerName} ha ganado ${round.scoreLeft}-${round.scoreRight} en SIX SEVEN ✨${
      isSudden ? ' (en MUERTE SÚBITA ganando de 2)' : ''
    }! ¿Tienes reflejos para superarlo?`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'SixSeven ✨', text });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareToast('¡RESULTADO COPIADO AL PORTAPAPELES!');
      window.setTimeout(() => setShareToast(null), 2500);
    } catch {
      setShareToast(text);
      window.setTimeout(() => setShareToast(null), 2500);
    }
  };

  const matchBanner = getMatchStatusBanner(
    round.scoreLeft,
    round.scoreRight,
    leftName,
    rightName,
    round.targetPoints
  );

  return (
    <div
      className={`min-h-screen w-full relative flex flex-col justify-between overflow-hidden ${
        screenShake ? 'animate-shake-hard bg-[#2a0000]' : ''
      }`}
    >
      {/* ==================== PANTALLA INICIO (HOME) ==================== */}
      {screen === 'HOME' && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 z-10 max-w-xl mx-auto w-full">
          {/* Barra superior de utilidades simples */}
          <div className="w-full flex items-center justify-between mb-6">
            <button
              onClick={() => setShowRulesModal(true)}
              className="px-4 py-2 bg-black border-2 border-white text-xs font-bold tracking-wider uppercase hover:bg-white hover:text-black transition-colors cursor-pointer"
            >
              📖 CÓMO JUGAR
            </button>
            <button
              onClick={toggleSound}
              className="px-4 py-2 bg-black border-2 border-white text-xs font-bold tracking-wider uppercase hover:bg-[#ccff00] hover:text-black transition-colors cursor-pointer"
            >
              {soundOn ? '🔊 SONIDO ON' : '🔇 SILENCIO'}
            </button>
          </div>

          {/* Logo Neo-Brutalista 67 */}
          <div className="text-center -rotate-2 mb-8">
            <div className="inline-flex items-baseline justify-center">
              <h1
                className="font-anton text-[104px] sm:text-[138px] leading-[0.82] tracking-tight text-[#ccff00] text-stroke-black-lg select-none"
                style={{ textShadow: '6px 6px 0 #ff00ff' }}
              >
                67
              </h1>
              <span className="font-marker text-5xl sm:text-6xl text-[#00ffff] text-stroke-black rotate-12 -ml-1">
                ✨
              </span>
            </div>
            <div className="mt-3">
              <span className="inline-block bg-black border-2 border-white px-3 py-1 text-xs sm:text-sm font-bold tracking-[0.18em] text-[#00ffff] rotate-1">
                REFLEJOS · CARTAS ESPECIALES · MUERTE SÚBITA
              </span>
            </div>
          </div>

          {/* Selector de Modos Directo y Limpio */}
          <div className="w-full space-y-4">
            {/* 1. Duelo 1v1 */}
            <button
              onClick={startDuelMode}
              className="w-full text-left bg-[#111111] border-3 border-white p-5 flex items-center gap-4 brutal-shadow-cyan hover:-translate-y-0.5 active:translate-y-0.5 transition-transform cursor-pointer group"
            >
              <div className="w-14 h-14 bg-[#00ffff] text-black border-2 border-black flex items-center justify-center text-3xl font-bold shrink-0">
                ⚡
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-anton text-2xl sm:text-3xl tracking-wide text-white group-hover:text-[#00ffff] transition-colors">
                  DUELO 1v1
                </div>
                <div className="text-xs text-neutral-300 font-bold tracking-wider mt-0.5">
                  CARA A CARA EN LA MISMA PANTALLA · GANA DE 2 EN EMPATE
                </div>
              </div>
            </button>

            {/* 2. Rey de la Pista */}
            <button
              onClick={openKingSetup}
              className="w-full text-left bg-[#111111] border-3 border-white p-5 flex items-center gap-4 brutal-shadow-magenta hover:-translate-y-0.5 active:translate-y-0.5 transition-transform cursor-pointer group"
            >
              <div className="w-14 h-14 bg-[#ff00ff] text-white border-2 border-black flex items-center justify-center text-3xl font-bold shrink-0">
                👑
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-anton text-2xl sm:text-3xl tracking-wide text-white group-hover:text-[#ff00ff] transition-colors">
                  REY DE LA PISTA
                </div>
                <div className="text-xs text-neutral-300 font-bold tracking-wider mt-0.5">
                  MODO FIESTA (3 A 8 AMIGOS) · EL GANADOR SE QUEDA EN PISTA
                </div>
              </div>
            </button>

            {/* 3. Reto IA (Sin referencias al TFM ni telemetría) */}
            <button
              onClick={() => setShowAiModal(true)}
              className="w-full text-left bg-[#111111] border-3 border-white p-5 flex items-center gap-4 brutal-shadow-lime hover:-translate-y-0.5 active:translate-y-0.5 transition-transform cursor-pointer group"
            >
              <div className="w-14 h-14 bg-[#ccff00] text-black border-2 border-black flex items-center justify-center text-3xl font-bold shrink-0">
                🤖
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-anton text-2xl sm:text-3xl tracking-wide text-white group-hover:text-[#ccff00] transition-colors">
                  RETO IA
                </div>
                <div className="text-xs text-neutral-300 font-bold tracking-wider mt-0.5">
                  ENTRENA TUS REFLEJOS EN SOLITARIO CONTRA EL BOT
                </div>
              </div>
            </button>
          </div>

          {/* Resumen rápido de la Regla de Oro en portada */}
          <div className="mt-8 w-full bg-black/90 border-2 border-neutral-700 p-4 text-center space-y-1.5">
            <div className="text-xs font-bold tracking-widest text-[#ccff00]">
              🎯 REGLA DE ORO SIX SEVEN
            </div>
            <p className="text-xs text-neutral-200 leading-relaxed">
              Pulsa SOLO cuando haya <strong className="text-[#00ffff]">6 a la IZQUIERDA</strong> y{' '}
              <strong className="text-[#00ffff]">7 a la DERECHA</strong> del{' '}
              <strong className="text-[#ccff00]">MISMO COLOR</strong>. ¡Cuidado con la trampa{' '}
              <strong className="text-[#ff2200]">7-6 invertido</strong> y las{' '}
              <strong className="text-[#ff2200]">Bombas 💣</strong>!
            </p>
          </div>
        </div>
      )}

      {/* ==================== PANTALLA CONFIGURACIÓN REY DE LA PISTA ==================== */}
      {screen === 'KING_SETUP' && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 z-10 max-w-lg mx-auto w-full">
          <div className="w-full bg-[#111111] border-3 border-white p-6 brutal-shadow-magenta space-y-5">
            <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3">
              <div>
                <h2 className="font-anton text-3xl text-[#ff00ff] tracking-wide">
                  👑 REY DE LA PISTA
                </h2>
                <p className="text-xs text-neutral-300 font-bold">
                  AÑADE DE 3 A 8 JUGADORES PARA ROTAR EN PISTA
                </p>
              </div>
              <button
                onClick={() => setScreen('HOME')}
                className="px-3 py-1.5 bg-black border-2 border-white text-xs font-bold hover:bg-white hover:text-black cursor-pointer"
              >
                ← VOLVER
              </button>
            </div>

            {/* Input para añadir jugador */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlayerInput}
                onChange={(e) => setNewPlayerInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addKingPlayer()}
                maxLength={12}
                placeholder="NOMBRE DE JUGADOR..."
                className="flex-1 bg-black border-2 border-white px-3 py-2.5 text-sm font-bold text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ccff00]"
              />
              <button
                onClick={addKingPlayer}
                disabled={!newPlayerInput.trim() || kingPlayers.length >= 8}
                className="px-4 py-2.5 bg-[#ccff00] text-black font-anton text-lg border-2 border-black disabled:opacity-40 cursor-pointer"
              >
                + AÑADIR
              </button>
            </div>

            {/* Lista de jugadores */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {kingPlayers.map((p, idx) => (
                <div
                  key={p}
                  className="flex items-center justify-between bg-black border-2 border-neutral-700 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold px-2 py-0.5 bg-neutral-800 text-[#00ffff]">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-sm tracking-wider">{p}</span>
                    {idx === 0 && (
                      <span className="text-[10px] font-bold text-[#ccff00]">👑 EMPIEZA EN PISTA</span>
                    )}
                    {idx === 1 && (
                      <span className="text-[10px] font-bold text-[#ff00ff]">⚡ PRIMER RETADOR</span>
                    )}
                  </div>
                  {kingPlayers.length > 3 && (
                    <button
                      onClick={() => removeKingPlayer(idx)}
                      className="text-xs text-[#ff2200] font-bold hover:underline px-2 py-0.5 cursor-pointer"
                    >
                      QUITAR
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Meta de coronas para ganar el torneo */}
            <div className="flex items-center justify-between bg-black border-2 border-neutral-800 p-3">
              <span className="text-xs font-bold text-neutral-300">META DEL TORNEO:</span>
              <div className="flex gap-2">
                {[3, 5, 7].map((target) => (
                  <button
                    key={target}
                    onClick={() => setKingTargetCrowns(target)}
                    className={`px-3 py-1 text-xs font-bold border-2 cursor-pointer ${
                      kingTargetCrowns === target
                        ? 'bg-[#00ffff] text-black border-white'
                        : 'bg-black text-white border-neutral-700'
                    }`}
                  >
                    {target} CORONAS
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startKingTournament}
              disabled={kingPlayers.length < 3}
              className="w-full py-4 bg-[#ff00ff] text-white font-anton text-2xl tracking-wider border-3 border-white brutal-shadow-cyan hover:bg-[#e600e6] cursor-pointer"
            >
              👑 ¡EMPEZAR REY DE LA PISTA!
            </button>
          </div>
        </div>
      )}

      {/* ==================== ARENA DE JUEGO ACTIVA (GAME) ==================== */}
      {screen === 'GAME' && (
        <div className="flex-1 flex flex-col justify-between h-screen max-h-screen w-full max-w-3xl mx-auto px-3 py-2.5 z-10 select-none">
          {/* Barra superior de control de partida */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <button
              onClick={() => {
                clearAllGameTimers();
                setScreen('HOME');
              }}
              className="px-3 py-1.5 bg-black border-2 border-white text-xs font-bold tracking-wider hover:bg-white hover:text-black cursor-pointer"
            >
              ← SALIR
            </button>

            <div className="text-center">
              <span className="text-[11px] font-bold tracking-widest text-neutral-300 bg-black border border-neutral-700 px-2.5 py-1">
                {mode === 'duel'
                  ? '⚡ DUELO 1v1 · A 3 PUNTOS (GANA DE 2)'
                  : mode === 'king'
                  ? `👑 REY DE LA PISTA · RACHA: ${kingCurrentStreak}`
                  : `🤖 RETO IA (${aiDifficulty.toUpperCase()})`}
              </span>
            </div>

            <button
              onClick={toggleSound}
              className="px-3 py-1.5 bg-black border-2 border-white text-xs font-bold cursor-pointer"
            >
              {soundOn ? '🔊' : '🔇'}
            </button>
          </div>

          {/* ZONA DE PULSACIÓN JUGADOR 1 (IZQUIERDA / ARRIBA) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              handlePlayerTap('left');
            }}
            disabled={!round.gameActive || round.isResolvingTap || countdown !== null}
            className="w-full flex-1 min-h-[115px] max-h-[180px] bg-[#141414] hover:bg-[#1b1b1b] active:bg-[#00ffff]/20 border-3 border-[#00ffff] px-5 py-3 flex items-center justify-between transition-colors cursor-pointer relative overflow-hidden"
            style={{ boxShadow: '4px 4px 0 #00ffff' }}
          >
            <div className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-[#00ffff] text-black text-[10px] font-bold px-2 py-0.5">
                  {mode === 'king' ? '👑 REY EN PISTA' : 'ZONA JUGADOR 1'}
                </span>
                {round.streakLeft >= 2 && (
                  <span className="text-xs font-bold text-[#ccff00]">
                    🔥 RACHA x{round.streakLeft}
                  </span>
                )}
              </div>
              <div className="font-anton text-2xl sm:text-4xl text-white tracking-wide">
                {leftName}
              </div>
              <div className="text-[11px] text-neutral-400 font-bold">
                TOCA AQUÍ O PULSA [A / ESPACIO] ¡CUANDO SALGA 6-7!
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-[#00ffff] tracking-widest">PUNTOS</span>
              <span className="font-anton text-6xl sm:text-7xl leading-none text-[#00ffff] tabular-nums">
                {round.scoreLeft}
              </span>
            </div>
          </button>

          {/* ZONA CENTRAL: BANNER MUERTE SÚBITA + LAS 2 CARTAS (IZQUIERDA Y DERECHA) */}
          <div className="my-2 flex flex-col items-center justify-center relative">
            {/* Banner Dinámico de Punto de Partido / Muerte Súbita (Deuce / Ventaja) */}
            {matchBanner.type !== 'none' ? (
              <div
                className={`w-full py-1.5 px-3 mb-2 border-2 border-black text-center font-anton tracking-wider text-sm sm:text-base ${
                  matchBanner.type === 'deuce'
                    ? 'bg-[#ccff00] text-black animate-pulse'
                    : matchBanner.type === 'advantage'
                    ? 'bg-[#ff00ff] text-white'
                    : 'bg-[#ff2200] text-white'
                }`}
              >
                {matchBanner.text}
              </div>
            ) : (
              <div className="w-full py-1 px-3 mb-2 bg-black border border-neutral-800 text-center text-[11px] font-bold text-neutral-300 tracking-wider">
                🎯 PULSA CON <span className="text-[#ccff00]">6 A LA IZQUIERDA</span> Y{' '}
                <span className="text-[#ccff00]">7 A LA DERECHA</span> DEL MISMO COLOR
              </div>
            )}

            {/* Mesa de 2 Cartas: CARTA IZQUIERDA y CARTA DERECHA */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-md mx-auto items-center">
              {/* CARTA IZQUIERDA (Debe salir 6) */}
              <div className="flex flex-col items-center">
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-bold tracking-widest px-2 py-0.5 border ${
                      round.nextSide === 'left'
                        ? 'bg-[#ccff00] text-black border-black'
                        : 'bg-black text-neutral-400 border-neutral-800'
                    }`}
                  >
                    IZQUIERDA (BUSCA EL 6)
                  </span>
                </div>
                <CardSlotView card={round.leftCard} side="left" />
              </div>

              {/* CARTA DERECHA (Debe salir 7) */}
              <div className="flex flex-col items-center">
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-bold tracking-widest px-2 py-0.5 border ${
                      round.nextSide === 'right'
                        ? 'bg-[#ccff00] text-black border-black'
                        : 'bg-black text-neutral-400 border-neutral-800'
                    }`}
                  >
                    DERECHA (BUSCA EL 7)
                  </span>
                </div>
                <CardSlotView card={round.rightCard} side="right" />
              </div>
            </div>

            {/* Cuenta atrás 3-2-1 sobre la mesa */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/85 border-3 border-white flex flex-col items-center justify-center z-30">
                <span className="text-xs font-bold tracking-widest text-[#00ffff] mb-1">
                  PREPARADOS...
                </span>
                <span className="font-anton text-8xl text-[#ccff00] text-stroke-black">
                  {countdown}
                </span>
              </div>
            )}

            {/* Banner Flotante de Resolución Instantánea (Acierto / Trampa 7-6 / Bomba) */}
            {floatingFeedback && (
              <div
                className={`
                  absolute inset-x-2 top-1/2 -translate-y-1/2 z-30 p-4 border-3 border-black text-center shadow-2xl
                  ${floatingFeedback.isValid ? 'bg-[#ccff00] text-black' : 'bg-[#ff2200] text-white'}
                `}
              >
                <div className="font-anton text-2xl sm:text-3xl tracking-wide">
                  {floatingFeedback.title}
                </div>
                <div className="text-xs font-bold tracking-widest mt-0.5">
                  {floatingFeedback.subtitle}
                </div>
              </div>
            )}
          </div>

          {/* ZONA DE PULSACIÓN JUGADOR 2 (DERECHA / ABAJO) O ESTADO DEL BOT IA */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              if (mode !== 'ai') handlePlayerTap('right');
            }}
            disabled={
              mode === 'ai' || !round.gameActive || round.isResolvingTap || countdown !== null
            }
            className={`w-full flex-1 min-h-[115px] max-h-[180px] bg-[#141414] border-3 border-[#ff00ff] px-5 py-3 flex items-center justify-between transition-colors relative overflow-hidden ${
              mode === 'ai'
                ? 'cursor-default opacity-95'
                : 'hover:bg-[#1b1b1b] active:bg-[#ff00ff]/20 cursor-pointer'
            }`}
            style={{ boxShadow: '4px 4px 0 #ff00ff' }}
          >
            <div className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-[#ff00ff] text-white text-[10px] font-bold px-2 py-0.5">
                  {mode === 'ai'
                    ? '🤖 RIVAL AUTOMÁTICO'
                    : mode === 'king'
                    ? '⚡ ASPIRANTE'
                    : 'ZONA JUGADOR 2'}
                </span>
                {round.streakRight >= 2 && (
                  <span className="text-xs font-bold text-[#ccff00]">
                    🔥 RACHA x{round.streakRight}
                  </span>
                )}
              </div>
              <div className="font-anton text-2xl sm:text-4xl text-white tracking-wide">
                {rightName}
              </div>
              <div className="text-[11px] text-neutral-400 font-bold">
                {mode === 'ai'
                  ? 'EL BOT OBSERVA LA MESA Y COMPITE EN TIEMPO REAL'
                  : 'TOCA AQUÍ O PULSA [L / ENTER] ¡CUANDO SALGA 6-7!'}
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-[#ff00ff] tracking-widest">PUNTOS</span>
              <span className="font-anton text-6xl sm:text-7xl leading-none text-[#ff00ff] tabular-nums">
                {round.scoreRight}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ==================== MODAL FIN DE PARTIDA / RONDA ==================== */}
      {screen === 'GAME' && round.winner !== null && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#111111] border-3 border-white p-6 brutal-shadow-lime text-center space-y-5">
            <div className="text-5xl">{kingChampion ? '🏆' : '🎉'}</div>

            <div>
              <div className="text-xs font-bold tracking-widest text-[#00ffff] uppercase">
                {round.scoreLeft >= 2 && round.scoreRight >= 2
                  ? '⚡ VICTORIA EN MUERTE SÚBITA (VENTAJA DE 2) ⚡'
                  : '¡FIN DEL SET!'}
              </div>
              <h2 className="font-anton text-4xl sm:text-5xl text-[#ccff00] tracking-wide mt-1">
                {kingChampion
                  ? `¡${kingChampion} CAMPEÓN!`
                  : `¡GANA ${round.winner === 'left' ? leftName : rightName}!`}
              </h2>
              <div className="mt-2 inline-block bg-black border-2 border-white px-4 py-1 font-anton text-2xl tracking-widest">
                {leftName} <span className="text-[#00ffff]">{round.scoreLeft}</span> -{' '}
                <span className="text-[#ff00ff]">{round.scoreRight}</span> {rightName}
              </div>
            </div>

            {/* Si estamos en Rey de la Pista, mostrar clasificación en vivo */}
            {mode === 'king' && (
              <div className="bg-black border-2 border-neutral-700 p-3 text-left space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#ff00ff] border-b border-neutral-800 pb-1">
                  <span>CLASIFICACIÓN REY DE LA PISTA</span>
                  <span>META: {kingTargetCrowns} 👑</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {(Object.values(kingStats) as KingPlayerStats[])
                    .sort((a, b) => b.wins - a.wins || b.bestStreak - a.bestStreak)
                    .map((st) => (
                      <div
                        key={st.name}
                        className="flex items-center justify-between text-xs font-bold py-1 px-2 bg-[#161616]"
                      >
                        <span>
                          {st.name}{' '}
                          {st.name === (round.winner === 'left' ? leftName : rightName) && '👑'}
                        </span>
                        <span className="text-[#ccff00]">
                          {st.wins} 👑 · MEJOR RACHA: {st.bestStreak}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {shareToast && (
              <div className="bg-[#00ffff] text-black text-xs font-bold py-2 px-3 border-2 border-black">
                {shareToast}
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              {mode === 'king' && !kingChampion ? (
                <button
                  onClick={nextKingMatch}
                  className="w-full py-3.5 bg-[#ccff00] text-black font-anton text-2xl tracking-wider border-2 border-black cursor-pointer hover:bg-[#b8e600]"
                >
                  ⚡ SIGUIENTE RETADOR ({kingPlayers[queueIndices[0] ?? challengerIdx]})
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (mode === 'king') {
                      startKingTournament();
                    } else {
                      beginRoundWithCountdown(leftName, rightName, mode);
                    }
                  }}
                  className="w-full py-3.5 bg-[#ccff00] text-black font-anton text-2xl tracking-wider border-2 border-black cursor-pointer hover:bg-[#b8e600]"
                >
                  🔄 JUGAR REVANCHA
                </button>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleViralShare}
                  className="py-3 bg-[#ff00ff] text-white font-bold text-xs tracking-wider border-2 border-white cursor-pointer hover:bg-[#d900d9]"
                >
                  📲 COMPARTIR
                </button>
                <button
                  onClick={() => {
                    clearAllGameTimers();
                    setScreen('HOME');
                  }}
                  className="py-3 bg-black text-white font-bold text-xs tracking-wider border-2 border-white cursor-pointer hover:bg-white hover:text-black"
                >
                  🏠 MENÚ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL SELECCIÓN DE DIFICULTAD RETO IA ==================== */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#111111] border-3 border-white p-6 brutal-shadow-lime space-y-4">
            <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3">
              <h3 className="font-anton text-3xl text-[#ccff00] tracking-wide">🤖 RETO IA</h3>
              <button
                onClick={() => setShowAiModal(false)}
                className="px-3 py-1 bg-black border-2 border-white text-xs font-bold cursor-pointer"
              >
                ✕ CERRAR
              </button>
            </div>
            <p className="text-xs text-neutral-300 font-bold">
              ELIGE LA VELOCIDAD DE REFLEJOS DE TU RIVAL:
            </p>
            <div className="space-y-3">
              <button
                onClick={() => startAiMode('novato')}
                className="w-full text-left bg-black border-2 border-[#00ffff] p-4 hover:bg-[#00ffff] hover:text-black transition-colors cursor-pointer group"
              >
                <div className="font-anton text-xl text-[#00ffff] group-hover:text-black">
                  🌱 NIVEL NOVATO
                </div>
                <div className="text-xs text-neutral-300 group-hover:text-black font-bold">
                  Reacción pausada (~700ms). Ideal para calentar y aprender las cartas especiales.
                </div>
              </button>

              <button
                onClick={() => startAiMode('competitivo')}
                className="w-full text-left bg-black border-2 border-[#ccff00] p-4 hover:bg-[#ccff00] hover:text-black transition-colors cursor-pointer group"
              >
                <div className="font-anton text-xl text-[#ccff00] group-hover:text-black">
                  ⚡ NIVEL COMPETITIVO
                </div>
                <div className="text-xs text-neutral-300 group-hover:text-black font-bold">
                  Reflejos rápidos (~490ms) y alta precisión. ¡No perdona despistes!
                </div>
              </button>

              <button
                onClick={() => startAiMode('maestro')}
                className="w-full text-left bg-black border-2 border-[#ff00ff] p-4 hover:bg-[#ff00ff] hover:text-white transition-colors cursor-pointer group"
              >
                <div className="font-anton text-xl text-[#ff00ff] group-hover:text-white">
                  🔥 NIVEL MAESTRO
                </div>
                <div className="text-xs text-neutral-300 group-hover:text-white font-bold">
                  Velocidad extrema (~350ms). Cero piedad en Muerte Súbita.
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL DE REGLAS Y CARTAS ESPECIALES ==================== */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-[#111111] border-3 border-white p-6 brutal-shadow-cyan space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3">
              <h3 className="font-anton text-3xl text-[#00ffff] tracking-wide">
                📖 REGLAS DE SIX SEVEN
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-3 py-1 bg-black border-2 border-white text-xs font-bold cursor-pointer"
              >
                ✕ CERRAR
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="bg-black border-2 border-[#ccff00] p-3">
                <div className="font-bold text-[#ccff00] text-sm mb-1">
                  ✅ JUGADA VÁLIDA: 6 A LA IZQUIERDA + 7 A LA DERECHA
                </div>
                <p className="text-neutral-200">
                  Pulsa tu zona lo más rápido posible SOLO cuando la carta de la{' '}
                  <strong>IZQUIERDA sea un 6</strong> y la de la{' '}
                  <strong>DERECHA sea un 7</strong> del <strong>MISMO COLOR</strong>.
                </p>
              </div>

              <div className="bg-black border-2 border-[#ff2200] p-3">
                <div className="font-bold text-[#ff2200] text-sm mb-1">
                  🚫 TRAMPA 7-6 (ORDEN INVERTIDO)
                </div>
                <p className="text-neutral-200">
                  Si sale <strong>7 a la izquierda y 6 a la derecha</strong> (aunque sean del mismo
                  color), <strong>NO es una jugada válida</strong>. ¡Si pulsas, el punto va para tu
                  rival!
                </p>
              </div>

              <div className="bg-black border-2 border-[#ff00ff] p-3">
                <div className="font-bold text-[#ff00ff] text-sm mb-1">
                  ⚡ MUERTE SÚBITA: GANAR DE 2 PUNTOS
                </div>
                <p className="text-neutral-200">
                  Las rondas son a 3 puntos, pero si empatáis a <strong>2-2</strong> se activa la{' '}
                  <strong>Muerte Súbita</strong>: para ganar tendrás que conseguir una{' '}
                  <strong>ventaja mínima de 2 puntos</strong> (4-2, 5-3, 6-4...).
                </p>
              </div>

              <div className="bg-black border-2 border-white p-3 space-y-2">
                <div className="font-bold text-[#00ffff] text-sm">🃏 CARTAS ESPECIALES VIRALES</div>
                <ul className="space-y-1.5 text-neutral-200">
                  <li>
                    👑 <strong>JACKPOT 67:</strong> ¡Jugada directa! Pulsa al instante para ganar{' '}
                    <span className="text-[#ccff00] font-bold">+2 puntos</span>.
                  </li>
                  <li>
                    ⚡ <strong>DOBLE x2:</strong> Si completas un 6-7 válido con esta carta, te
                    llevas <span className="text-[#ccff00] font-bold">+2 puntos</span>.
                  </li>
                  <li>
                    🌈 <strong>COMODÍN MULTICOLOR:</strong> Cuenta como cualquier color para formar
                    un 6-7 válido.
                  </li>
                  <li>
                    🪞 <strong>ESPEJO:</strong> Invierte legalmente un 7-6 del mismo color para que
                    cuente como un 6-7 válido.
                  </li>
                  <li>
                    💣 <strong>BOMBA:</strong> ¡Trampa explosiva! Nunca pulses mientras haya una
                    bomba en la mesa.
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-3 bg-[#ccff00] text-black font-anton text-xl tracking-wider border-2 border-black cursor-pointer"
            >
              ¡ENTENDIDO, A JUGAR!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Componente visual de cada ranura de carta (Izquierda o Derecha)
 */
function CardSlotView({ card, side }: { card: CardItem | null; side: PlayerSide }) {
  if (!card) {
    return (
      <div className="w-full aspect-[3/4] max-w-[165px] bg-[#161616] border-3 border-dashed border-neutral-700 flex flex-col items-center justify-center p-4 text-center">
        <span className="font-anton text-4xl text-neutral-700">
          {side === 'left' ? '6' : '7'}
        </span>
        <span className="text-[10px] font-bold text-neutral-600 mt-1">ESPERANDO CARTA</span>
      </div>
    );
  }

  const colorSpec = COLOR_MAP[card.color] || COLOR_MAP.lime;

  // Estilos especiales según tipo de carta
  const isRainbow = card.kind === 'rainbow';
  const badgeText = isRainbow ? '4 COLORES' : colorSpec.name;

  return (
    <div
      key={card.id}
      className={`w-full aspect-[3/4] max-w-[165px] border-3 border-white flex flex-col items-center justify-between p-3 relative transition-transform duration-100 ${
        isRainbow ? 'card-rainbow text-black' : ''
      }`}
      style={{
        backgroundColor: isRainbow ? undefined : colorSpec.hex,
        color: colorSpec.textHex,
        boxShadow: '6px 6px 0 #000000',
      }}
    >
      {/* Esquina superior */}
      <div className="w-full flex items-center justify-between text-xs font-bold">
        <span className="px-1.5 py-0.5 bg-black text-white text-[10px] tracking-wider">
          {side === 'left' ? 'IZQ' : 'DER'}
        </span>
        <span>{isRainbow ? '🌈' : '●'}</span>
      </div>

      {/* Número Central Gigante */}
      <div className="my-auto flex flex-col items-center justify-center">
        <div
          className="font-anton text-7xl sm:text-8xl leading-none tracking-tighter select-none"
          style={{
            WebkitTextStroke:
              colorSpec.textHex === '#ffffff' && !isRainbow ? '2px #000000' : 'none',
          }}
        >
          {card.num}
        </div>
      </div>

      {/* Etiqueta inferior de color / poder especial */}
      <div className="w-full bg-black text-white text-[10px] font-bold py-1 px-1.5 text-center tracking-wider truncate">
        {badgeText}
      </div>
    </div>
  );
}
