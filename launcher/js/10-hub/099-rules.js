
// ===== Rules (2026-11-17): the Terms of Service and "what you can report", inside the launcher =====
// The 📜 Rules button in the top bar (and the link in the report dialog) opens this. The terms are the same text as the
// TOS tab of the Huntington Games document; when one changes, change the other (and the date).
var RULES = { tab: 'report' };
var RULES_DATE = 'November 17, 2026';
var RULES_TOS = [
  ['', ['These terms apply to the Huntington Games Launcher, every game it opens, and all of the code, art, sounds, levels and text in the Huntington Games document. By copying, running or playing any of it, you agree to these terms. If you do not agree, do not use the games.']],
  ['1. Ownership', ['Huntington Games and its creators own all of the games, the Launcher, and everything in them, including the code, art, sounds, levels, names and ideas.', 'Neon Drift: Shadow Reign and Neon Dash were made by Levi and belong to Levi. These terms cover them too.', 'Bean And Brew Original and Market Life were made by Robbie and belong to Robbie. These terms cover them too.', 'Being allowed to play does not make you an owner of anything, and it does not give you any rights beyond the ones listed in section 2.']],
  ['2. What you are allowed to do', ['Play every game for free, for your own fun.', 'Copy the code from the Launcher tab and paste it into jsfiddle.net or jsbin.com, as shown in the How to Set Up the Launcher tab.', 'Save your own fiddle or bin that holds the unchanged Launcher code, and bookmark it for yourself.', 'Share the link to the document so other people can set up the Launcher themselves.', 'Use the features built into the games and the Launcher, such as offline copies made with the Download offline copy button, multiplayer codes, level editor share codes and save codes.', 'Take screenshots, record videos or stream yourself playing, as long as you say the games are from Huntington Games.', 'Send ideas and bug reports through the Feedback doc linked in the Information tab, or with the 🚩 Report button.']],
  ['3. What you are not allowed to do', ['Post, upload or host any game, the Launcher, or any part of their code anywhere else. That includes other websites, Google Sites, other Google Docs or Drive files, GitHub, Replit, CodePen, unblocked games sites, group chats and file sharing services. The only official copy is in the document.', 'Give the code to anyone. Share the link to the document instead.', 'Change, edit, remix, "remaster", translate or add to our code or games, or release anything made from them. This applies even if you give credit and even if you changed a lot of it. (This can be changed if given permission by the creator of the ORIGINAL game.)', 'Say that any of our games, levels, art or code are yours, or remove or change the Huntington Games name or credits.', 'Sell, trade or charge for our games or code, or put them behind ads, paywalls or logins that are not ours.', 'Cheat in multiplayer with edited code or tools, or interfere with other players\' games, saves or connections.', 'Use a loophole to get around these rules. If section 2 does not clearly allow something, it is not allowed unless you ask first and get permission.']],
  ['4. Copies from other people', ['Only the code in the document is official. Code from anyone else, or from any other site, is unofficial.', 'Unofficial copies may be outdated, broken, or changed to include harmful code. Do not run them.', 'If you see our games on another site, or someone claiming them as their own, please report it.']],
  ['5. Playing fairly', ['Use player names and messages that are appropriate for school.', 'Only share multiplayer codes with people you want to play with.', 'Follow your school\'s rules for school devices. These terms do not give you permission to break them.', 'If you are caught hacking, you will be banned.', 'One account per person. Alternate accounts (alts) are not allowed and will be banned.', 'Admins can warn, mute or ban you for breaking these rules. Warnings stay on your record, and more of them lead to mutes and bans.']],
  ['6. Your data', ['Your progress and settings are saved in your own browser. If you make a Grapevine account, your account name, chat messages and cloud saves are kept on the Huntington Games server, so you can chat and keep your progress on other devices. We never ask for your real name, email or password from another site.', 'Clearing your browsing data erases progress that is not saved to an account.', 'The Launcher downloads the games from GitHub and the jsDelivr network, which may keep normal web request logs.', 'Multiplayer connects players through public connection services. As in any online game, the players you connect with and those services can see your network (IP) address.']],
  ['7. Enforcement', ['If these terms are broken, Huntington Games may shut down the copies involved, change or remove access to any game or account, and ask websites to take down copies that are not allowed.']],
  ['8. No guarantees', ['The games are free and provided as they are, and they may have bugs.', 'Games, features and saves may change or be removed at any time.', 'Huntington Games is not responsible for lost progress, or for anything caused by unofficial copies.']],
  ['9. Changes to these terms', ['These terms can change at any time. The newest version is always the one in the TOS tab of the document (and here), and the date at the top shows when it last changed.', 'Using the games after a change means you accept the new terms.']],
  ['10. Downfall', ['We are sponsoring Downfall (owned by Robbie and Levi). If you are caught stealing code from Downfall you will be banned, and rules apply to any affiliated projects.', 'Ultimate Game Storage is fair play as it was made by another person with the same source doc.']],
  ['11. Grapevine and chat', ['Do not say the n-word. It bans you automatically: 1 day, then 3 days, then 7 days, then for good.', 'No slurs, hate speech or sexual content, in messages, names or pictures.', 'Everyday swearing is allowed.', 'No bullying, harassment, threats or spam.', 'No alt accounts. One Grapevine account per person: alts are banned, and so is the main account behind them.', 'Not sure whether something is allowed? Ask an admin or use the Feedback doc before you do it.']]
];
var RULES_REPORT = {
  yes: [['🚫', 'Slurs or hate', 'Slurs of any kind, the n-word, hate against someone for who they are.'], ['🔞', 'Sexual content', 'Sexual messages, names, pictures or jokes.'], ['😠', 'Bullying or harassment', 'Picking on someone, again and again, or getting others to.'], ['⚠️', 'Threats', 'Threatening to hurt someone, or anything scary.'],
    ['🕹️', 'Cheating', 'Hacked or edited games in multiplayer, messing with other players.'], ['👥', 'Alt accounts', 'A second account, especially to get around a ban.'], ['📛', 'Bad names or pictures', 'A name or profile picture that breaks these rules.'], ['📢', 'Spam', 'Flooding a chat with the same thing.'], ['🐞', 'Bugs', 'Anything broken, stuck or unfair in a game or the launcher.']],
  no: [['🤬', 'Everyday swearing', 'Normal swear words are allowed. Reporting them does nothing.'], ['😤', 'Trash talk in a game', '"Get good", "ez" and friendly teasing, as long as it is not bullying.'], ['🏆', 'Losing', 'Someone beat you fairly, or will not play with you.']]
};
function rulesEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function rulesOpen(tab) {
  if (tab) RULES.tab = tab;
  var d = document.getElementById('rulesdlg');
  if (!d) { d = document.createElement('div'); d.id = 'rulesdlg'; document.body.appendChild(d); d.addEventListener('click', rulesClick); }
  d.hidden = false; rulesPaint();
}
function rulesClose() { var d = document.getElementById('rulesdlg'); if (d) { d.hidden = true; d.innerHTML = ''; } }
function rulesPaint() {
  var d = document.getElementById('rulesdlg'), t = RULES.tab, h = '<div class="rl-card" role="dialog" aria-modal="true" aria-label="Rules"><button class="rp-x" data-rl="x" title="Close">&times;</button><h2>📜 Rules</h2>' +
    '<div class="rl-tabs"><button data-rl-tab="report" class="' + (t === 'report' ? 'on' : '') + '">What you can report</button><button data-rl-tab="tos" class="' + (t === 'tos' ? 'on' : '') + '">Terms of Service</button></div><div class="rl-body">';
  if (t === 'report') {
    var row = function (x) { return '<div class="rl-item"><span>' + x[0] + '</span><div><b>' + rulesEsc(x[1]) + '</b><small>' + rulesEsc(x[2]) + '</small></div></div>'; };
    h += '<h3 class="rl-yes">Report these</h3><div class="rl-grid">' + RULES_REPORT.yes.map(row).join('') + '</div>' +
      '<h3 class="rl-no">Not against the rules</h3><div class="rl-grid">' + RULES_REPORT.no.map(row).join('') + '</div>' +
      '<h3>What happens next</h3><ul class="rl-list"><li>Only the admins see your report. You will not get in trouble for reporting something honestly.</li><li>An admin reads it and decides: a warning, a mute, a ban, or no action.</li><li>You get a note back when they answer, even if you are offline (you see it next time you sign in).</li><li>Reporting people on purpose when they did nothing wrong can get <i>you</i> a warning.</li></ul>' +
      '<div class="rp-row"><button class="rp-btn" data-rl="report">🚩 Make a report</button></div>';
  } else {
    h += '<p class="rl-date">Last updated: ' + RULES_DATE + '</p>' + RULES_TOS.map(function (s) {
      return (s[0] ? '<h3>' + rulesEsc(s[0]) + '</h3>' : '') + (s[0] ? '<ul class="rl-list">' + s[1].map(function (p) { return '<li>' + rulesEsc(p) + '</li>'; }).join('') + '</ul>' : '<p>' + rulesEsc(s[1][0]) + '</p>');
    }).join('');
  }
  d.innerHTML = h + '</div></div>';
}
function rulesClick(e) {
  var b = e.target.closest && e.target.closest('[data-rl], [data-rl-tab]');
  if (!b) { if (e.target.id === 'rulesdlg') rulesClose(); return; }
  if (b.dataset.rlTab) { RULES.tab = b.dataset.rlTab; rulesPaint(); var bd = document.querySelector('#rulesdlg .rl-body'); if (bd) bd.scrollTop = 0; }
  else if (b.dataset.rl === 'x') rulesClose();
  else if (b.dataset.rl === 'report') { rulesClose(); reportOpen({}); }
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var d = document.getElementById('rulesdlg'); if (d && !d.hidden) rulesClose(); } });
document.getElementById('rulesBtn').onclick = function () { rulesOpen(); };
window.HG_rules = rulesOpen;
