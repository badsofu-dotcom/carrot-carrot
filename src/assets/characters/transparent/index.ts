// 35 transparent bunny variants

import angel_1x from "./bunny_angel.webp?url";
import angel_2x from "./bunny_angel@2x.webp?url";
import angry_1x from "./bunny_angry.webp?url";
import angry_2x from "./bunny_angry@2x.webp?url";
import astronaut_1x from "./bunny_astronaut.webp?url";
import astronaut_2x from "./bunny_astronaut@2x.webp?url";
import carrying_1x from "./bunny_carrying.webp?url";
import carrying_2x from "./bunny_carrying@2x.webp?url";
import chef_1x from "./bunny_chef.webp?url";
import chef_2x from "./bunny_chef@2x.webp?url";
import confused_1x from "./bunny_confused.webp?url";
import confused_2x from "./bunny_confused@2x.webp?url";
import cool_1x from "./bunny_cool.webp?url";
import cool_2x from "./bunny_cool@2x.webp?url";
import detective_1x from "./bunny_detective.webp?url";
import detective_2x from "./bunny_detective@2x.webp?url";
import digging_1x from "./bunny_digging.webp?url";
import digging_2x from "./bunny_digging@2x.webp?url";
import excited_1x from "./bunny_excited.webp?url";
import excited_2x from "./bunny_excited@2x.webp?url";
import farming_sweat_1x from "./bunny_farming_sweat.webp?url";
import farming_sweat_2x from "./bunny_farming_sweat@2x.webp?url";
import happy_1x from "./bunny_happy.webp?url";
import happy_2x from "./bunny_happy@2x.webp?url";
import harvesting_1x from "./bunny_harvesting.webp?url";
import harvesting_2x from "./bunny_harvesting@2x.webp?url";
import laugh_1x from "./bunny_laugh.webp?url";
import laugh_2x from "./bunny_laugh@2x.webp?url";
import love_1x from "./bunny_love.webp?url";
import love_2x from "./bunny_love@2x.webp?url";
import ninja_1x from "./bunny_ninja.webp?url";
import ninja_2x from "./bunny_ninja@2x.webp?url";
import pirate_1x from "./bunny_pirate.webp?url";
import pirate_2x from "./bunny_pirate@2x.webp?url";
import planting_1x from "./bunny_planting.webp?url";
import planting_2x from "./bunny_planting@2x.webp?url";
import proud_1x from "./bunny_proud.webp?url";
import proud_2x from "./bunny_proud@2x.webp?url";
import samurai_1x from "./bunny_samurai.webp?url";
import samurai_2x from "./bunny_samurai@2x.webp?url";
import santa_1x from "./bunny_santa.webp?url";
import santa_2x from "./bunny_santa@2x.webp?url";
import scared_1x from "./bunny_scared.webp?url";
import scared_2x from "./bunny_scared@2x.webp?url";
import scientist_1x from "./bunny_scientist.webp?url";
import scientist_2x from "./bunny_scientist@2x.webp?url";
import shy_1x from "./bunny_shy.webp?url";
import shy_2x from "./bunny_shy@2x.webp?url";
import sleeping_in_field_1x from "./bunny_sleeping_in_field.webp?url";
import sleeping_in_field_2x from "./bunny_sleeping_in_field@2x.webp?url";
import sleepy_1x from "./bunny_sleepy.webp?url";
import sleepy_2x from "./bunny_sleepy@2x.webp?url";
import stretching_1x from "./bunny_stretching.webp?url";
import stretching_2x from "./bunny_stretching@2x.webp?url";
import sulk_1x from "./bunny_sulk.webp?url";
import sulk_2x from "./bunny_sulk@2x.webp?url";
import surprised_1x from "./bunny_surprised.webp?url";
import surprised_2x from "./bunny_surprised@2x.webp?url";
import thinking_1x from "./bunny_thinking.webp?url";
import thinking_2x from "./bunny_thinking@2x.webp?url";
import tired_1x from "./bunny_tired.webp?url";
import tired_2x from "./bunny_tired@2x.webp?url";
import vampire_1x from "./bunny_vampire.webp?url";
import vampire_2x from "./bunny_vampire@2x.webp?url";
import watering_1x from "./bunny_watering.webp?url";
import watering_2x from "./bunny_watering@2x.webp?url";
import waving_1x from "./bunny_waving.webp?url";
import waving_2x from "./bunny_waving@2x.webp?url";
import wink_1x from "./bunny_wink.webp?url";
import wink_2x from "./bunny_wink@2x.webp?url";

export interface TransparentBunnyAsset {
  src: string;
  srcSet: string;
}

function pair(a: string, b: string): TransparentBunnyAsset {
  return { src: a, srcSet: `${a} 1x, ${b} 2x` };
}

/**
 * 35 transparent-bg (RGBA) bunny variants generated from
 * /mnt/c/dev/bunny_characters/. Used for the farm visitor sprite where
 * we want the bunny to sit on the farm card without the cream square
 * surrounding it. Source PNGs are 1024×1024; output is 256/512 webp.
 *
 * The 12 dogam characters get mapped via BUNNY_TRANSPARENT_FOR_BUNNY_KEY
 * in ../index.ts; the remaining 23 are kept here for future use (Round
 * 18+ dogam expansion).
 */
export const transparentBunnyImages = {
  angel: pair(angel_1x, angel_2x),
  angry: pair(angry_1x, angry_2x),
  astronaut: pair(astronaut_1x, astronaut_2x),
  carrying: pair(carrying_1x, carrying_2x),
  chef: pair(chef_1x, chef_2x),
  confused: pair(confused_1x, confused_2x),
  cool: pair(cool_1x, cool_2x),
  detective: pair(detective_1x, detective_2x),
  digging: pair(digging_1x, digging_2x),
  excited: pair(excited_1x, excited_2x),
  farming_sweat: pair(farming_sweat_1x, farming_sweat_2x),
  happy: pair(happy_1x, happy_2x),
  harvesting: pair(harvesting_1x, harvesting_2x),
  laugh: pair(laugh_1x, laugh_2x),
  love: pair(love_1x, love_2x),
  ninja: pair(ninja_1x, ninja_2x),
  pirate: pair(pirate_1x, pirate_2x),
  planting: pair(planting_1x, planting_2x),
  proud: pair(proud_1x, proud_2x),
  samurai: pair(samurai_1x, samurai_2x),
  santa: pair(santa_1x, santa_2x),
  scared: pair(scared_1x, scared_2x),
  scientist: pair(scientist_1x, scientist_2x),
  shy: pair(shy_1x, shy_2x),
  sleeping_in_field: pair(sleeping_in_field_1x, sleeping_in_field_2x),
  sleepy: pair(sleepy_1x, sleepy_2x),
  stretching: pair(stretching_1x, stretching_2x),
  sulk: pair(sulk_1x, sulk_2x),
  surprised: pair(surprised_1x, surprised_2x),
  thinking: pair(thinking_1x, thinking_2x),
  tired: pair(tired_1x, tired_2x),
  vampire: pair(vampire_1x, vampire_2x),
  watering: pair(watering_1x, watering_2x),
  waving: pair(waving_1x, waving_2x),
  wink: pair(wink_1x, wink_2x),
} as const;

export type TransparentBunnyKey = keyof typeof transparentBunnyImages;
