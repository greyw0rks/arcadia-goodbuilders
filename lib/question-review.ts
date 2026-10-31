import type { QuestionDefinition } from "./question-types";

// October 30 editorial corrections. Original question snapshots and the legacy
// daily bank remain intact; only newly selected games use these revisions.
export const QUESTION_REVIEW: Readonly<Record<string, Partial<QuestionDefinition>>> = {
  "linked-identity-count": {
    prompt: "A player finishes their first four tournament games of the UTC day, then switches to another wallet linked to the same GoodDollar identity. What is their next game's XP multiplier that day?",
    explanation: "Daily game counts belong to the verified identity. Switching linked wallets does not reset the count, so the first normal mixed game earns 75% of base XP.",
  },
  "boiling-water": {
    prompt: "At standard atmospheric pressure, at what temperature does pure water boil?",
  },
  "funded-rewards": {
    options: ["When XP is earned", "When a sponsor promises it", "After funding and published rules are confirmed", "Whenever a tournament opens"],
  },
  "celo-fee-currency": {
    options: ["The sender's recovery phrase", "The currency used to pay the transaction fee", "The recipient's bank account", "The token's market price"],
    explanation: "The feeCurrency field selects an eligible fee currency through its registered contract address, which can be an adapter.",
  },
  "light-year-distance": {
    prompt: "One light-year is about 9.46 trillion km. About how far away is a star 4 light-years from Earth?",
    options: ["2.365 trillion km", "13.46 trillion km", "94.6 trillion km", "37.84 trillion km"],
    answerIndex: 3,
    explanation: "Multiply the distance light travels in one year by four: 9.46 × 4 = 37.84 trillion km.",
  },
  "earth-mantle": {
    prompt: "Which seismic observation is evidence that Earth's outer core is liquid?",
    options: ["P-waves cannot pass through it", "S-waves cannot pass through it", "All waves stop at the crust", "P-waves and S-waves travel at the same speed"],
    answerIndex: 1,
    explanation: "S-waves cannot travel through liquids. Their absence through Earth's outer core supports its liquid state.",
  },
  "sound-fastest-medium": {
    prompt: "Sound travels at 340 m/s. An echo returns 0.5 seconds after a shout. How far away is the reflecting wall?",
    options: ["85 m", "170 m", "340 m", "680 m"], answerIndex: 0,
    explanation: "Sound travels to the wall and back: distance to the wall is 340 × 0.5 ÷ 2 = 85 metres.",
  },
  "decathlon-events": {
    prompt: "Which event is part of the men's outdoor decathlon?",
    options: ["Triple jump", "Pole vault", "3,000 m steeplechase", "100 m hurdles"], answerIndex: 1,
    explanation: "The decathlon includes pole vault. Its hurdles race is 110 metres, and it has neither triple jump nor steeplechase.",
  },
  "chess-knight": {
    prompt: "Which chess capture is available only immediately after an opposing pawn advances two squares from its starting square?",
    options: ["Castling", "Promotion", "A fork", "En passant"], answerIndex: 3,
    explanation: "En passant lets a correctly positioned pawn capture an adjacent pawn immediately after that pawn's two-square advance.",
  },
  "volleyball-indoor": {
    prompt: "In standard indoor volleyball, what is the target score in the deciding fifth set, before any extension for a two-point lead?",
    options: ["15 points", "21 points", "25 points", "11 points"], answerIndex: 0,
    explanation: "The deciding fifth set is played to 15 points, with a lead of at least two points required to win.",
  },
  "http-not-found": {
    prompt: "Which HTTP method is defined as idempotent but not safe?",
    options: ["PUT", "GET", "POST", "CONNECT"], answerIndex: 0,
    explanation: "Repeating the same PUT is intended to have the same effect as one PUT, but PUT can change server state, so it is not safe.",
  },
  "lossless-compression": {
    prompt: "What can a lossless compression method NOT guarantee for every possible input?",
    options: ["Exact recovery with the decoder", "An output shorter than the input", "Preserving all original information", "Reconstructing the original bytes"], answerIndex: 1,
    explanation: "Not every input can map to a shorter unique output. Some data stays the same size or grows under lossless compression.",
  },
};
