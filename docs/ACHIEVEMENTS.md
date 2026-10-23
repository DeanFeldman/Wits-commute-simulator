# Achievements

Open **Achievements** from the main menu. The collection shows 18 badges,
an earned count, and a hidden description for the secret ending. Unlocks show
a queued notification and save to `wits-commute-achievements-v1` in the current
browser. If storage is blocked, gameplay and session-only unlocks still work.

| Badge | Rule |
| --- | --- |
| That'll Buff Out | Successfully park with condition strictly above 0 and below 10. |
| Academic Comeback | Complete Level 3 with an attempt peak of at least 90 suspicion, below 100. |
| An Ordinary Tuesday | Complete Levels 1, 2 and 3 in order without a failed attempt, manual restart, or unshielded Level 2 hit. Shield saves do not count as failures. |
| It's 7:56! | Complete Levels 1, 2 and 3 in order in strictly less than 300 seconds of active play. Retried attempts count toward time. |
| You Can't Park There | Trigger Level 1's existing secret ending. Hidden until earned; does not count as completing the full journey. |

Only a full journey started through **Begin Journey** can earn badges.
Practice/developer level launches and sample results cannot earn them. Leaving
for the main menu ends the current attempt at journey achievements, but keeps
earned badges. Reloading does not resume an unfinished journey.

`src/shared/Achievements.js` owns rules, run progress and saving.
`src/ui/AchievementsUI.js` owns the dialog and notification queue. `Game.js`
forwards lifecycle events and active play time; it contains no badge rules.
Level 3 reports peak suspicion and Level 2 reports unshielded checkpoint hits.
The existing parking result already supplies vehicle condition.

Active time excludes pauses, loading, transitions, tutorials and story screens.
The journey total and achievement timer use the original frame duration while
physics continues to use a capped step. This prevents low frame rates from
making the speedrun shorter. Each failed/restarted attempt keeps accumulated time.

Run `node --test test/achievements.test.js` for rule boundaries, persistence,
eligibility, retries and the active-time gates. No dependencies were added.

Additional badges cover successful parking, undamaged parking, the first parking failure, traffic avoidance, all cups, both surveys, no shield saves, low suspicion, correct answers only, answering in the tutor's view, a last-second finish, and journey completion. Campus Spirit requires the Level 1 Wits Shark encounter and greetings from both named kudus and the Wits Bot in the same journey. Look Both Ways allows collecting Red Cappuccino but requires no shield saves.
