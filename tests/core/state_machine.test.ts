import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCore, type MatchConfig } from '@core/simulation/SimulationCore';

function makeConfig(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return {
    seed: 'sm-test-seed',
    teams: [
      {
        id: 't1',
        name: 'Garlic Gang',
        color: 0xff4400,
        controllerType: 'human',
        characterNames: ['Minty', 'Bud'],
      },
      {
        id: 't2',
        name: 'Onion Crew',
        color: 0x4488ff,
        controllerType: 'human',
        characterNames: ['Shallot', 'Leek'],
      },
    ],
    worldWidth: 500,
    worldHeight: 200,
    turnDuration: 45,
    retreatDuration: 5,
    friendlyFire: true,
    ...overrides,
  };
}

describe('SimulationCore creation', () => {
  it('creates a match without throwing', () => {
    expect(() => SimulationCore.createMatch(makeConfig())).not.toThrow();
  });

  it('initial state has two alive teams', () => {
    const sim = SimulationCore.createMatch(makeConfig());
    const state = sim.getState();
    expect(state.teams).toHaveLength(2);
    expect(state.teams.every((t) => t.alive)).toBe(true);
  });

  it('initial state is TURN_INTRO', () => {
    const sim = SimulationCore.createMatch(makeConfig());
    expect(sim.getState().turnState).toBe('TURN_INTRO');
  });

  it('all characters start alive with 100 hp', () => {
    const sim = SimulationCore.createMatch(makeConfig());
    const state = sim.getState();
    for (const team of state.teams) {
      for (const char of team.characters) {
        expect(char.alive).toBe(true);
        expect(char.health).toBe(100);
      }
    }
  });
});

describe('SimulationCore step — turn progression', () => {
  let sim: SimulationCore;

  beforeEach(() => {
    sim = SimulationCore.createMatch(makeConfig());
  });

  it('stepping through TURN_INTRO transitions to AIMING', () => {
    // TURN_INTRO lasts 0.5s; step just past it — now goes to AIMING (bazooka auto-selected)
    for (let i = 0; i < 40; i++) sim.step(1 / 60, []);
    expect(sim.getState().turnState).toBe('AIMING');
  });

  it('EndTurn command in AIMING transitions to RETREAT', () => {
    // advance past TURN_INTRO
    for (let i = 0; i < 40; i++) sim.step(1 / 60, []);
    expect(sim.getState().turnState).toBe('AIMING');

    sim.step(1 / 60, [{ type: 'EndTurn' }]);
    expect(sim.getState().turnState).toBe('RETREAT');
  });

  it('TurnStarted event is emitted on entering TURN_INTRO', () => {
    const events: string[] = [];
    sim.on('TurnStarted', () => events.push('TurnStarted'));

    // First step should emit TurnStarted
    sim.step(1 / 60, []);
    expect(events).toContain('TurnStarted');
  });

  it('turn timer decrements in AIMING', () => {
    for (let i = 0; i < 40; i++) sim.step(1 / 60, []); // pass TURN_INTRO
    const before = sim.getState().turnTimeRemaining;
    sim.step(1 / 60, []);
    expect(sim.getState().turnTimeRemaining).toBeLessThan(before);
  });

  it('after retreat expires, world settling begins', () => {
    // advance to AIMING
    for (let i = 0; i < 40; i++) sim.step(1 / 60, []);
    // end turn
    sim.step(1 / 60, [{ type: 'EndTurn' }]);
    expect(sim.getState().turnState).toBe('RETREAT');

    // step through the full 5s retreat + some settling
    for (let i = 0; i < 360; i++) sim.step(1 / 60, []);

    // Should be past RETREAT by now
    const state = sim.getState().turnState;
    const postRetreatStates: string[] = [
      'WORLD_SETTLING',
      'DAMAGE_PRESENTATION',
      'DEATH_SEQUENCES',
      'VICTORY_CHECK',
      'NEXT_TEAM',
      'TURN_INTRO',
      'MOVEMENT',
    ];
    expect(postRetreatStates).toContain(state);
  });
});

describe('SimulationCore events', () => {
  it('on() returns an unsubscribe function that works', () => {
    const sim = SimulationCore.createMatch(makeConfig());
    const events: string[] = [];
    const off = sim.on('TurnStarted', () => events.push('fired'));

    sim.step(1 / 60, []);
    expect(events).toHaveLength(1);

    off(); // unsubscribe

    // Advance to next turn to get another TurnStarted
    for (let i = 0; i < 400; i++) sim.step(1 / 60, []);
    // Should still be 1 — unsubscribe worked
    expect(events).toHaveLength(1);
  });
});
