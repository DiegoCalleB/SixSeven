import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {
  CardItem,
  CARD_COLORS,
  CardKind,
  createInitialRoundState,
  evaluateBoard,
  checkSetVictory,
  getMatchStatusBanner,
  advanceTurnCard,
  resolvePlayerTap,
  finishTapResolution,
} from './lib/sixSevenEngine';

const makeCard = (
  num: number,
  color: CardItem['color'] = 'lime',
  kind: CardItem['kind'] = 'normal',
  turnDealt = 1
): CardItem => ({
  id: `test-${num}-${color}-${kind}-${turnDealt}`,
  num,
  color,
  kind,
  turnDealt,
});

function createIndexHtmlSandbox() {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!scriptMatch) {
    throw new Error('No se encontró el bloque <script> principal en index.html');
  }

  const elements: Record<string, any> = {};
  const getEl = (id: string) => {
    if (!elements[id]) {
      const classes = new Set<string>();
      elements[id] = {
        id,
        textContent: '',
        innerHTML: '',
        value: '',
        style: {},
        offsetWidth: 100,
        className: '',
        classList: {
          add: (...cls: string[]) => cls.forEach((c) => classes.add(c)),
          remove: (...cls: string[]) => cls.forEach((c) => classes.delete(c)),
          toggle: (c: string, force?: boolean) => {
            if (force === undefined) {
              if (classes.has(c)) classes.delete(c);
              else classes.add(c);
            } else if (force) {
              classes.add(c);
            } else {
              classes.delete(c);
            }
          },
          contains: (c: string) => classes.has(c),
        },
        addEventListener: () => {},
        appendChild: () => {},
      };
    }
    return elements[id];
  };

  const sandbox: any = {
    window: {
      addEventListener: () => {},
      speechSynthesis: {
        getVoices: () => [],
        cancel: () => {},
        speak: () => {},
      },
    },
    document: {
      getElementById: (id: string) => getEl(id),
      querySelectorAll: () => [],
      createElement: () => getEl('dynamic'),
    },
    performance: { now: () => Date.now() },
    SpeechSynthesisUtterance: function (this: any, txt: string) {
      this.text = txt;
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 2,
    clearInterval: () => {},
    Math,
    console,
  };
  sandbox.window.document = sandbox.document;

  vm.createContext(sandbox);
  const instrumentedScript =
    scriptMatch[1] +
    `\n;globalThis.__api = {
      getState: () => ({
        mode, aiDifficulty, leftCard, rightCard, nextSide,
        scoreLeft, scoreRight, streakLeft, streakRight,
        targetPoints, gameActive, isResolvingTap, cardsSinceLastWin,
        dealTimer, aiTimer, countdownTimer, resolveTimer
      }),
      setState: (patch) => {
        if ('leftCard' in patch) leftCard = patch.leftCard;
        if ('rightCard' in patch) rightCard = patch.rightCard;
        if ('nextSide' in patch) nextSide = patch.nextSide;
        if ('scoreLeft' in patch) scoreLeft = patch.scoreLeft;
        if ('scoreRight' in patch) scoreRight = patch.scoreRight;
        if ('gameActive' in patch) gameActive = patch.gameActive;
        if ('isResolvingTap' in patch) isResolvingTap = patch.isResolvingTap;
        if ('cardsSinceLastWin' in patch) cardsSinceLastWin = patch.cardsSinceLastWin;
        if ('mode' in patch) mode = patch.mode;
      },
      COLORS,
      checkWin,
      checkSetWinner,
      newCard,
      tap,
      goHome,
      pickKind,
      toggleWildcardOption,
      getWildcardEnabled: () => wildcardEnabled
    };`;

  vm.runInContext(instrumentedScript, sandbox);
  return { html, api: sandbox.__api, elements };
}

describe('SixSeven — Reglas Puras (+1 Punto, Sin Dobles Puntos ni Cartas Raras)', () => {
  it('valida únicamente 6 a la izquierda y 7 a la derecha del mismo color y siempre suma +1 punto', () => {
    for (const c of CARD_COLORS) {
      const res = evaluateBoard(makeCard(6, c.id), makeCard(7, c.id));
      expect(res.valid).toBe(true);
      expect(res.points).toBe(1);
      expect(res.reason).toBe('six_seven');
    }
  });

  it('RECHAZA SIEMPRE 7 a la izquierda y 6 a la derecha bajo cualquier combinación de colores o comodín', () => {
    const kinds: CardKind[] = ['normal', 'rainbow'];
    for (const cLeft of CARD_COLORS) {
      for (const cRight of CARD_COLORS) {
        for (const kLeft of kinds) {
          for (const kRight of kinds) {
            const left = makeCard(7, cLeft.id, kLeft);
            const right = makeCard(6, cRight.id, kRight);
            const res = evaluateBoard(left, right);
            expect(res.valid).toBe(false);
            expect(res.reason).toBe('trap_7_6');
          }
        }
      }
    }
  });

  it('RECHAZA 6 a la izquierda y 7 a la derecha si son de distinto color y sin comodín', () => {
    for (const cLeft of CARD_COLORS) {
      for (const cRight of CARD_COLORS) {
        if (cLeft.id === cRight.id) continue;
        const res = evaluateBoard(makeCard(6, cLeft.id, 'normal'), makeCard(7, cRight.id, 'normal'));
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('wrong_color');
      }
    }
  });

  it('RECHAZA SIEMPRE cartas con el mismo número (6-6 o 7-7)', () => {
    const kinds: CardKind[] = ['normal', 'rainbow'];
    for (const num of [6, 7]) {
      for (const k1 of kinds) {
        for (const k2 of kinds) {
          const res = evaluateBoard(makeCard(num, 'lime', k1), makeCard(num, 'lime', k2));
          expect(res.valid).toBe(false);
          expect(res.reason).toBe('same_number');
        }
      }
    }
  });

  it('RECHAZA pulsar cuando solo hay 1 carta en la mesa', () => {
    expect(evaluateBoard(makeCard(6, 'lime', 'normal'), null).valid).toBe(false);
    expect(evaluateBoard(makeCard(6, 'lime', 'normal'), null).reason).toBe('incomplete');
    expect(evaluateBoard(null, makeCard(7, 'lime', 'normal')).valid).toBe(false);
    expect(evaluateBoard(null, makeCard(7, 'lime', 'normal')).reason).toBe('incomplete');
  });
});

describe('SixSeven — Simulación Monte Carlo (5.000 turnos) y Consumo Atómico', () => {
  it('simulación de 5.000 turnos: nunca valida un 7-6, nunca da más de 1 punto y nunca entra en bucle', () => {
    let state = createInitialRoundState(5, false);
    for (let i = 0; i < 5000; i++) {
      state = advanceTurnCard(state);
      const ev = evaluateBoard(state.leftCard, state.rightCard);
      expect(ev.points).toBe(1);

      if (state.leftCard && state.rightCard && state.leftCard.num === 7 && state.rightCard.num === 6) {
        expect(ev.valid).toBe(false);
        expect(ev.reason).toBe('trap_7_6');
      }
      expect(state.cardsSinceLastWin).toBeLessThanOrEqual(5);
    }
  });

  it('impide conseguir varios puntos con la misma jugada y penaliza al rival si se falla un 7-6', () => {
    let state = createInitialRoundState(5, false);
    state = advanceTurnCard(state, makeCard(7, 'lime', 'normal', 1));
    state = advanceTurnCard(state, makeCard(6, 'lime', 'normal', 2));

    const badTap = resolvePlayerTap(state, 'left');
    expect(badTap.evaluation?.valid).toBe(false);
    expect(badTap.evaluation?.reason).toBe('trap_7_6');
    expect(badTap.scoringSide).toBe('right');
    expect(badTap.state.scoreLeft).toBe(0);
    expect(badTap.state.scoreRight).toBe(1);
    expect(badTap.state.leftCard).toBeNull();
    expect(badTap.state.rightCard).toBeNull();

    const duplicateTap = resolvePlayerTap(badTap.state, 'right');
    expect(duplicateTap.evaluation).toBeNull();
    expect(duplicateTap.state.scoreRight).toBe(1);

    state = finishTapResolution(badTap.state);
    expect(state.isResolvingTap).toBe(false);
  });
});

describe('SixSeven — Partidas a 5 Puntos y Muerte Súbita en Empate 4-4', () => {
  it('no termina la partida con 3 puntos; gana al llegar a 5 con ventaja de >= 2 (5-0, 5-1, 5-2, 5-3)', () => {
    expect(checkSetVictory(3, 0, 5)).toBeNull();
    expect(checkSetVictory(4, 2, 5)).toBeNull();
    expect(checkSetVictory(5, 0, 5)).toBe('left');
    expect(checkSetVictory(5, 3, 5)).toBe('left');
    expect(checkSetVictory(2, 5, 5)).toBe('right');
  });

  it('en empate 4-4 activa Muerte Súbita y obliga a ganar por 2 puntos de ventaja (6-4, 7-5, 8-6)', () => {
    expect(getMatchStatusBanner(4, 4, 'J1', 'J2', 5).type).toBe('deuce');
    expect(checkSetVictory(5, 4, 5)).toBeNull();
    expect(checkSetVictory(4, 5, 5)).toBeNull();
    expect(getMatchStatusBanner(5, 4, 'J1', 'J2', 5).type).toBe('advantage');

    expect(checkSetVictory(5, 5, 5)).toBeNull();
    expect(checkSetVictory(6, 5, 5)).toBeNull();
    expect(checkSetVictory(6, 4, 5)).toBe('left');
    expect(checkSetVictory(4, 6, 5)).toBe('right');
    expect(checkSetVictory(7, 5, 5)).toBe('left');
  });
});

describe('SixSeven — Verificación Directa del DOM y Motor en /index.html', () => {
  it('juega a 5 puntos, sin dobles puntos ni bombas/jackpots y con Comodín OFF por defecto', () => {
    const { html, api } = createIndexHtmlSandbox();
    expect(html.toUpperCase()).not.toContain('BUSCA EL 6');
    expect(html.toUpperCase()).not.toContain('BUSCA EL 7');
    expect(html).toContain('SIX SEVEN<span class="sparkle">✨</span>');
    expect(api.getState().targetPoints).toBe(5);
    expect(api.getWildcardEnabled()).toBe(false);

    // Con Comodín OFF por defecto, pickKind() siempre devuelve 'normal'
    for (let i = 0; i < 300; i++) {
      expect(api.pickKind()).toBe('normal');
    }
  });

  it('el motor embebido en index.html rechaza SIEMPRE el 7-6, da siempre 1 punto y supera 5.000 repartos seguidos', () => {
    const { api } = createIndexHtmlSandbox();
    api.setState({ gameActive: true, isResolvingTap: false });

    for (const c1 of api.COLORS) {
      for (const c2 of api.COLORS) {
        for (const k1 of ['normal', 'rainbow']) {
          for (const k2 of ['normal', 'rainbow']) {
            api.setState({
              leftCard: { num: 7, color: c1, kind: k1 },
              rightCard: { num: 6, color: c2, kind: k2 },
            });
            const res = api.checkWin();
            expect(res.valid).toBe(false);
            expect(res.reason).toBe('trap_7_6');
            expect(res.pts).toBe(1);
          }
        }
      }
    }

    api.setState({
      leftCard: null,
      rightCard: null,
      nextSide: 'left',
      cardsSinceLastWin: 0,
      gameActive: true,
      isResolvingTap: false,
    });

    for (let i = 0; i < 5000; i++) {
      api.newCard();
      const st = api.getState();
      const res = api.checkWin();
      expect(res.pts).toBe(1);

      if (st.leftCard && st.rightCard && st.leftCard.num === 7 && st.rightCard.num === 6) {
        expect(res.valid).toBe(false);
        expect(res.reason).toBe('trap_7_6');
      }
      expect(st.cardsSinceLastWin).toBeLessThanOrEqual(5);
    }
  });
});
