# Six Seven - Ultimate Competitive Edition (TFM Videojuegos con IA)

Plan maestro de arquitectura, mecánicas competitivas y desarrollo de Inteligencia Artificial para transformar **Six Seven** en una obra sobresaliente de nivel Matrícula de Honor para el Trabajo de Fin de Máster (TFM) en Desarrollo de Videojuegos con IA. Integra la regla estricta de **Muerte Súbita con ventaja de 2 puntos**, un **Agente IA rival adaptativo con modelo cognitivo de latencia humana**, un **Panel de Telemetría y Analítica Neuro-Cognitiva**, y un **Sistema de Comentarista Dinámico (AI Shoutcaster)**.

---

## Decisiones Críticas y Resumen de Reglas

> [!IMPORTANT]
> **Regla de Muerte Súbita con Ventaja de 2 Puntos**:
> Al empatar a 2 puntos (2-2), el set no finaliza con el siguiente punto. Se activa automáticamente el modo **Muerte Súbita (Deuce / Ventaja)**. Para ganar el set o la partida, un jugador debe alcanzar al menos 3 puntos Y mantener una diferencia estricta de $\ge 2$ puntos respecto a su rival (ej. 4-2, 5-3, 6-4). Si la ventaja se reduce a 1 punto, el marcador vuelve al estado de "Ventaja", y si se iguala, vuelve a "Deuce", generando la máxima tensión competitiva.

- **Muerte Súbita y Match Point**: Marcador dinámico en tiempo real (`DEUCE`, `VENTAJA JUGADOR 1`, `VENTAJA JUGADOR 2`, `MATCH POINT`).
- **Rival de IA con Modelado Humano**: 3 perfiles de agente (Novato, Competitivo, Neuronal / Matrícula de Honor) basados en distribución de Poisson/Gaussiana para latencias de reacción realistas y probabilidad de picar en señuelos/trampas (7-6 invertido y bombas).
- **Panel de Telemetría Cognitiva**: Métricas de tiempo de reacción medio (ms), precisión de toma de decisiones frente a distractores, índice de impulsividad y mapa de calor de latencia.
- **AI Shoutcaster**: Locución reactiva mediante Web Speech Synthesis y síntesis de audio procedural (Web Audio API) para momentos de infarto (Muerte Súbita, Jackpots, y Remontadas).

---

## 1. Visión General y Concepto Académico (TFM)

### ¿Qué es Six Seven?
Six Seven es un videojuego de reflejos rápidos, discriminación visual y alta presión cognitiva en tiempo real. Dos carriles despliegan cartas numéricas y especiales a ritmo acelerado. Los jugadores compiten por ser el primero en pulsar cuando se produce una combinación canónica válida (6 a la izquierda y 7 a la derecha del mismo color, o cartas especiales designadas), mientras evitan trampas reflejas (7 a la izquierda y 6 a la derecha, o cartas bomba).

### Pilar de Investigación e Innovación en IA para el TFM
1. **Modelado Cognitivo de Oponentes Sintéticos**: Implementación de una arquitectura de agente reactivo que simula la atención selectiva, el tiempo de respuesta sensoriomotor humano (con latencia biológica entre 200ms y 650ms), y la fatiga o sesgo ante distractores visuales (efecto Stroop y patrones espejados 7-6).
2. **Sistema de Ajuste Dinámico de Dificultad (DDA)**: El agente ajusta su umbral de tolerancia y velocidad de procesamiento en función del desempeño del jugador humano para mantener el estado de *Flow* (teoría de Csíkszentmihályi).
3. **Telemetría y Evaluación Empírica**: Medición objetiva de variables psicométricas (latencia premotora, tasa de error tipo I y tipo II, resiliencia ante muerte súbita).

---

## 2. Experiencia de Usuario, Modos de Juego y Diseño Visual

### Modos de Juego
1. **Duelo Humano vs Humano (1v1 Local)**: En la misma pantalla o teclado (Teclas A/W/Espacio vs L/P/Enter/Flechas), con retroalimentación háptica y visual independiente.
2. **Duelo Humano vs Agente IA (Modo TFM)**:
   - *Novato (Heurístico simple)*: Latencia 650-800ms, 30% propensión al fallo en trampas 7-6.
   - *Competitivo (Modelo Pro)*: Latencia 420-550ms, 10% de fallo, alta prioridad en Jackpots.
   - *Neuronal / Matrícula de Honor (Agente Adaptativo DDA)*: Latencia 260-380ms, detección de ritmo, aprendizaje de los hábitos de pulsación del rival.
3. **Rey de la Pista (Torneo por Eliminación)**: Partidas continuas con retención de corona y registro de mejores rachas para grupos de amigos.

### Flujo de la Muerte Súbita
```
[ Marcador 2 - 2 ] ──> Activación "¡MUERTE SÚBITA - DIFERENCIA DE 2 PUNTOS!"
        │
        ├──> Jugador 1 anota ──> Marcador 3 - 2 ("VENTAJA JUGADOR 1 - MATCH POINT")
        │         │
        │         ├──> Jugador 1 anota ──> Marcador 4 - 2 ──> ¡VICTORIA DE SET! (Diferencia = 2)
        │         └──> Jugador 2 anota ──> Marcador 3 - 3 ──> ¡DEUCE / EMPATE! (Vuelve a buscar +2)
        │
        └──> Jugador 2 anota ──> Marcador 2 - 3 ("VENTAJA JUGADOR 2 - MATCH POINT")
                  │
                  ├──> Jugador 2 anota ──> Marcador 2 - 4 ──> ¡VICTORIA DE SET!
                  └──> Jugador 1 anota ──> Marcador 3 - 3 ──> ¡DEUCE!
```

### Identidad Visual y Estética Neo-Arcade
- **Paleta de Color de Alta Competición**: Fondo neutral profundo (`#0b0f19`), superficies estructurales de acrílico oscuro (`#161e2e`), acentos cian/oro para recompensas (`#00f5ff`, `#ffd700`) y carmesí de advertencia (`#ff0055`).
- **Tipografía y Legibilidad Deportiva**: Tipografía sans-serif geométrica enérgica con cifras tabulares fijas (`tabular-nums`) para cronómetros, latencias y marcadores sin saltos de maquetación.
- **Feedback Háptico y Visual**: Pantalla de impacto en fallos, ráfaga de confeti estéreo en Jackpots, y pulso de energía de borde durante la Muerte Súbita.

---

## 3. Decisiones Técnicas y de Diseño de Producto

### Decisión 1: Máquina de Estados Determinista e Inmutable
- **Problema previo**: Lag percibido o carreras de pulsación donde un jugador obtenía puntos de una combinación expirada.
- **Solución implementada y validada**: Consumo atómico inmediato de las cartas al pulsar (`leftCard = null; rightCard = null; isResolvingTap = true;`), bloqueo instantáneo de oyentes de teclado y táctil durante la resolución.
- **Extensión para Muerte Súbita**: Función pura `isSetWon(scoreA, scoreB)`:
  ```typescript
  function isSetWon(scoreA: number, scoreB: number): boolean {
    const minTarget = 3;
    const diff = Math.abs(scoreA - scoreB);
    const maxScore = Math.max(scoreA, scoreB);
    // Para ganar: tener al menos 3 puntos Y una diferencia de al menos 2 puntos
    return maxScore >= minTarget && diff >= 2;
  }
  ```

### Decisión 2: Simulación de IA sin Dependencias Pesadas
- **Enfoque elegido**: Agente autónomo modelado en JavaScript moderno ejecutado dentro del bucle de eventos (`requestAnimationFrame` / `setTimeout` cuantizado), simulando las tres fases de la neurobiología del tiempo de respuesta:
  1. *Percepción & Procesamiento Visual*: Latencia sensorial base ($t_{\text{sens}} \approx 100\text{-}150\text{ms}$).
  2. *Inferencia & Decisión Cognitiva*: Discriminación de patrones y cálculo de probabilidad de trampa ($t_{\text{cog}} \approx 120\text{-}250\text{ms}$).
  3. *Ejecución Motora*: Activación del actuador con dispersión gaussiana humana ($t_{\text{mot}} \approx 80\text{-}120\text{ms}$).

### Decisión 3: Panel de Telemetría TFM
- Registro en memoria de cada pulsación: `timestamp`, `combinación`, `resultado (éxito/fallo)`, `latencia_desde_aparición_ms`, `lado_pulsador`.
- Exportación o visualización en modal de la gráfica de rendimiento y distribución de tiempos de reacción.

---

## 4. Arquitectura del Sistema y Flujo de Datos

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DEL SISTEMA                        │
└────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────┐       ┌───────────────────────────┐
  │     BUCLE DE GENERACIÓN         │       │     ENTRADA DEL USUARIO   │
  │  (newCard, pickKind, delay)     │       │  (Táctil, Teclado A/L)    │
  └────────────────┬────────────────┘       └─────────────┬─────────────┘
                   │                                      │
                   ▼                                      ▼
  ┌─────────────────────────────────┐       ┌───────────────────────────┐
  │      ESTADO DEL TABLERO         │       │    AGENTE DE IA RIVAL     │
  │  leftCard | rightCard | colors  │◄─────►│ (Sensorial, DDA, Decisión)│
  └────────────────┬────────────────┘       └─────────────┬─────────────┘
                   │                                      │
                   ▼                                      ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │            ÁRBITRO ATÓMICO (tap -> checkWin -> evaluate)            │
  │   - Desactivación instantánea de cartas (Anti-Race Condition)       │
  │   - Cálculo de Muerte Súbita (|ScoreA - ScoreB| >= 2 && Max >= 3)   │
  │   - Actualización de Combo, Rachas y Registro de Telemetría         │
  └──────────────────────────────────┬──────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
  ┌─────────────────────────────────┐       ┌───────────────────────────┐
  │       FEEDBACK AUDIOVISUAL      │       │     TELEMETRÍA & TFM      │
  │  - Web Audio API (Swoosh/Hit)   │       │  - Historial de latencias │
  │  - SpeechSynthesis (Shoutcaster)│       │  - Error rate en trampas  │
  │  - Confeti, Shake, Flash CSS    │       │  - Resumen post-partida   │
  └─────────────────────────────────┘       └───────────────────────────┘
```

---

## 5. Plan Paso a Paso de Implementación

1. **Refactorización de la Regla de Muerte Súbita**:
   - Sustituir la comprobación fija `score >= 3` por la función matemática de ventaja de dos puntos (`diff >= 2 && maxScore >= 3`).
   - Crear el calculador de estado textual: `Ventaja [Nombre]`, `Deuce / Muerte Súbita`, `Punto de Partido`.
   - Modificar `updateMatchPointBanner()` para reflejar con exactitud la situación de tensión en el marcador.

2. **Agente Rival Inteligente (Modo Humano vs IA)**:
   - Añadir selector en el menú de inicio: `Modo Duelo 1v1 Local` vs `Modo Reto IA (TFM Edition)`.
   - Implementar el bucle de percepción del bot: al aparecer cada nueva carta, el bot calcula si la combinación es válida y programa su reacción humana simulada.
   - Ajustar los 3 perfiles de dificultad (Novato, Pro, Neuronal Adaptativo).

3. **Sistema de Comentarista Reactivo (AI Shoutcaster)**:
   - Integrar llamadas automáticas de voz sintetizada en los hitos clave: inicio de Muerte Súbita, ventaja conseguida, punto de partido crítico y victoria por 2 puntos de diferencia.

4. **Panel de Telemetría Cognitiva y Calificaciones TFM**:
   - Calcular milisegundos transcurridos desde que cae la carta ganadora hasta que el jugador pulsa.
   - Al terminar el set, mostrar un resumen con: Tiempo de Reacción Promedio (ms), Tasa de Acierto, Trampas Esquivadas y Valoración de Desempeño (e.g. *Nivel Esports / Sobresaliente*).

5. **Pruebas y Verificación**:
   - Validación de las reglas de 2-2, 3-2, 3-3, 4-2, 5-3 para asegurar que no hay desbordamiento ni finalización errónea.
   - Verificación de linting y compilación limpia.
