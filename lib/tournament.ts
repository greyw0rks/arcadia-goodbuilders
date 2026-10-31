export interface TournamentPlayer {
  id: string;
  eligibleXp: bigint;
}

export interface TournamentFunding {
  poolCap: bigint;
  projectContribution: bigint;
  sponsorContribution: bigint;
  entryFees: bigint;
  rewardShareBps: bigint;
  targetXp: bigint;
}

export interface TournamentAllocation {
  playerId: string;
  eligibleXp: bigint;
  amount: bigint;
}

export interface TournamentDistribution {
  fundedPool: bigint;
  distribution: bigint;
  totalEligibleXp: bigint;
  allocations: TournamentAllocation[];
  undistributed: bigint;
}

function min(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

export function calculateTournamentDistribution(
  funding: TournamentFunding,
  players: readonly TournamentPlayer[],
): TournamentDistribution {
  if ([funding.poolCap, funding.projectContribution, funding.sponsorContribution, funding.entryFees].some((value) => value < 0n)) throw new Error("Funding amounts cannot be negative");
  if (players.some((player) => player.eligibleXp < 0n) || new Set(players.map((player) => player.id.toLowerCase())).size !== players.length) throw new Error("Players must be unique with nonnegative XP");
  if (funding.rewardShareBps < 0n || funding.rewardShareBps > 10_000n) {
    throw new Error("rewardShareBps must be between 0 and 10000");
  }
  if (funding.targetXp <= 0n) {
    throw new Error("targetXp must be positive");
  }

  const entryReward = (funding.entryFees * funding.rewardShareBps) / 10_000n;
  const fundedPool = min(
    funding.poolCap,
    funding.projectContribution + funding.sponsorContribution + entryReward,
  );
  const eligible = players.filter((player) => player.eligibleXp > 0n);
  const totalEligibleXp = eligible.reduce((sum, player) => sum + player.eligibleXp, 0n);

  if (totalEligibleXp === 0n || fundedPool === 0n) {
    return {
      fundedPool,
      distribution: 0n,
      totalEligibleXp,
      allocations: eligible.map((player) => ({ playerId: player.id, eligibleXp: player.eligibleXp, amount: 0n })),
      undistributed: 0n,
    };
  }

  const progressXp = min(totalEligibleXp, funding.targetXp);
  const distribution = (fundedPool * progressXp) / funding.targetXp;
  const allocations = eligible
    .map((player) => ({
      playerId: player.id,
      eligibleXp: player.eligibleXp,
      amount: (distribution * player.eligibleXp) / totalEligibleXp,
    }))
    .toSorted((left, right) => left.playerId.localeCompare(right.playerId));
  const allocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0n);

  return {
    fundedPool,
    distribution,
    totalEligibleXp,
    allocations,
    undistributed: distribution - allocated,
  };
}
