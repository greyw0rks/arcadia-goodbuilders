import { describe, expect, it } from "vitest";
import { calculateTournamentDistribution } from "../lib/tournament";

describe("calculateTournamentDistribution", () => {
  it("caps the funded pool and scales distribution by eligible XP", () => {
    const result = calculateTournamentDistribution(
      {
        poolCap: 1_000n,
        projectContribution: 800n,
        sponsorContribution: 500n,
        entryFees: 400n,
        rewardShareBps: 5_000n,
        targetXp: 10_000n,
      },
      [
        { id: "ada", eligibleXp: 2_000n },
        { id: "kola", eligibleXp: 4_000n },
      ],
    );

    expect(result.fundedPool).toBe(1_000n);
    expect(result.distribution).toBe(600n);
    expect(result.allocations).toEqual([
      { playerId: "ada", eligibleXp: 2_000n, amount: 200n },
      { playerId: "kola", eligibleXp: 4_000n, amount: 400n },
    ]);
    expect(result.undistributed).toBe(0n);
  });

  it("never allocates more than the calculated distribution", () => {
    const result = calculateTournamentDistribution(
      {
        poolCap: 101n,
        projectContribution: 101n,
        sponsorContribution: 0n,
        entryFees: 0n,
        rewardShareBps: 0n,
        targetXp: 3n,
      },
      [
        { id: "one", eligibleXp: 1n },
        { id: "two", eligibleXp: 1n },
        { id: "three", eligibleXp: 1n },
      ],
    );

    const allocated = result.allocations.reduce((sum, item) => sum + item.amount, 0n);
    expect(allocated + result.undistributed).toBe(result.distribution);
    expect(allocated).toBeLessThanOrEqual(result.distribution);
  });

  it("distributes nothing when no player has eligible XP", () => {
    const result = calculateTournamentDistribution(
      {
        poolCap: 1_000n,
        projectContribution: 1_000n,
        sponsorContribution: 0n,
        entryFees: 0n,
        rewardShareBps: 0n,
        targetXp: 10_000n,
      },
      [{ id: "guest", eligibleXp: 0n }],
    );

    expect(result.distribution).toBe(0n);
    expect(result.allocations).toEqual([]);
  });
});
