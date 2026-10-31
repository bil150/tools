/* Quiz de néerlandais : vêtements, apparence et émotions. Choix multiple ou saisie.
   Les images sont de petits dessins SVG tracés dans ce fichier. Aucune dépendance. */
(function () {
  'use strict';

  var CL='<path d="M30 18 L10 34 L16 70 L26 68 L30 46 V84 H70 V46 L74 68 L84 70 L90 34 L70 18 L50 32Z"/>';
  var EY='<circle cx="36" cy="44" r="2.5" fill="currentColor" stroke="none"/><circle cx="64" cy="44" r="2.5" fill="currentColor" stroke="none"/>';
  function fc(x){return '<circle cx="50" cy="50" r="40"/>'+x}
  var HF='<circle cx="50" cy="56" r="26" fill="var(--paper-2)"/><circle cx="41" cy="54" r="2" fill="currentColor" stroke="none"/><circle cx="59" cy="54" r="2" fill="currentColor" stroke="none"/><path d="M42 66 Q50 72 58 66"/>';
  function hc(c){return HF+'<path d="M30 50 C28 18 72 18 70 50 C62 38 38 38 30 50Z" fill="'+c+'" stroke="none"/>'}
  var IMG={
  hemd:CL+'<path d="M50 32 V84"/><circle cx="50" cy="48" r="1.5"/><circle cx="50" cy="60" r="1.5"/><circle cx="50" cy="72" r="1.5"/>',
  tshirt:'<path d="M30 20 L12 32 L22 46 L30 40 V82 H70 V40 L78 46 L88 32 L70 20 C66 28 34 28 30 20Z"/>',
  blouse:'<path d="M30 18 L10 34 L18 52 L30 46 V84 H70 V46 L82 52 L90 34 L70 18 L50 40Z"/><path d="M44 34 L50 40 L56 34 V46 L50 40 L44 46Z"/>',
  trui:'<path d="M32 20 C40 28 60 28 68 20 L90 36 L82 74 L70 70 V84 H30 V70 L18 74 L10 36Z"/><path d="M30 76 H70"/>',
  vest:'<path d="M32 20 L50 34 L68 20 L90 36 L82 74 L70 70 V84 H30 V70 L18 74 L10 36Z"/><path d="M50 34 V84"/><circle cx="56" cy="48" r="1.5"/><circle cx="56" cy="60" r="1.5"/><circle cx="56" cy="72" r="1.5"/>',
  jas:'<path d="M34 14 L50 30 L66 14 L84 24 L88 88 H12 L16 24Z"/><path d="M50 30 V88"/><circle cx="56" cy="50" r="1.5"/><circle cx="56" cy="64" r="1.5"/>',
  regenjas:'<path d="M32 22 C32 4 68 4 68 22 L86 30 L90 88 H10 L14 30Z"/><path d="M50 22 V88"/><path d="M20 50 l-2 6 M30 66 l-2 6 M72 52 l-2 6 M80 70 l-2 6"/>',
  jurk:'<path d="M38 12 L44 26 H56 L62 12 L68 16 L62 40 L84 88 H16 L38 40 L32 16Z"/>',
  pak:'<path d="M30 14 L50 40 L70 14 L88 24 L86 88 H14 L12 24Z"/><path d="M50 40 L45 50 L50 76 L55 50Z"/>',
  broek:'<path d="M30 14 H70 L76 88 H54 L50 40 L46 88 H24Z"/><path d="M30 24 H70"/>',
  jeans:'<path d="M30 14 H70 L76 88 H54 L50 40 L46 88 H24Z"/><path d="M30 24 H70"/><path d="M34 28 C34 38 44 38 44 28"/><path d="M66 28 C66 38 56 38 56 28"/>',
  short:'<path d="M28 26 H72 L80 62 H54 L50 44 L46 62 H20Z"/>',
  rok:'<path d="M36 20 H64 L84 82 H16Z"/><path d="M36 28 H64"/>',
  sokken:'<path d="M40 12 H64 V54 L84 68 C90 78 82 86 74 84 L34 66 C28 62 38 52 40 48Z"/><path d="M40 22 H64"/>',
  schoen:'<path d="M14 40 H38 L44 56 C52 60 70 60 88 66 V78 H14Z"/><path d="M14 72 H88"/>',
  laars:'<path d="M36 10 H58 V52 L84 60 C90 62 90 82 84 84 H34Z"/><path d="M34 78 H88"/>',
  sandaal:'<path d="M12 70 C12 60 30 62 50 64 C70 66 88 62 90 72 C90 82 70 84 50 84 C30 84 12 84 12 70Z"/><path d="M38 64 C38 42 64 42 64 66"/><path d="M52 48 V64"/>',
  pantoffel:'<path d="M14 62 C14 46 40 40 56 44 C74 48 90 56 90 68 C90 80 14 80 14 62Z"/><path d="M38 48 C44 62 62 62 68 50"/>',
  muts:'<path d="M24 66 C24 36 38 28 50 28 C62 28 76 36 76 66Z"/><rect x="20" y="66" width="60" height="12"/><circle cx="50" cy="20" r="6"/>',
  pet:'<path d="M20 62 C20 38 36 28 52 28 C68 28 78 42 78 62Z"/><path d="M78 62 H96 C96 68 82 70 78 66"/>',
  hoed:'<path d="M30 60 C30 36 40 30 50 30 C60 30 70 36 70 60"/><path d="M10 64 C10 56 90 56 90 64 C90 74 10 74 10 64Z"/>',
  sjaal:'<path d="M20 28 C20 16 80 16 80 28 C80 40 20 40 20 28Z"/><path d="M54 38 L58 84 H74 L68 36"/>',
  handschoen:'<path d="M30 88 V54 L22 40 C20 34 28 32 30 38 L34 46 V24 C34 18 42 18 42 24 V44 V16 C42 10 50 10 50 16 V44 V20 C50 14 58 14 58 20 V46 V30 C58 24 66 24 66 30 V60 L72 52 C76 46 82 50 78 56 L68 78 V88Z"/>',
  stropdas:'<path d="M42 12 H58 L54 24 L66 78 L50 92 L34 78 L46 24Z"/>',
  riem:'<rect x="8" y="40" width="84" height="20"/><rect x="60" y="35" width="18" height="30"/><circle cx="20" cy="50" r="1.5"/><circle cx="30" cy="50" r="1.5"/><circle cx="40" cy="50" r="1.5"/>',
  bril:'<circle cx="30" cy="56" r="16"/><circle cx="70" cy="56" r="16"/><path d="M46 54 C48 50 52 50 54 54"/><path d="M14 52 L6 44"/><path d="M86 52 L94 44"/>',
  zonnebril:'<path d="M12 46 H88 L84 62 C82 72 62 72 58 62 L54 54 H46 L42 62 C38 72 18 72 16 62Z" fill="currentColor"/>',
  handtas:'<path d="M20 40 H80 L86 88 H14Z"/><path d="M36 40 C36 14 64 14 64 40"/>',
  paraplu:'<path d="M10 52 C10 24 90 24 90 52 C80 46 70 46 62 52 C54 46 46 46 38 52 C30 46 20 46 10 52Z"/><path d="M50 52 V80 C50 90 38 90 38 82"/>',
  zwembroek:'<path d="M20 30 H80 L82 60 C70 70 58 62 50 50 C42 62 30 70 18 60Z"/><path d="M20 38 H80"/>',
  badpak:'<path d="M34 12 V32 C34 44 26 48 28 60 L34 84 C42 88 58 88 66 84 L72 60 C74 48 66 44 66 32 V12 H60 V30 H40 V12Z"/>',
  gestreept:'<rect x="10" y="10" width="80" height="80" rx="6"/><path d="M24 10 V90 M38 10 V90 M52 10 V90 M66 10 V90 M80 10 V90" stroke-width="5"/>',
  geruit:'<rect x="10" y="10" width="80" height="80" rx="6"/><path d="M30 10 V90 M50 10 V90 M70 10 V90 M10 30 H90 M10 50 H90 M10 70 H90"/>',
  gestippeld:'<rect x="10" y="10" width="80" height="80" rx="6"/><g fill="currentColor" stroke="none"><circle cx="28" cy="28" r="5"/><circle cx="50" cy="28" r="5"/><circle cx="72" cy="28" r="5"/><circle cx="28" cy="50" r="5"/><circle cx="50" cy="50" r="5"/><circle cx="72" cy="50" r="5"/><circle cx="28" cy="72" r="5"/><circle cx="50" cy="72" r="5"/><circle cx="72" cy="72" r="5"/></g>',
  gebloemd:'<rect x="10" y="10" width="80" height="80" rx="6"/><g id="fl"><circle cx="32" cy="32" r="3"/><circle cx="32" cy="23" r="5"/><circle cx="32" cy="41" r="5"/><circle cx="23" cy="32" r="5"/><circle cx="41" cy="32" r="5"/></g><use href="#fl" x="38" y="34"/><use href="#fl" x="0" y="36"/>',
  effen:'<rect x="10" y="10" width="80" height="80" rx="6" fill="currentColor" fill-opacity="0.15"/>',
  blij:fc(EY+'<path d="M30 60 Q50 80 70 60"/>'),
  verdrietig:fc(EY+'<path d="M32 74 Q50 58 68 74"/><path d="M36 50 Q33 56 36 59 Q39 56 36 50Z"/>'),
  boos:fc(EY+'<path d="M26 32 L44 38 M74 32 L56 38"/><path d="M34 70 Q50 60 66 70"/>'),
  bang:fc('<circle cx="36" cy="44" r="6"/><circle cx="64" cy="44" r="6"/><circle cx="36" cy="44" r="2" fill="currentColor" stroke="none"/><circle cx="64" cy="44" r="2" fill="currentColor" stroke="none"/><path d="M28 28 Q36 22 44 28 M56 28 Q64 22 72 28"/><path d="M38 70 Q44 64 50 70 Q56 76 62 70"/>'),
  moe:fc('<path d="M30 44 Q36 48 42 44 M58 44 Q64 48 70 44"/><path d="M42 68 H58"/><path d="M76 8 H90 L76 22 H90" />'),
  nerveus:fc(EY+'<path d="M32 68 Q38 62 44 68 Q50 74 56 68 Q62 62 68 68"/><path d="M82 28 Q78 36 82 40 Q86 36 82 28Z"/>'),
  ongerust:fc(EY+'<path d="M28 34 L44 28 M72 34 L56 28"/><path d="M38 70 Q50 62 62 70"/>'),
  tevreden:fc('<path d="M30 44 Q36 38 42 44 M58 44 Q64 38 70 44"/><path d="M34 60 Q50 72 66 60"/>'),
  trots:fc(EY+'<path d="M28 32 Q36 28 44 32 M56 32 Q64 28 72 32"/><path d="M34 62 Q50 76 68 60"/>'),
  verrast:fc('<circle cx="36" cy="44" r="5"/><circle cx="64" cy="44" r="5"/><path d="M28 28 Q36 22 44 28 M56 28 Q64 22 72 28"/><ellipse cx="50" cy="70" rx="6" ry="8"/>'),
  verliefd:fc('<path d="M36 52 C26 44 28 34 36 38 C44 34 46 44 36 52Z" fill="currentColor"/><path d="M64 52 C54 44 56 34 64 38 C72 34 74 44 64 52Z" fill="currentColor"/><path d="M34 62 Q50 76 66 62"/>'),
  haar:'<path d="M22 92 V52 C22 14 78 14 78 52 V92Z" fill="currentColor" stroke="none"/>'+HF,
  langhaar:'<path d="M22 92 V52 C22 14 78 14 78 52 V92Z" fill="currentColor" stroke="none"/>'+HF,
  korthaar:HF+'<path d="M30 50 C28 18 72 18 70 50 C62 38 38 38 30 50Z" fill="currentColor" stroke="none"/>',
  krullend:'<g fill="currentColor" stroke="none"><circle cx="28" cy="46" r="10"/><circle cx="38" cy="30" r="10"/><circle cx="54" cy="26" r="10"/><circle cx="68" cy="32" r="10"/><circle cx="74" cy="48" r="10"/><circle cx="26" cy="62" r="9"/><circle cx="76" cy="64" r="9"/></g>'+HF,
  steil:'<path d="M22 92 V52 C22 14 78 14 78 52 V92Z" fill="currentColor" stroke="none"/>'+HF+'<path d="M28 44 C40 30 60 30 72 44 C60 38 40 38 28 44Z" fill="currentColor" stroke="none"/>',
  golvend:'<path d="M24 92 C16 76 30 70 22 56 C14 40 24 20 50 18 C76 20 86 40 78 56 C70 70 84 76 76 92Z" fill="currentColor" stroke="none"/>'+HF,
  kaal:HF+'<path d="M40 34 Q50 28 60 34" /><circle cx="24" cy="56" r="5"/><circle cx="76" cy="56" r="5"/>',
  baard:HF+'<path d="M26 56 C26 94 74 94 74 56 C66 72 34 72 26 56Z" fill="currentColor" stroke="none"/>',
  snor:HF+'<path d="M34 62 Q42 56 50 62 Q58 56 66 62 Q58 68 50 64 Q42 68 34 62Z" fill="currentColor" stroke="none"/>',
  ogen:'<path d="M8 50 Q24 34 40 50 Q24 66 8 50Z"/><circle cx="24" cy="50" r="6"/><path d="M60 50 Q76 34 92 50 Q76 66 60 50Z"/><circle cx="76" cy="50" r="6"/>',
  neus:'<path d="M50 14 V62 C38 64 34 74 42 78 C48 80 50 74 56 78 C64 74 62 64 50 62"/>',
  mond:'<path d="M12 50 Q32 34 50 44 Q68 34 88 50 Q68 78 50 72 Q32 78 12 50Z"/><path d="M12 50 Q50 58 88 50"/>',
  oren:'<circle cx="50" cy="52" r="26"/><circle cx="22" cy="52" r="8"/><circle cx="78" cy="52" r="8"/><circle cx="41" cy="48" r="2" fill="currentColor"/><circle cx="59" cy="48" r="2" fill="currentColor"/><path d="M42 62 Q50 68 58 62"/>',
  gezicht:fc(EY+'<path d="M50 48 V58 H46"/><path d="M36 68 Q50 78 64 68"/>'),
  lente:'<path d="M50 90 V50"/><path d="M50 74 C34 74 30 62 32 58 C44 58 50 66 50 74Z"/><path d="M50 66 C66 66 70 54 68 50 C56 50 50 58 50 66Z"/><circle cx="50" cy="22" r="7"/><circle cx="50" cy="42" r="7"/><circle cx="40" cy="32" r="7"/><circle cx="60" cy="32" r="7"/><circle cx="50" cy="32" r="4" fill="currentColor"/>',
  zomer:'<circle cx="50" cy="50" r="18"/><path d="M50 12 V24 M50 76 V88 M12 50 H24 M76 50 H88 M23 23 L32 32 M68 68 L77 77 M77 23 L68 32 M32 68 L23 77"/>',
  herfst:'<path d="M50 12 C80 24 88 54 50 80 C12 54 20 24 50 12Z"/><path d="M50 88 V30 M50 48 L36 38 M50 60 L64 48 M50 68 L38 58"/>',
  winter:'<path d="M50 10 V90 M15 30 L85 70 M15 70 L85 30"/><path d="M42 16 L50 24 L58 16 M42 84 L50 76 L58 84 M14 40 L24 38 L22 28 M86 60 L76 62 L78 72 M14 60 L24 62 L22 72 M86 40 L76 38 L78 28"/>'
  };
  var COL={rood:'#E24B4A',geel:'#F2C230',zwart:'#1a1a1a',grijs:'#888780',oranje:'#F28C28',paars:'#8A4FBF',blauw:'#378ADD',groen:'#639922',wit:'#ffffff',bruin:'#7A4A2A',roze:'#ED93B1',beige:'#E8D8B8',lichtblauw:'#9CC7F0',donkerblauw:'#1A3A6B'};
  var HAIRC={blond:'#E6C35C',bruin:'#7A4A2A',zwart:'#1a1a1a',grijs:'#9a9a96',rood:'#C8501E'};
  function imgHTML(k){
    if(!k)return '';
    var b='<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">';
    if(k.indexOf('c:')===0){var c=COL[k.slice(2)];return b+'<circle cx="50" cy="50" r="38" fill="'+c+'" stroke="#8886"/></svg>'}
    if(k.indexOf('h:')===0){return b+hc(HAIRC[k.slice(2)])+'</svg>'}
    return b+IMG[k]+'</svg>';
  }
  var T=[
  {n:"Vêtements - haut",i:[
  ["la chemise","het hemd","hemd"],["le t-shirt","het T-shirt","tshirt"],["le chemisier","de blouse","blouse"],["le pull","de trui","trui"],["le gilet","het vest","vest"],["le manteau / la veste","de jas","jas"],["l'imperméable","de regenjas","regenjas"],["la robe","de jurk","jurk"],["le costume","het pak","pak"]]},
  {n:"Vêtements - bas et pieds",i:[
  ["le pantalon","de broek","broek"],["le jean","de jeans","jeans"],["le short","de short|de korte broek","short"],["la jupe","de rok","rok"],["les chaussettes","de sokken","sokken"],["les chaussures","de schoenen","schoen"],["les bottes","de laarzen","laars"],["les sandales","de sandalen","sandaal"],["les pantoufles","de pantoffels","pantoffel"]]},
  {n:"Accessoires",i:[
  ["le bonnet","de muts","muts"],["la casquette","de pet","pet"],["le chapeau","de hoed","hoed"],["l'écharpe","de sjaal","sjaal"],["les gants","de handschoenen","handschoen"],["la cravate","de stropdas","stropdas"],["la ceinture","de riem","riem"],["les lunettes","de bril","bril"],["les lunettes de soleil","de zonnebril","zonnebril"],["le sac à main","de handtas","handtas"],["le parapluie","de paraplu","paraplu"],["le maillot de bain (homme)","de zwembroek","zwembroek"],["le maillot de bain (femme)","het badpak","badpak"]]},
  {n:"Couleurs et motifs",i:[
  ["rouge","rood","c:rood"],["jaune","geel","c:geel"],["noir","zwart","c:zwart"],["gris","grijs","c:grijs"],["orange","oranje","c:oranje"],["violet","paars","c:paars"],["bleu","blauw","c:blauw"],["vert","groen","c:groen"],["blanc","wit","c:wit"],["brun / marron","bruin","c:bruin"],["rose","roze","c:roze"],["beige","beige","c:beige"],["bleu clair","lichtblauw","c:lichtblauw"],["bleu foncé","donkerblauw","c:donkerblauw"],["rayé","gestreept","gestreept"],["à carreaux","geruit","geruit"],["à pois","gestippeld","gestippeld"],["à fleurs","gebloemd","gebloemd"],["uni","effen","effen"]]},
  {n:"Adjectifs (vêtements)",i:[
  ["neuf","nieuw"],["vieux","oud"],["beau","mooi"],["laid","lelijk"],["chaud","warm"],["froid","koud"],["épais","dik"],["fin","dun"],["cher","duur"],["bon marché","goedkoop"],["moderne / à la mode","modern|in de mode"],["confortable","comfortabel"]]},
  {n:"Cheveux et visage",i:[
  ["les cheveux","het haar","haar"],["cheveux longs","lang haar","langhaar"],["cheveux courts","kort haar","korthaar"],["bouclés","krullend","krullend"],["raides","steil","steil"],["ondulés","golvend","golvend"],["blond","blond","h:blond"],["brun","bruin","h:bruin"],["noir","zwart","h:zwart"],["gris","grijs","h:grijs"],["roux","rood","h:rood"],["chauve","kaal","kaal"],["la barbe","de baard","baard"],["la moustache","de snor","snor"],["les yeux","de ogen","ogen"],["le nez","de neus","neus"],["la bouche","de mond","mond"],["les oreilles","de oren","oren"],["le visage","het gezicht","gezicht"]]},
  {n:"Physique (postuur)",i:[
  ["grand","groot"],["petit","klein"],["grand (en taille)","lang"],["court","kort"],["gros","dik"],["mince","dun"],["svelte","slank"],["fort","sterk"],["faible","zwak"],["jeune","jong"],["vieux","oud"],["beau gosse","knap"],["beau","mooi"],["laid","lelijk"],["sportif","sportief"]]},
  {n:"Émotions",i:[
  ["content","blij|gelukkig","blij"],["heureux","gelukkig|blij","blij"],["triste","verdrietig|triest","verdrietig"],["fâché","boos","boos"],["peureux / apeuré","bang","bang"],["fatigué","moe","moe"],["nerveux","nerveus","nerveus"],["inquiet","ongerust","ongerust"],["satisfait","tevreden","tevreden"],["fier","trots","trots"],["surpris","verrast","verrast"],["amoureux","verliefd","verliefd"]]},
  {n:"Décrire une personne",i:[
  ["Il a les cheveux courts et noirs et une barbe.","Hij heeft kort, zwart haar en een baard."],["Elle a les cheveux longs et blonds et les yeux bleus.","Ze heeft lang, blond haar en blauwe ogen."],["Il est grand et mince.","Hij is groot en dun."],["Elle porte une robe rouge et des chaussures blanches.","Ze draagt een rode jurk en witte schoenen."],["Il est content.","Hij is blij."],["Elle a l'air fatiguée.","Ze ziet er moe uit."]]},
  {n:"Au magasin",i:[
  ["Puis-je vous aider ?","Kan ik u helpen?"],["Je cherche un...","Ik zoek een..."],["Je regarde juste.","Ik kijk even rond."],["Quelle taille ?","Welke maat hebt u?"],["Puis-je l'essayer ?","Mag ik het passen?"],["la cabine d'essayage","de paskamer"],["Ça (ne) va (pas).","Het past (niet)."],["C'est trop grand / petit.","Het is te groot / klein."],["Avez-vous ça aussi en bleu ?","Hebt u dit ook in het blauw?"],["Combien ça coûte ?","Hoeveel kost het?"],["Je le prends.","Ik neem het."],["Je peux payer par carte ?","Kan ik met de kaart betalen?"]]},
  {n:"Problème et solution",i:[
  ["Le pantalon est trop long.","De broek is te lang."],["Pouvez-vous le raccourcir ?","Kunt u de broek verkorten?"],["Le manteau est trop large.","De jas is te breed."],["Pouvez-vous le rétrécir ?","Kunt u de jas versmallen?"],["Les manches sont trop courtes.","De mouwen zijn te kort."],["Pouvez-vous les rallonger ?","Kunt u ze verlengen?"],["Pas de problème !","Geen probleem!"]]},
  {n:"Personne disparue",i:[
  ["J'ai perdu mon fils.","Ik ben mijn zoon kwijt."],["À quoi ressemble-t-il ?","Hoe ziet hij eruit?"],["Quel âge a-t-il ?","Hoe oud is hij?"],["Qu'est-ce qu'il porte ?","Wat draagt hij?"],["Il porte un manteau bleu et une casquette rouge.","Hij draagt een blauwe jas en een rode pet."],["Nous allons le chercher.","Wij gaan hem zoeken."],["Je le vois !","Ik zie hem!"],["C'est exact.","Dat klopt."]]},
  {n:"Fréquence",i:[
  ["jamais (0 %)","nooit"],["parfois (20 %)","soms"],["souvent (70 %)","dikwijls|vaak"],["le plus souvent (90 %)","meestal"],["toujours (100 %)","altijd"]]},
  {n:"Saisons",i:[
  ["le printemps","de lente","lente"],["l'été","de zomer","zomer"],["l'automne","de herfst","herfst"],["l'hiver","de winter","winter"]]}
  ];

  var ALL = [];
  T.forEach(function (t, ti) { t.i.forEach(function (x) { x.t = ti; }); ALL = ALL.concat(t.i); });

  var app = document.getElementById('app');
  var mode = 'mc', Q = [], i = 0, sc = 0, wrong = [], done = false, cur = null;

  function clean(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function nart(s) { return clean(s).replace(/^(de|het|een) /, ''); }
  function shuffle(a) { return a.slice().sort(function () { return Math.random() - .5; }); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; }
  function btn(cls, text) { var b = el('button', cls, text); b.type = 'button'; return b; }
  function ans(it) { return it[1].split('|')[0]; }
  function art(a) { var m = a.match(/^(de|het) /); return m ? m[1] : ''; }
  function sub(x) { return x[2] && x[2].charAt(1) === ':' ? x[2].charAt(0) : ''; }

  function home() {
    app.textContent = '';
    var seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Mode');
    var b1 = btn('', 'Choix multiple'), b2 = btn('', 'Écrire');
    b1.setAttribute('aria-pressed', mode === 'mc');
    b2.setAttribute('aria-pressed', mode === 'type');
    b1.onclick = function () { mode = 'mc'; home(); };
    b2.onclick = function () { mode = 'type'; home(); };
    seg.appendChild(b1); seg.appendChild(b2); app.appendChild(seg);
    app.appendChild(el('p', 'muted', mode === 'mc' ? 'Mode pour débuter : vous choisissez la bonne réponse parmi 4.' : 'Mode difficile : vous écrivez le mot en néerlandais.'));
    var all = btn('btn theme', ''); all.appendChild(el('b', '', 'Tout mélanger')); all.appendChild(el('span', '', ALL.length + ' mots'));
    all.onclick = function () { start(ALL, null); };
    app.appendChild(all);
    T.forEach(function (t) {
      var b = btn('btn ghost theme', ''); b.appendChild(el('b', '', t.n)); b.appendChild(el('span', '', t.i.length + ' mots'));
      b.onclick = function () { start(t.i, t); };
      app.appendChild(b);
    });
  }

  function start(items, t) { Q = shuffle(items); i = 0; sc = 0; wrong = []; cur = t; show(); }

  function head() {
    var top = el('div', 'top');
    var b = btn('btn ghost', 'Thèmes'); b.onclick = home; top.appendChild(b);
    top.appendChild(el('span', 'count', (i + 1) + ' / ' + Q.length + '  -  Score : ' + sc));
    app.appendChild(top);
    var c = el('div', 'face' + (Q[i][0].length > 28 ? ' long' : ''));
    var im = imgHTML(Q[i][2]); if (im) c.insertAdjacentHTML('beforeend', im);
    c.appendChild(document.createTextNode(Q[i][0]));
    app.appendChild(c);
  }

  function show() {
    done = false; app.textContent = ''; head();
    if (mode === 'mc') showMC(); else showType();
  }

  /* Groupe de thèmes proches, pour choisir des distracteurs plausibles */
  var GR = ['cl', 'cl', 'cl', 'col', 'adj', 'face', 'adj', 'adj', 's', 's', 's', 's', 'freq', 'season'];

  function showMC() {
    var it = Q[i], seen = {}, d = [];
    var good = it[1].split('|').map(clean);
    var a0 = art(ans(it)), th = it.t;
    function okc(x) { var k = clean(ans(x)); return x !== it && good.indexOf(k) < 0 && !seen[k]; }
    var tiers = [
      function (x) { return x.t === th && sub(x) === sub(it) && art(ans(x)) === a0; },
      function (x) { return x.t === th && sub(x) === sub(it); },
      function (x) { return x.t === th; },
      function (x) { return GR[x.t] === GR[th] && art(ans(x)) === a0; },
      function (x) { return GR[x.t] === GR[th]; },
      function (x) { return (GR[x.t] === 's') === (GR[th] === 's'); }
    ];
    tiers.forEach(function (f) {
      shuffle(ALL).forEach(function (x) {
        if (d.length < 3 && f(x) && okc(x)) { seen[clean(ans(x))] = 1; d.push(ans(x)); }
      });
    });
    var opts = shuffle(d.concat([ans(it)]));
    var box = el('div', 'opts'); app.appendChild(box);
    var nx = btn('btn next', 'Suivant'); nx.hidden = true;
    nx.onclick = function () { i++; if (i >= Q.length) end(); else show(); };
    opts.forEach(function (o) {
      var b = btn('btn ghost opt', o);
      b.onclick = function () {
        if (done) return; done = true;
        if (o === ans(it)) sc++; else wrong.push(it);
        Array.prototype.forEach.call(box.children, function (c) {
          if (c.textContent === ans(it)) c.classList.add('ok');
          else if (c === b) c.classList.add('ko');
        });
        nx.hidden = false;
      };
      box.appendChild(b);
    });
    app.appendChild(nx);
  }

  function showType() {
    var r = el('div', 'row');
    var inp = el('input'); inp.type = 'text'; inp.id = 'a'; inp.placeholder = 'En néerlandais';
    inp.setAttribute('aria-label', 'Réponse en néerlandais');
    inp.setAttribute('autocomplete', 'off'); inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('spellcheck', 'false');
    var go = btn('btn', 'Vérifier'); go.id = 'g';
    r.appendChild(inp); r.appendChild(go); app.appendChild(r);
    var m = el('p', 'msg'); m.id = 'm'; m.setAttribute('aria-live', 'polite'); app.appendChild(m);
    var skip = btn('btn ghost', 'Je ne sais pas'); skip.onclick = function () { if (!done) reveal(false); };
    app.appendChild(skip);
    go.onclick = act; inp.onkeydown = function (e) { if (e.key === 'Enter') act(); };
    inp.focus();
  }

  function reveal(ok) {
    var m = document.getElementById('m');
    if (ok) { sc++; m.className = 'msg ok'; m.textContent = 'Correct : ' + ans(Q[i]); }
    else { wrong.push(Q[i]); m.className = 'msg ko'; m.textContent = 'Réponse : ' + ans(Q[i]); }
    done = true; document.getElementById('a').disabled = true; document.getElementById('g').textContent = 'Suivant';
  }

  function act() {
    if (done) { i++; if (i >= Q.length) end(); else show(); return; }
    var v = document.getElementById('a').value.trim(), m = document.getElementById('m');
    if (!v) { m.className = 'msg ko'; m.textContent = 'Écrivez d’abord une réponse.'; return; }
    reveal(Q[i][1].split('|').some(function (x) { return clean(x) === clean(v) || nart(x) === nart(v); }));
  }

  function end() {
    app.textContent = '';
    app.appendChild(el('div', 'face score', 'Score : ' + sc + ' / ' + Q.length));
    if (wrong.length) {
      var b = btn('btn', 'Refaire mes ' + wrong.length + ' erreurs');
      var w = wrong.slice(); b.onclick = function () { start(w, cur); };
      app.appendChild(b);
      app.appendChild(el('p', 'muted', 'À revoir :'));
      var t = el('table');
      wrong.forEach(function (x) { var r = el('tr'); r.appendChild(el('td', '', x[0])); r.appendChild(el('td', '', ans(x))); t.appendChild(r); });
      app.appendChild(t);
    }
    var h = btn('btn ghost', 'Retour aux thèmes'); h.onclick = home;
    app.appendChild(h);
  }

  home();
})();
