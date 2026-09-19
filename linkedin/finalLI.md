𝐃𝐚𝐲 𝐨𝐧𝐞: 𝐟𝐨𝐮𝐫 𝐰𝐞𝐚𝐩𝐨𝐧𝐬. 𝐃𝐚𝐲 𝐟𝐢𝐯𝐞: 𝐬𝐞𝐯𝐞𝐧𝐭𝐞𝐞𝐧.

I've continued the work on my browser-based game 𝐀𝐥𝐥𝐢𝐮𝐦 𝐀𝐬𝐬𝐚𝐮𝐥𝐭. Over the past 5 days and additional 99 commits I've turned the minimal prototype into a fully usable game.
𝐭𝐥;𝐝𝐫: you can play it without any installation for free on GitHub Pages: https://marcelpetrick.github.io/AlliumAssault/

It is still a turn-based 2D artillery game with 𝐠𝐚𝐫𝐥𝐢𝐜 𝐛𝐮𝐝𝐝𝐢𝐞𝐬 🧄 in the spirit of Worms 2. I had lots of fun with friends thanks to the guys from @Team17.
Adding the new weapons was more than just creating a new sprite for the button - playtesting turned out to be crucial. A `𝘣𝘢𝘯𝘢𝘯𝘢 𝘣𝘰𝘮𝘣` acts a bit differently from a `𝘣𝘢𝘴𝘦𝘣𝘢𝘭𝘭 𝘣𝘢𝘵`. And as you know, `𝘴𝘩𝘦𝘦𝘱` and `𝘴𝘶𝘱𝘦𝘳 𝘴𝘩𝘦𝘦𝘱` share only part of the name, but not their behaviour.
Since doing repeated tests would be boring, I added 17 E2E tests with 𝐏𝐥𝐚𝐲𝐰𝐫𝐢𝐠𝐡𝐭 to get this done.

Also, I've done one profiling run and then decided to remove multisampling, which saved around 40% of the cost per frame with almost no quality loss. And, of course, the major improvement - each push now runs 𝐂𝐈 𝐯𝐢𝐚 𝐆𝐢𝐭𝐇𝐮𝐛 𝐀𝐜𝐭𝐢𝐨𝐧𝐬, which automatically deploys to GitHub Pages. And this allows you to run it without any changes from any browser (also tested on a smartphone, but it still lacks "no keyboard" controls).

I have some more ideas in mind. Also, I hesitated until now to add a `rope` as a weapon, because its functionality is an easy way to introduce a load of bugs.

And if someone is interested: the repository now contains almost 𝟏𝟏𝐤 𝐋𝐨𝐂 𝐨𝐟 𝐓𝐲𝐩𝐞𝐒𝐜𝐫𝐢𝐩𝐭 in 118 commits, 84 tests, a C4 documentation, CI for quality assurance and releases, ...

So, spend the Sunday wisely: go to https://marcelpetrick.github.io/AlliumAssault/ and give it a try 🐑

#worms2 #wormsarmageddon #team17 #typescript #sdlc #AlliumAssault
