export type CardColorId = 'lime' | 'magenta' | 'cyan' | 'red';

export type CardKind = 'normal' | 'rainbow';

export type PlayerSide = 'left' | 'right';

export interface CardColorSpec {
  id: CardColorId;
  name: string;
  hex: string;
  textHex: string;
  borderHex: string;
}

export const CARD_COLORS: CardColorSpec[] = [
  { id: 'lime', name: 'VERDE', hex: '#ccff00', textHex: '#000000', borderHex: '#000000' },
  { id: 'magenta', name: 'ROSA', hex: '#ff00ff', textHex: '#ffffff', borderHex: '#000000' },
  { id: 'cyan', name: 'CIAN', hex: '#00ffff', textHex: '#000000', borderHex: '#000000' },
  { id: 'red', name: 'ROJO', hex: '#ff2200', textHex: '#ffffff', borderHex: '#000000' },
];

export interface CardItem {
  id: string;
  num: number; // 6 o 7
  color: CardColorId;
  kind: CardKind;
  turnDealt: number;
}

export type EvaluationReason =
  | 'six_seven'
  | 'rainbow_six_seven'
  | 'trap_7_6'
  | 'same_number'
  | 'wrong_color'
  | 'wrong_numbers'
  | 'incomplete';

export interface BoardEvaluation {
  valid: boolean;
  points: number;
  reason: EvaluationReason;
  label: string;
  sublabel: string;
}

export interface RoundState {
  leftCard: CardItem | null;
  rightCard: CardItem | null;
  nextSide: PlayerSide;
  turnId: number;
  cardsSinceLastWin: number;
  scoreLeft: number;
  scoreRight: number;
  streakLeft: number;
  streakRight: number;
  targetPoints: number;
  wildcardEnabled: boolean;
  gameActive: boolean;
  isResolvingTap: boolean;
  winner: PlayerSide | null;
}

export interface MatchBannerInfo {
  type: 'none' | 'match_point' | 'deuce' | 'advantage';
  text: string;
  leader?: PlayerSide;
  isSuddenDeath: boolean;
}

export function createInitialRoundState(targetPoints = 5, wildcardEnabled = false): RoundState {
  return {
    leftCard: null,
    rightCard: null,
    nextSide: 'left',
    turnId: 0,
    cardsSinceLastWin: 0,
    scoreLeft: 0,
    scoreRight: 0,
    streakLeft: 0,
    streakRight: 0,
    targetPoints,
    wildcardEnabled,
    gameActive: true,
    isResolvingTap: false,
    winner: null,
  };
}

/**
 * Evalúa de forma determinista si las cartas actuales en mesa forman una jugada válida de Six Seven.
 * Regla fundamental pura (sin dobles puntos ni cartas raras):
 * - IZQUIERDA = 6 y DERECHA = 7 del MISMO COLOR (o con Comodín 4 colores si está activo) -> VÁLIDO (+1 punto).
 * - IZQUIERDA = 7 y DERECHA = 6 -> SIEMPRE INVÁLIDO (Trampa 7-6, nunca vale).
 * - Mismo número (6-6 o 7-7), distinto color o falta una carta -> INVÁLIDO (+1 punto al rival).
 */
export function evaluateBoard(
  leftCard: CardItem | null,
  rightCard: CardItem | null
): BoardEvaluation {
  if (!leftCard || !rightCard) {
    return {
      valid: false,
      points: 1,
      reason: 'incomplete',
      label: '⚠️ ¡FALTA UNA CARTA!',
      sublabel: 'Necesitas dos cartas en mesa para formar 6-7',
    };
  }

  const isColorMatch =
    leftCard.color === rightCard.color ||
    leftCard.kind === 'rainbow' ||
    rightCard.kind === 'rainbow';

  const hasRainbow = leftCard.kind === 'rainbow' || rightCard.kind === 'rainbow';

  // Caso A: 6 a la IZQUIERDA y 7 a la DERECHA (único orden numérico válido, siempre +1 punto)
  if (leftCard.num === 6 && rightCard.num === 7) {
    if (isColorMatch) {
      if (hasRainbow) {
        return {
          valid: true,
          points: 1,
          reason: 'rainbow_six_seven',
          label: '🌈 ¡SIX SEVEN! (+1)',
          sublabel: '6-7 completado con comodín de 4 colores',
        };
      }
      return {
        valid: true,
        points: 1,
        reason: 'six_seven',
        label: '✨ ¡SIX SEVEN! (+1)',
        sublabel: '6 a la izquierda y 7 a la derecha del mismo color',
      };
    } else {
      return {
        valid: false,
        points: 1,
        reason: 'wrong_color',
        label: '❌ ¡DISTINTO COLOR!',
        sublabel: 'El 6 y el 7 deben ser del mismo color',
      };
    }
  }

  // Caso B: 7 a la IZQUIERDA y 6 a la DERECHA -> SIEMPRE TRAMPA INVÁLIDA
  if (leftCard.num === 7 && rightCard.num === 6) {
    return {
      valid: false,
      points: 1,
      reason: 'trap_7_6',
      label: '🚫 ¡TRAMPA 7-6 INVERTIDO!',
      sublabel: '7 a la izquierda y 6 a la derecha NUNCA vale',
    };
  }

  // Caso C: Mismo número en ambos lados (6-6 o 7-7)
  if (leftCard.num === rightCard.num) {
    return {
      valid: false,
      points: 1,
      reason: 'same_number',
      label: `❌ ¡ES ${leftCard.num}-${rightCard.num} (NO 6-7)!`,
      sublabel: 'Tiene que ser 6 a la izquierda y 7 a la derecha',
    };
  }

  return {
    valid: false,
    points: 1,
    reason: 'wrong_numbers',
    label: '❌ ¡NO ES 6-7!',
    sublabel: 'No hay combinación Six Seven en mesa',
  };
}

/**
 * Comprueba si hay un ganador del set aplicando estrictamente la regla de Muerte Súbita:
 * - Se gana al llegar a `targetPoints` (por defecto 5) SIEMPRE Y CUANDO se tenga una ventaja de >= 2 puntos.
 * - Si ambos llegan a `targetPoints - 1` (ej. 4-4), continúa hasta que uno saque 2 puntos de ventaja (6-4, 7-5...).
 */
export function checkSetVictory(
  scoreLeft: number,
  scoreRight: number,
  targetPoints = 5
): PlayerSide | null {
  const maxScore = Math.max(scoreLeft, scoreRight);
  const diff = Math.abs(scoreLeft - scoreRight);

  if (maxScore >= targetPoints && diff >= 2) {
    return scoreLeft > scoreRight ? 'left' : 'right';
  }
  return null;
}

/**
 * Calcula el estado del banner competitivo (Punto de Partido, Muerte Súbita Deuce o Ventaja).
 */
export function getMatchStatusBanner(
  scoreLeft: number,
  scoreRight: number,
  leftName: string,
  rightName: string,
  targetPoints = 5
): MatchBannerInfo {
  const deuceThreshold = targetPoints - 1; // 4 puntos cuando se juega a 5

  if (scoreLeft >= deuceThreshold && scoreRight >= deuceThreshold) {
    const diff = Math.abs(scoreLeft - scoreRight);
    if (diff === 0) {
      return {
        type: 'deuce',
        text: `⚡ MUERTE SÚBITA · EMPATE ${scoreLeft}-${scoreRight} (GANA DE 2) ⚡`,
        isSuddenDeath: true,
      };
    }
    if (diff === 1) {
      const leader: PlayerSide = scoreLeft > scoreRight ? 'left' : 'right';
      const leaderName = (leader === 'left' ? leftName : rightName).toUpperCase();
      return {
        type: 'advantage',
        leader,
        text: `🔥 VENTAJA ${leaderName} (${scoreLeft}-${scoreRight}) · A 1 DE GANAR 🔥`,
        isSuddenDeath: true,
      };
    }
  }

  if (scoreLeft === deuceThreshold && scoreRight < deuceThreshold) {
    return {
      type: 'match_point',
      leader: 'left',
      text: `🔥 PUNTO DE PARTIDO PARA ${leftName.toUpperCase()} 🔥`,
      isSuddenDeath: false,
    };
  }

  if (scoreRight === deuceThreshold && scoreLeft < deuceThreshold) {
    return {
      type: 'match_point',
      leader: 'right',
      text: `🔥 PUNTO DE PARTIDO PARA ${rightName.toUpperCase()} 🔥`,
      isSuddenDeath: false,
    };
  }

  return {
    type: 'none',
    text: `META: ${targetPoints} PUNTOS (GANA DE 2 EN EMPATE)`,
    isSuddenDeath: false,
  };
}

export function resolveDealTargetSide(
  _leftCard: CardItem | null,
  _rightCard: CardItem | null,
  nextSide: PlayerSide
): PlayerSide {
  return nextSide;
}

/**
 * Genera una nueva carta limpia (6 o 7) para el lado `side`.
 */
export function generateNextCard(
  side: PlayerSide,
  oppositeCard: CardItem | null,
  turnId: number,
  cardsSinceLastWin: number,
  rng: () => number = Math.random,
  wildcardEnabled = false
): CardItem {
  const kind: CardKind = wildcardEnabled && rng() < 0.14 ? 'rainbow' : 'normal';
  const randomColor = CARD_COLORS[Math.floor(rng() * CARD_COLORS.length)].id;

  // Regla anti-sequía sin bucles:
  // Si llevamos >= 4 cartas sin combinación ganadora:
  // - En la izquierda SIEMPRE sacamos un 6 (del color de la derecha si existe).
  // - En la derecha SIEMPRE sacamos un 7 (del color de la izquierda si existe).
  if (cardsSinceLastWin >= 4) {
    const targetNum = side === 'left' ? 6 : 7;
    const targetColor = oppositeCard ? oppositeCard.color : randomColor;
    return {
      id: `card-${turnId}-${Math.floor(rng() * 100000)}`,
      num: targetNum,
      color: targetColor,
      kind,
      turnDealt: turnId,
    };
  }

  let num = rng() < 0.5 ? 6 : 7;
  let color: CardColorId = randomColor;

  if (oppositeCard && rng() < 0.52) {
    color = oppositeCard.color;
    if (side === 'left' && oppositeCard.num === 7) {
      num = rng() < 0.65 ? 6 : 7;
    } else if (side === 'right' && oppositeCard.num === 6) {
      num = rng() < 0.65 ? 7 : 6;
    }
  }

  return {
    id: `card-${turnId}-${Math.floor(rng() * 100000)}`,
    num,
    color,
    kind,
    turnDealt: turnId,
  };
}

export function advanceTurnCard(
  state: RoundState,
  customCard?: CardItem,
  rng: () => number = Math.random
): RoundState {
  if (!state.gameActive || state.isResolvingTap) return state;

  const nextTurnId = state.turnId + 1;
  const nextCardsSinceWin = state.cardsSinceLastWin + 1;
  const targetSide = state.nextSide;

  const oppositeCard = targetSide === 'left' ? state.rightCard : state.leftCard;
  const newCard =
    customCard ??
    generateNextCard(
      targetSide,
      oppositeCard,
      nextTurnId,
      nextCardsSinceWin,
      rng,
      state.wildcardEnabled
    );

  const updatedLeft = targetSide === 'left' ? newCard : state.leftCard;
  const updatedRight = targetSide === 'right' ? newCard : state.rightCard;

  const evalNow = evaluateBoard(updatedLeft, updatedRight);

  return {
    ...state,
    leftCard: updatedLeft,
    rightCard: updatedRight,
    nextSide: targetSide === 'left' ? 'right' : 'left',
    turnId: nextTurnId,
    cardsSinceLastWin: evalNow.valid ? 0 : nextCardsSinceWin,
  };
}

export interface TapResolutionResult {
  state: RoundState;
  evaluation: BoardEvaluation | null;
  scoringSide: PlayerSide | null;
  tappedBy: PlayerSide;
}

export function resolvePlayerTap(
  state: RoundState,
  side: PlayerSide
): TapResolutionResult {
  if (!state.gameActive || state.isResolvingTap) {
    return { state, evaluation: null, scoringSide: null, tappedBy: side };
  }

  if (!state.leftCard && !state.rightCard) {
    return { state, evaluation: null, scoringSide: null, tappedBy: side };
  }

  const evaluation = evaluateBoard(state.leftCard, state.rightCard);

  let scoreLeft = state.scoreLeft;
  let scoreRight = state.scoreRight;
  let streakLeft = state.streakLeft;
  let streakRight = state.streakRight;
  let scoringSide: PlayerSide;

  if (evaluation.valid) {
    scoringSide = side;
    if (side === 'left') {
      scoreLeft += 1;
      streakLeft += 1;
      streakRight = 0;
    } else {
      scoreRight += 1;
      streakRight += 1;
      streakLeft = 0;
    }
  } else {
    // Fallo / Trampa: +1 punto para el rival
    scoringSide = side === 'left' ? 'right' : 'left';
    if (scoringSide === 'left') {
      scoreLeft += 1;
    } else {
      scoreRight += 1;
    }
    streakLeft = 0;
    streakRight = 0;
  }

  const winner = checkSetVictory(scoreLeft, scoreRight, state.targetPoints);

  const nextState: RoundState = {
    ...state,
    leftCard: null,
    rightCard: null,
    nextSide: 'left',
    scoreLeft,
    scoreRight,
    streakLeft,
    streakRight,
    cardsSinceLastWin: 0,
    isResolvingTap: true,
    gameActive: winner === null,
    winner,
  };

  return {
    state: nextState,
    evaluation,
    scoringSide,
    tappedBy: side,
  };
}

export function finishTapResolution(state: RoundState): RoundState {
  if (!state.gameActive || state.winner !== null) {
    return {
      ...state,
      isResolvingTap: false,
    };
  }
  return {
    ...state,
    leftCard: null,
    rightCard: null,
    nextSide: 'left',
    isResolvingTap: false,
  };
}
