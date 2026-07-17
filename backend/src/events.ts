export enum ServerEvents {
  Greeting = 'greeting',
  Hello = 'hello',
  RpsPlay = 'rps:play',
  RpsResult = 'rps:result',
  OddOrEvenPlay = 'odd-or-even:play',
  OddOrEvenResult = 'odd-or-even:result',
  TruthOrDareStart = 'truth-or-dare:start',
  TruthOrDareChoice = 'truth-or-dare:choice',
  TruthOrDareUpdate = 'truth-or-dare:update',
  TruthOrDareResult = 'truth-or-dare:result',
  WouldYouRatherStart = 'would-you-rather:start',
  WouldYouRatherChoice = 'would-you-rather:choice',
  WouldYouRatherUpdate = 'would-you-rather:update',
  WouldYouRatherResult = 'would-you-rather:result',
  TwentyQuestionsStart = 'twenty-questions:start',
  TwentyQuestionsGuess = 'twenty-questions:guess',
  TwentyQuestionsUpdate = 'twenty-questions:update',
  TwentyQuestionsResult = 'twenty-questions:result',
  TwoTruthsOneLieSubmit = 'two-truths-one-lie:submit',
  TwoTruthsOneLieVote = 'two-truths-one-lie:vote',
  TwoTruthsOneLiePrompt = 'two-truths-one-lie:prompt',
  TwoTruthsOneLieResult = 'two-truths-one-lie:result',
  StartGame = 'start-game',
  GameStarted = 'game:started',
  RoomCreated = 'room:created',
  RoomUpdate = 'room:update',
  RoomError = 'room:error'
}

export enum ClientEvents {
  Connect = 'connection',
  Disconnect = 'disconnect',
  CreateRoom = 'create-room',
  JoinRoom = 'join-room',
  LeaveRoom = 'leave-room'
}
