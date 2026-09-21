// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * The weapons, in the languages the game speaks. Kept apart from the rest of the catalogue because
 * it is the one part that grows with the arsenal rather than with the interface, and because the
 * English lives in `src/core/weapons.ts`, where a weapon is defined — nothing here repeats it.
 */

import type { WeaponId } from '../core/weapons';
import { WEAPONS } from '../core/weapons';
import { language, type Language } from './i18n';

interface Words {
  name: string;
  blurb: string;
}

type WeaponWords = Partial<Record<WeaponId, Words>>;

const DE: WeaponWords = {
  bazooka: { name: 'Bazooka', blurb: 'Leertaste halten zum Aufladen. Der Wind schiebt sie kräftig. Knall bei Berührung.' },
  grenade: { name: 'Granate', blurb: 'Hüpfender Wurf mit 3 Sekunden Zünder. Der Wind kümmert sie kaum.' },
  cluster: { name: 'Splitterbombe', blurb: 'Rote Granate mit 3 Sekunden Zünder. Zerplatzt in fünf Bomblets à 10 Schaden.' },
  banana: { name: 'Bananenbombe', blurb: '3 Sekunden Zünder, dann hüpfen fünf explosive Bananen überall hin und gehen nacheinander hoch.' },
  holy: { name: 'Heilige Knoblauchgranate', blurb: 'Rollt aus, singt Halleluja und bricht dann in einer gewaltigen Explosion los.' },
  shotgun: { name: 'Schrotflinte', blurb: 'Zwei sofortige Schüsse entlang der Ziellinie.' },
  minigun: { name: 'Minigun', blurb: 'Eine lange ratternde Salve aus 14 Kugeln, die das Opfer quer über die Karte schiebt.' },
  punch: { name: 'Knoblauchfaust', blurb: 'Aufwärtshaken aus der Nähe, der das Opfer in den Himmel schickt.' },
  bat: { name: 'Baseballschläger', blurb: 'Homerun! Weniger Schaden als die Faust, schlägt das Opfer aber weit über die Karte.' },
  sheep: { name: 'Schaf', blurb: 'Leertaste lässt es in kleinen Sprüngen davonhüpfen; nochmal Leertaste sprengt es.' },
  flysheep: { name: 'Fliegendes Schaf', blurb: 'Startet in Zielrichtung; mit den Pfeiltasten steuern, Leertaste sprengt es.' },
  airstrike: { name: 'Luftangriff', blurb: 'Klick auf die Karte: ein Flugzeug fliegt vorbei und wirft fünf Bomben um die Stelle ab.' },
  napalm: { name: 'Napalm-Angriff', blurb: 'Klick auf die Karte: ein Flugzeug wirft Napalm ab, das der Wind weit trägt; der Boden brennt weiter.' },
  mule: { name: 'Betonesel', blurb: 'Klick auf die Karte: ein riesiger Betonesel fällt vom Himmel und kracht mehrfach nach unten durch.' },
  torch: { name: 'Schneidbrenner', blurb: 'Brennt 3 Sekunden lang einen Tunnel entlang der Ziellinie und reitet mit — nach oben zielen für einen Schacht.' },
  drill: { name: 'Bohrer', blurb: 'Bohrt 3 Sekunden lang senkrecht nach unten. Beim Bohren kein Fallschaden.' },
  rope: {
    name: 'Seil',
    blurb: 'Leertaste schießt den Haken; hängen, ↑↓ einholen, ←→ schwingen, Leertaste loslassen. Nach der Landung darfst du noch schießen.',
  },
  platform: { name: 'Plattform', blurb: 'Maus bewegen, um ein fünf Einheiten langes Brett zu setzen, Mausrad kippt es, Linksklick legt es ab.' },
  mine: { name: 'Annäherungsmine', blurb: 'Leertaste legt sie vor die Füße. Sie schärft sich, während du wegläufst, und geht dann für jeden hoch.' },
  selfdestruct: { name: 'Selbstzerstörung', blurb: 'Die Knolle sprengt sich selbst: Schaden gleich Lebenspunkte, und der Radius wächst mit.' },
  teleport: { name: 'Teleport', blurb: 'Klick irgendwohin auf die Karte, um dort zu erscheinen — und dann zu fallen, zu landen oder zu ertrinken.' },
  ming: {
    name: 'Ming-Vase',
    blurb: 'Eine pro Match. Sechshundert Jahre Porzellan, einmal geworfen: eine gewaltige Explosion und acht Scherben, die je wie eine Granate einschlagen.',
  },
  flamer: {
    name: 'Flammenwerfer',
    blurb:
      'Drei Sekunden brennender Treibstoff. Hoch und runter schwenken die Düse, während sie läuft; Wind und Schwerkraft tragen die Spritzer, und wo sie landen, brennt es weiter.',
  },
};

const HR: WeaponWords = {
  bazooka: { name: 'Bazuka', blurb: 'Drži Space da napuniš. Vitar je jako nosi. Bum kad dotakne.' },
  grenade: { name: 'Bomba', blurb: 'Skakutavi bačaj s upaljačem od 3 sekunde. Vitar je briga.' },
  cluster: { name: 'Kasetna bomba', blurb: 'Crvena bomba s 3 sekunde. Raspukne se na pet bombica po 10 štete.' },
  banana: { name: 'Banana bomba', blurb: '3 sekunde, pa pet eksplozivnih banana skakuće svuda i pucaju jedna po jedna.' },
  holy: { name: 'Sveta bomba od češnjaka', blurb: 'Dokotrlja se, otpiva Aleluja, pa prasne ka nikad ništa.' },
  shotgun: { name: 'Sačmarica', blurb: 'Dva trenutna hica po liniji nišanjenja.' },
  minigun: { name: 'Minigun', blurb: 'Duga rafalna tutnjava od 14 metaka šta gurne žrtvu čak prik karte.' },
  punch: { name: 'Češnjakov direkt', blurb: 'Aperkat iz blizine šta pošalje protivnika u nebo.' },
  bat: { name: 'Palica', blurb: 'Home run! Manje štete nego šaka, ali odalami protivnika dobrano daleko.' },
  sheep: { name: 'Ovca', blurb: 'Space je pusti da skakuće; opet Space pa je raznese.' },
  flysheep: { name: 'Leteća ovca', blurb: 'Poleti u smjeru nišana; vodi je strelicama, Space je raznese.' },
  airstrike: { name: 'Zračni udar', blurb: 'Klikni na kartu: avion prileti i baci pet bombi okolo tog mista.' },
  napalm: { name: 'Napalm', blurb: 'Klikni na kartu: avion baca napalm koga vitar nosi daleko; zemlja i dalje gori.' },
  mule: { name: 'Betonski tovar', blurb: 'Klikni na kartu: golemi betonski tovar pada z neba i lupa doli kroz sve.' },
  torch: { name: 'Plamenik', blurb: 'Gori tunel po liniji nišana 3 sekunde i vuče te sobon — nacilja gori za okno.' },
  drill: { name: 'Bušilica', blurb: 'Buši ravno doli 3 sekunde. Dok buši, nema štete od pada.' },
  rope: { name: 'Kuka', blurb: 'Space baca kuku; visi, ↑↓ vuci, ←→ njiši se, Space pušta. Kad slitiš, još moreš pucat.' },
  platform: { name: 'Daska', blurb: 'Miči miša da postaviš dasku od pet jedinica, kotačić je naginje, lijevi klik je spušta.' },
  mine: { name: 'Mina', blurb: 'Space je spusti pod noge. Naoruža se dok bižiš, pa plane svakomu tko dođe blizu.' },
  selfdestruct: { name: 'Samouništenje', blurb: 'Glavica se digne u zrak: šteta koliko joj je života ostalo, a radijus raste s njon.' },
  teleport: { name: 'Teleport', blurb: 'Klikni bilo di na kartu da se pojaviš tamo — pa pada, slitanje ili utapanje, kako ispadne.' },
  ming: { name: 'Ming vaza', blurb: 'Jedna po partiji. Šeststo godin porculana, bačeno jednom: golem prasak i osan krhotin šta svaka udara ka bomba.' },
  flamer: {
    name: 'Bacač plamena',
    blurb: 'Tri sekunde zapaljenog goriva. Gori i doli okreću mlaznicu dok radi; vitar i gravitacija nose kapi, a di padnu — tamo gori.',
  },
};

const ZH: WeaponWords = {
  bazooka: { name: '火箭筒', blurb: '按住空格蓄力。风的影响很大。碰到就炸。' },
  grenade: { name: '手榴弹', blurb: '会弹跳，3 秒引信。几乎不受风影响。' },
  cluster: { name: '集束炸弹', blurb: '红色手榴弹，3 秒引信。炸开成五枚小弹，每枚 10 点伤害。' },
  banana: { name: '香蕉炸弹', blurb: '3 秒引信，然后五根会爆炸的香蕉到处乱弹，一个接一个炸开。' },
  holy: { name: '神圣蒜头手雷', blurb: '滚到停下，唱一段哈利路亚，然后爆出惊天一击。' },
  shotgun: { name: '霰弹枪', blurb: '沿瞄准线立即打出两发。' },
  minigun: { name: '转管机枪', blurb: '一长串 14 发子弹，把对手一路推到地图另一头。' },
  punch: { name: '蒜头重拳', blurb: '近身上勾拳，把对手打上天。' },
  bat: { name: '棒球棒', blurb: '全垒打！伤害比拳头低，但能把对手打得老远。' },
  sheep: { name: '绵羊', blurb: '空格放它一蹦一蹦地跑；再按空格把它引爆。' },
  flysheep: { name: '飞天绵羊', blurb: '沿瞄准方向起飞；用方向键操控，空格引爆。' },
  airstrike: { name: '空袭', blurb: '点击地图：飞机飞过，在该处附近投下五枚炸弹。' },
  napalm: { name: '凝固汽油弹', blurb: '点击地图：飞机投下汽油弹，风会带得很远，地面会持续燃烧。' },
  mule: { name: '水泥驴', blurb: '点击地图：一头巨大的水泥驴从天而降，一路砸穿下去。' },
  torch: { name: '喷焊枪', blurb: '沿瞄准线烧出隧道，持续 3 秒并带着你前进——往上瞄就能开竖井。' },
  drill: { name: '电钻', blurb: '垂直向下钻 3 秒。钻的时候不吃摔落伤害。' },
  rope: { name: '钩索', blurb: '空格打出钩索；挂着时 ↑↓ 收放、←→ 摆荡、空格松手。落地后还能再开一枪。' },
  platform: { name: '木板', blurb: '移动鼠标放置一块五单位长的木板，滚轮调整角度，左键放下。' },
  mine: { name: '感应地雷', blurb: '空格放在脚边。你跑开时它完成布设，之后谁靠近都炸。' },
  selfdestruct: { name: '自爆', blurb: '蒜头把自己炸掉：伤害等于剩余血量，爆炸范围也随之变大。' },
  teleport: { name: '传送', blurb: '点击地图任意位置就出现在那里——然后照常下落、着地或淹死。' },
  ming: { name: '明代花瓶', blurb: '每局一件。六百年的瓷器，只能扔一次：一次巨大的爆炸，外加八片碎片，每片都像手榴弹一样。' },
  flamer: { name: '喷火器', blurb: '三秒钟的燃油。喷射时用上下键摆动喷嘴；风和重力会带着火团走，落到哪里哪里就烧起来。' },
};

const WEAPON_WORDS: Record<Language, WeaponWords> = { en: {}, de: DE, hr: HR, zh: ZH };

/** The weapon's name in the current language, or the English from the weapon table. */
export const weaponName = (id: WeaponId): string => WEAPON_WORDS[language()][id]?.name ?? WEAPONS[id].name;

/** The weapon's one-line description in the current language, or the English one. */
export const weaponBlurb = (id: WeaponId): string => WEAPON_WORDS[language()][id]?.blurb ?? WEAPONS[id].blurb;

/** Which weapons a language has no words for; empty for a finished one. Used by the tests. */
export const untranslatedWeapons = (lang: Language, ids: readonly WeaponId[]): WeaponId[] =>
  lang === 'en' ? [] : ids.filter((id) => WEAPON_WORDS[lang][id] === undefined);
