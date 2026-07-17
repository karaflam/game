export const ClientEvents = {
  CreateRoom: 'create-room',
  JoinRoom: 'join-room',
  LeaveRoom: 'leave-room',
  RpsPlay: 'rps:play',
  OddOrEvenPlay: 'odd-or-even:play',
  TruthOrDareStart: 'truth-or-dare:start',
  TruthOrDareChoice: 'truth-or-dare:choice',
  WouldYouRatherStart: 'would-you-rather:start',
  WouldYouRatherChoice: 'would-you-rather:choice',
  TwentyQuestionsStart: 'twenty-questions:start',
  TwentyQuestionsGuess: 'twenty-questions:guess',
  TwoTruthsOneLieSubmit: 'two-truths-one-lie:submit',
  TwoTruthsOneLieVote: 'two-truths-one-lie:vote',
  StartGame: 'start-game'
} as const;

export const ServerEvents = {
  Greeting: 'greeting',
  Hello: 'hello',
  RoomCreated: 'room:created',
  RoomUpdate: 'room:update',
  RoomError: 'room:error',
  RpsResult: 'rps:result',
  OddOrEvenResult: 'odd-or-even:result',
  TruthOrDareUpdate: 'truth-or-dare:update',
  TruthOrDareResult: 'truth-or-dare:result',
  WouldYouRatherUpdate: 'would-you-rather:update',
  WouldYouRatherResult: 'would-you-rather:result',
  TwentyQuestionsUpdate: 'twenty-questions:update',
  TwentyQuestionsResult: 'twenty-questions:result',
  TwoTruthsOneLiePrompt: 'two-truths-one-lie:prompt',
  TwoTruthsOneLieResult: 'two-truths-one-lie:result',
  GameStarted: 'game:started'
} as const;
