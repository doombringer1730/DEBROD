// Homework Arcade: students earn coins for turning in missing and due
// assignments, then spend them on arcade games.

const COINS_ON_TIME = 10;  // turned in by the due date
const COINS_LATE = 5;      // turned in after it went missing
const COST_PER_PLAY = 3;
const GAMES = ['snake', 'breakout'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Homework Arcade')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Placeholder assignments are used until the script property USE_VERACROSS
// is set to "true".
function usingVeracross_() {
  return PropertiesService.getScriptProperties().getProperty('USE_VERACROSS') === 'true';
}

function currentEmail_() {
  const email = Session.getActiveUser().getEmail();
  if (!email) throw new Error('Sign in with your school Google account to use Homework Arcade.');
  return email.toLowerCase();
}

// Each student's record is one script property:
//   coins    current balance
//   open     ids of assignments seen here while still missing or due
//   claimed  ids already paid out (and how much), so nothing pays twice
//   demo     placeholder assignments marked turned in, with the date
function load_(email) {
  const raw = PropertiesService.getScriptProperties().getProperty('student:' + email);
  const s = raw ? JSON.parse(raw) : {};
  return { coins: s.coins || 0, open: s.open || {}, claimed: s.claimed || {}, demo: s.demo || {} };
}

function save_(email, s) {
  PropertiesService.getScriptProperties().setProperty('student:' + email, JSON.stringify(s));
}

// Runs fn on the signed-in student's record under a lock, then saves it.
function withStudent_(fn) {
  const email = currentEmail_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const s = load_(email);
    const result = fn(s, email);
    save_(email, s);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function isoDay_(offset) {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0));
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Every assignment is { id, title, className, dueDate, status, late }, where
// status is 'missing', 'due' or 'turned_in', and late is true when it was
// turned in after the due date.
function assignmentsFor_(email, s) {
  return usingVeracross_() ? veracrossAssignments_(email) : demoAssignments_(s);
}

function demoAssignments_(s) {
  const today = isoDay_();
  return [
    { id: 'demo-1', title: 'Chapter 4 reading questions', className: 'English', dueDate: isoDay_(-3) },
    { id: 'demo-2', title: 'Fractions worksheet', className: 'Math', dueDate: isoDay_(-1) },
    { id: 'demo-3', title: 'Plant growth lab report', className: 'Science', dueDate: isoDay_(2) },
    { id: 'demo-4', title: 'Vocabulary practice', className: 'Spanish', dueDate: isoDay_(5) },
  ].map(a => {
    const turnedIn = s.demo[a.id];
    if (turnedIn) return Object.assign(a, { status: 'turned_in', late: turnedIn > a.dueDate });
    return Object.assign(a, { status: a.dueDate < today ? 'missing' : 'due', late: false });
  });
}

// Filled in once the Veracross keys work (see veracross.gs).
function veracrossAssignments_(email) {
  throw new Error("Veracross isn't connected yet. Remove USE_VERACROSS from Script Properties to use placeholder assignments.");
}

// Pays for assignments that were missing or due when the student saw them
// here and are now turned in, so work finished before joining doesn't pay.
// Returns the coins just earned.
function payOut_(s, assignments) {
  let earned = 0;
  for (const a of assignments) {
    if (s.claimed[a.id]) continue;
    if (a.status !== 'turned_in') {
      s.open[a.id] = true;
      continue;
    }
    if (!s.open[a.id]) continue;
    const coins = a.late ? COINS_LATE : COINS_ON_TIME;
    s.claimed[a.id] = coins;
    delete s.open[a.id];
    s.coins += coins;
    earned += coins;
  }
  return earned;
}

function state_(email, s, assignments, earned) {
  return {
    email: email,
    coins: s.coins,
    earned: earned,
    costPerPlay: COST_PER_PLAY,
    demo: !usingVeracross_(),
    assignments: assignments.map(a => Object.assign({}, a, {
      paid: s.claimed[a.id] || 0,
      reward: a.status === 'missing' ? COINS_LATE : COINS_ON_TIME,
    })),
  };
}

function refresh_(s, email) {
  const assignments = assignmentsFor_(email, s);
  const earned = payOut_(s, assignments);
  return state_(email, s, assignments, earned);
}

// Called by the page.

function getState() {
  return withStudent_(refresh_);
}

// Placeholder mode only: pretends the student turned an assignment in today.
function demoTurnIn(id) {
  if (usingVeracross_()) throw new Error('Turn assignments in through Veracross.');
  if (!/^demo-\d+$/.test(id)) throw new Error('Unknown assignment.');
  return withStudent_((s, email) => {
    s.demo[id] = s.demo[id] || isoDay_();
    return refresh_(s, email);
  });
}

// Placeholder mode only: starts the signed-in student over at 0 coins.
function demoReset() {
  if (usingVeracross_()) throw new Error('Only available with placeholder assignments.');
  return withStudent_((s, email) => {
    s.coins = 0;
    s.open = {};
    s.claimed = {};
    s.demo = {};
    return refresh_(s, email);
  });
}

function startGame(gameId) {
  if (GAMES.indexOf(gameId) < 0) throw new Error('Unknown game.');
  return withStudent_(s => {
    if (s.coins < COST_PER_PLAY) return { ok: false, coins: s.coins };
    s.coins -= COST_PER_PLAY;
    return { ok: true, coins: s.coins };
  });
}
