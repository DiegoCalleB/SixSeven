import { useState, useEffect, useMemo } from 'react';
import { GameData, GameAction } from '../types';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/gameLogic';
import { collection, onSnapshot, query, orderBy, doc, where } from 'firebase/firestore';

export function useGameState(gameId: string | null) {
  const [game, setGame] = useState<GameData | null>(null);
  const [actions, setActions] = useState<GameAction[]>([]);
  
  useEffect(() => {
    if (!gameId) return;
    
    const unsubGame = onSnapshot(doc(db, 'games', gameId), (doc) => {
      if (doc.exists()) {
        setGame({ id: doc.id, ...doc.data() } as GameData);
      } else {
        setGame(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `games/${gameId}`));

    const q = query(
      collection(db, `games/${gameId}/actions`),
      where('playerIds', 'array-contains', auth.currentUser!.uid)
    );
    
    const unsubActions = onSnapshot(q, (snapshot) => {
      const parsedActions: GameAction[] = [];
      snapshot.forEach(doc => {
        // Exclude actions that don't have a valid createdAt timestamp yet (pending writes)
        // or just accept them. Since we need strict ordering, if it's pending, it might 
        // have null serverTimestamp. We can sort them at the end.
        parsedActions.push({ id: doc.id, ...doc.data() } as GameAction);
      });
      // Fallback sort for safety in case of null timestamps
      parsedActions.sort((a, b) => {
         const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
         const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
         return t1 - t2;
      });
      setActions(parsedActions);
    }, (error) => handleFirestoreError(error, OperationType.GET, `games/${gameId}/actions`));

    return () => {
      unsubGame();
      unsubActions();
    };
  }, [gameId]);

  // Derive state from actions
  const derivedState = useMemo(() => {
    let currentPile: GameAction[] = [];
    const scores: Record<string, number> = {};
    const penalties: Record<string, number> = {};

    for (const action of actions) {
        if (action.type === 'throw') {
            currentPile.unshift(action);
        } else if (action.type === 'smash') {
            // Validate smash
            if (currentPile.length >= 2) {
                const c1 = currentPile[0];
                const c2 = currentPile[1];
                const isSixSeven = (c1.cardValue === 6 && c2.cardValue === 7) || (c1.cardValue === 7 && c2.cardValue === 6);
                const isSamePattern = c1.pattern === c2.pattern;

                if (isSixSeven && isSamePattern) {
                    // Valid smash
                    scores[action.uid] = (scores[action.uid] || 0) + currentPile.length;
                    currentPile = []; // Clear pile
                } else {
                    // Glitch penalty
                    penalties[action.uid] = action.createdAt?.toMillis ? action.createdAt.toMillis() : Date.now();
                }
            } else {
                 // Invalid smash (not enough cards)
                 penalties[action.uid] = action.createdAt?.toMillis ? action.createdAt.toMillis() : Date.now();
            }
        }
    }

    return { currentPile, scores, penalties };
  }, [actions]);

  return { game, actions, derivedState };
}
