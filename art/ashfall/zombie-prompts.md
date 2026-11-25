# Ashfall zombies: reference image prompts

Step 1 of the range simulator's pipeline (image, then image-to-3D, then Blender, then the game). One prompt for each of the twelve
zombies and three bosses. Settings for every one: model `gpt_image_2_6`, aspect 2:3, one figure, whole body in frame.

Every prompt ends with the same staging line (written once here, added to each when it is sent):

> standing in an A-pose facing the camera, arms down and out about 30 degrees and clear of the body, legs slightly apart, neutral
> slack expression, mouth closed, full body from head to feet in frame, plain light grey studio background, even soft lighting,
> fitted clothing with nothing hanging loose, no logos, no text, no badges, no stripes down the sleeves or legs, not a real person,
> photoreal game asset reference.

Check each picture before it goes to 3D: whole figure in frame, arms clear of the body, no open shirts, coats, straps or ribbons
(they tear when animated), no logo or brand-like design, nothing held in the hands unless the prompt asks for it. Fix a fault by
editing the image ("same image, same pose and framing, but ..."), never by hoping the 3D step fixes it.

3D settings: texture on, PBR on, rigging on, pose `a-pose`, polycount 30,000 (the game makes its own smaller copies for distance).
`rigging_height_meters` is given with each.

| File | In the game | Height | Prompt (before the staging line) |
|---|---|---|---|
| foe_walker | Zombie | 1.78 | Full-body photoreal character reference of a fictional zombie, a lean man in his forties, grey-green mottled skin, sunken eyes, thinning hair, a torn plaid flannel shirt buttoned and tucked in, dusty work jeans, worn boots, dried dark stains on the sleeves and chest |
| foe_runner | Runner | 1.70 | Full-body photoreal character reference of a fictional zombie, a wiry young man built like a distance runner, pale grey skin stretched over ribs and tendons, shaved head, a plain close-fitting grey athletic vest and fitted knee-length shorts, bare forearms scratched raw, battered plain running shoes |
| foe_brute | Brute | 1.98 | Full-body photoreal character reference of a fictional zombie, a huge heavy-set man with a thick neck and swollen forearms, grey bruised skin, bald, a stained butcher's apron tied tight over a plain fitted dark t-shirt, heavy canvas trousers, steel-toe boots |
| foe_spitter | Spitter | 1.74 | Full-body photoreal character reference of a fictional zombie, a gaunt woman in her thirties, sickly yellow-green skin, a swollen distended throat and jaw stained dark green, lank hair tied back, a fitted plain hospital scrub top tucked into scrub trousers, plain slip-on shoes |
| foe_cinder | Burner | 1.72 | Full-body photoreal character reference of a fictional zombie, a thin man badly burned, charred black and red cracked skin with dull orange embers showing in the cracks of the chest and arms, no hair, the scorched remains of a fitted plain boiler suit fused to the body, bare blackened feet |
| foe_charger | Charger | 1.86 | Full-body photoreal character reference of a fictional zombie, a broad-shouldered construction worker leaning forward, grey skin, a dented plain hard hat, a torn plain high-visibility vest zipped closed over a fitted work shirt, a short length of rusted steel rebar run through the right forearm, heavy work trousers and boots |
| foe_leaper | Leaper | 1.68 | Full-body photoreal character reference of a fictional zombie, a very thin long-limbed young woman, pale blue-grey skin, long fingers with broken nails, wide mouth, cropped hair, a fitted plain sleeveless top and fitted leggings torn at the knees, bare feet |
| foe_bulwark | Riot Zombie | 1.84 | Full-body photoreal character reference of a fictional zombie in plain black riot gear with no markings, a cracked visored helmet, padded chest armour, forearm and shin guards strapped tight, grey skin showing at the neck and jaw, heavy boots, empty hands |
| foe_howler | Screamer | 1.70 | Full-body photoreal character reference of a fictional zombie, a thin woman in her fifties, chalk-white skin, the lower jaw hanging unnaturally wide with torn cheeks, veins dark on the neck, grey hair pulled tight in a bun, a fitted plain buttoned cardigan over a blouse tucked into fitted trousers, flat shoes |
| foe_husk | Husk | 1.80 | Full-body photoreal character reference of a fictional zombie, a dried-out mummified man, brown leathery skin shrunk onto the bones, hollow eye sockets, a few wisps of hair, the tight shrunken remains of a plain shirt and trousers the same dusty colour as the skin, bare feet |
| foe_mite | Crawler | 1.50 | Full-body photoreal character reference of a fictional zombie, a small hunched thin teenager-sized figure with long arms, grey skin smeared with soot, a fitted plain hooded top with the hood down and zipped closed, fitted torn trousers, bare hands and feet black with dirt |
| foe_bloater | Carrier | 1.82 | Full-body photoreal character reference of a fictional zombie, a bloated man with a hugely swollen pale belly and chest covered in dark veins and blisters, small head, grey-yellow skin, a fitted plain undershirt stretched to splitting over the belly, plain trousers held by a tight belt, bare feet |
| foe_foreman | THE FOREMAN (boss) | 2.30 | Full-body photoreal character reference of a fictional giant zombie, an enormous site foreman with slab-like shoulders, grey scarred skin, a dented plain hard hat, a fitted torn plain work shirt with the sleeves ripped off, a thick leather tool belt cinched tight, heavy trousers and boots, a long-handled sledgehammer held in the right hand with its head resting on the floor |
| foe_widow | THE WIDOW (boss) | 2.20 | Full-body photoreal character reference of a fictional giant zombie, a tall gaunt woman with very long thin arms and clawed fingers, grey-white skin, rows of dark bony spines growing from the shoulders and upper back, a swollen dark sac on the lower back, long black hair bound tight, the fitted remains of a plain high-collared black dress ending above the knee, bare feet |
| foe_furnace | THE FURNACE (boss) | 2.60 | Full-body photoreal character reference of a fictional giant zombie, a towering barrel-chested man whose torso glows from inside like a furnace, blackened cracked skin with bright orange light in the cracks of the chest and belly, an iron grate plate bolted over the chest, thick forearms wrapped tight in scorched chain, the charred remains of fitted trousers, heavy iron-shod boots |

Notes:

- The Leaper and the Crawler move on all fours in the game. They are still made standing in an A-pose (the rigging needs it); the
  game's own crawl and leap clips put them down.
- The sledgehammer is the one held object. If the rigging chokes on it, make the Foreman with empty hands and the hammer as a prop.
- Heights are the game's (`size` in `40-enemies.js` times 1.78 m, bosses as their figures stand).
