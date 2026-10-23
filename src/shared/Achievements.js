export const ACHIEVEMENTS_STORAGE_KEY = "wits-commute-achievements-v1";
export const SPEEDRUN_SECONDS = 300;

export const ACHIEVEMENTS = Object.freeze([
  { id: "buff-out", title: "That’ll Buff Out", description: "Finish Level 1 with less than 10% vehicle condition.", label: "PARK", number: "01" },
  { id: "academic-comeback", title: "Academic Comeback", description: "Finish Level 3 after suspicion has reached 90%.", label: "CHEAT", number: "02" },
  { id: "ordinary-tuesday", title: "An Ordinary Tuesday", description: "Complete all three levels without failing or restarting. Unshielded traffic hits count as failures.", label: "JOURNEY", number: "03" },
  { id: "its-756", title: "It’s 7:56!", description: "Complete a full journey in under 5 minutes of active play, including retries.", label: "SPEEDRUN", number: "04" },
  { id: "secret-ending", title: "You Can’t Park There", description: "Discover the secret ending in Level 1.", label: "SECRET", number: "05", hidden: true },
  {"id":"between-lines","title":"Between the Lines","description":"Park successfully.","label":"PARK","number":"06"},
  {"id":"showroom","title":"Showroom Condition","description":"Finish Level 1 without taking damage.","label":"PARK","number":"07"},
  {"id":"insurance","title":"We Have Insurance, Right?","description":"Fail Level 1 for the first time.","label":"PARK","number":"08"},
  {"id":"mind-gap","title":"Mind the Gap","description":"Complete Level 2 without being hit.","label":"CROSS","number":"09"},
  {"id":"vida-regular","title":"Vida Regular","description":"Collect every Vida cup in one attempt.","label":"CROSS","number":"10"},
  {"id":"campus-spirit","title":"Campus Spirit","description":"Get greeted by the Wits Shark, both kudus and the Wits Bot.","label":"CAMPUS","number":"11"},
  {"id":"student-support","title":"Student Support Speedrun","description":"Complete both NPC surveys.","label":"CROSS","number":"12"},
  {"id":"look-both-ways","title":"Look Both Ways","description":"Finish Level 2 without a Red Cappuccino shield save.","label":"CROSS","number":"13"},
  {"id":"nothing-to-see","title":"Nothing to See Here","description":"Finish Level 3 without suspicion reaching 50%.","label":"CHEAT","number":"14"},
  {"id":"first-time-pass","title":"First-Time Pass","description":"Finish Level 3 without submitting a wrong answer.","label":"CHEAT","number":"15"},
  {"id":"under-nose","title":"Under His Nose","description":"Submit a correct answer while the tutor can see you.","label":"CHEAT","number":"16"},
  {"id":"last-minute","title":"Last-Minute Submission","description":"Finish Level 3 with fewer than five seconds remaining.","label":"CHEAT","number":"17"},
  {"id":"made-it","title":"Made It to Wits","description":"Complete the full journey.","label":"JOURNEY","number":"18"}
]);

// Owns achievement rules and persistence; levels only report their results.
export class Achievements {
  constructor({ storage, onUnlock = () => {}, now = Date.now } = {}) {
    this.onUnlock = onUnlock;
    this.now = now;
    this.unlocked = {};
    this.run = null;
    this.storageAvailable = true;
    try {
      this.storage = storage === undefined ? globalThis.localStorage : storage;
      if (!this.storage) this.storageAvailable = false;
      const saved = JSON.parse(this.storage?.getItem(ACHIEVEMENTS_STORAGE_KEY) ?? "null");
      for (const { id } of ACHIEVEMENTS) {
        if (Number.isFinite(saved?.[id]) && saved[id] > 0) this.unlocked[id] = saved[id];
      }
    } catch {
      // Damaged saves and blocked browser storage must never stop the game.
      this.storageAvailable = false;
    }
  }

  startRun() {
    this.run = { nextLevel: 1, seconds: 0, failures: 0, greetings: new Set() };
  }

  endRun() {
    this.run = null;
  }

  resetProgress() {
    // Write before clearing memory so a storage error can be reported honestly.
    this.storage?.setItem(ACHIEVEMENTS_STORAGE_KEY, "{}");
    this.unlocked = {};
    this.endRun();
  }

  addPlayTime(seconds) {
    if (this.run && Number.isFinite(seconds) && seconds > 0) this.run.seconds += seconds;
  }

  recordFailure(levelNumber) {
    if (this.run) {
      this.run.failures += 1;
      if (levelNumber === 1) this.unlock('insurance');
    }
  }

  unlock(id) {
    const achievement = ACHIEVEMENTS.find((entry) => entry.id === id);
    if (!achievement || this.unlocked[id]) return;
    this.unlocked[id] = this.now();
    try {
      this.storage?.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(this.unlocked));
      this.storageAvailable = Boolean(this.storage);
    } catch {
      this.storageAvailable = false;
    }
    this.onUnlock(achievement);
  }

  recordGreeting(id) {
    if (!this.run) return;
    this.run.greetings.add(id);
    if (["shark", "Kudu Sis", "Kudu Bro", "robot"].every(key => this.run.greetings.has(key))) this.unlock("campus-spirit");
  }

  recordSurveys(kinds) {
    if (this.run && kinds.has("psychQuizzer") && kinds.has("ccduAdvisor")) this.unlock("student-support");
  }

  recordCorrectAnswer(tutorCanSee) {
    if (this.run && tutorCanSee) this.unlock("under-nose");
  }

  completeLevel(levelNumber, performance = {}) {
    if (!this.run) return;
    // Only an uninterrupted, ordered Level 1 -> 2 -> 3 journey qualifies.
    if (levelNumber !== this.run.nextLevel) {
      this.endRun();
      return;
    }
    this.run.nextLevel += 1;
    if (levelNumber === 1) {
      this.unlock("between-lines");
      if (performance.condition === 100) this.unlock("showroom");
    }
    if (levelNumber === 2) {
      if (performance.impacts === 0) this.unlock("mind-gap");
      if (performance.cupsTotal > 0 && performance.cupsCollected === performance.cupsTotal) this.unlock("vida-regular");
      if (performance.shieldSaves === 0) this.unlock("look-both-ways");
    }
    if (levelNumber === 1 && performance.condition > 0 && performance.condition < 10) {
      this.unlock("buff-out");
    }
    if (levelNumber === 3) {
      this.unlock("made-it");
      if (performance.peakSuspicion < 50) this.unlock("nothing-to-see");
      if (performance.incorrectAnswers === 0) this.unlock("first-time-pass");
      if (performance.timeRemaining >= 0 && performance.timeRemaining < 5) this.unlock("last-minute");
      if (performance.peakSuspicion >= 90 && performance.peakSuspicion < 100 && performance.suspicion < 100) {
        this.unlock("academic-comeback");
      }
      if (this.run.failures === 0) this.unlock("ordinary-tuesday");
      if (this.run.seconds < SPEEDRUN_SECONDS) this.unlock("its-756");
      this.endRun();
    }
  }

  completeSecretEnding(levelNumber) {
    if (this.run?.nextLevel === 1 && levelNumber === 1) this.unlock("secret-ending");
    this.endRun();
  }
}
