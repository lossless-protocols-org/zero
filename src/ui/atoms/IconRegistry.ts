// Per-icon modules (S1, v2.7.1): the package barrel re-exports 1,758 names and
// Metro keeps every module it touches, so importing from 'lucide-react-native'
// shipped ~1,750 icon modules for the 327 used here (335 imports: a few files
// are imported under two names, as the barrel's aliases were). File names are
// lucide's own (e.g. `Home` lives in `house`); the IconRegistry test snapshots
// every key's displayName so a wrong file is caught. That test runs on lucide's
// CJS build; the app bundles the ESM build of the same pinned version.
// Each icon loads on first use: see ICON_REGISTRY.
import type {LucideIcon} from 'lucide-react-native';

/**
 * Icon name → lucide component. Each entry is a getter that requires its
 * icon's module, so a module loads the first time its icon is drawn. As a
 * plain object of imported components, the first Icon on screen evaluated all
 * 337 icon modules (audit 2026-11-08 §8.3; the per-icon imports fixed the
 * bundle size, not the load), and Metro's inline requires cannot defer a
 * default import (it stays `_interopRequireDefault(require(…))` at the top
 * of the module). `name in ICON_REGISTRY` and Object.keys call no getter.
 */
export const ICON_REGISTRY = {
  // Navigation
  get home(): LucideIcon {
    return require('lucide-react-native/icons/house').default;
  },
  get 'bar-chart-3'(): LucideIcon {
    return require('lucide-react-native/icons/chart-column').default;
  },
  get 'credit-card'(): LucideIcon {
    return require('lucide-react-native/icons/credit-card').default;
  },
  get shapes(): LucideIcon {
    return require('lucide-react-native/icons/shapes').default;
  },
  get settings(): LucideIcon {
    return require('lucide-react-native/icons/settings').default;
  },
  get 'arrow-left'(): LucideIcon {
    return require('lucide-react-native/icons/arrow-left').default;
  },
  get 'chevron-left'(): LucideIcon {
    return require('lucide-react-native/icons/chevron-left').default;
  },
  get 'chevron-down'(): LucideIcon {
    return require('lucide-react-native/icons/chevron-down').default;
  },
  get 'chevron-right'(): LucideIcon {
    return require('lucide-react-native/icons/chevron-right').default;
  },
  get menu(): LucideIcon {
    return require('lucide-react-native/icons/menu').default;
  },

  // Actions
  get plus(): LucideIcon {
    return require('lucide-react-native/icons/plus').default;
  },
  get 'plus-circle'(): LucideIcon {
    return require('lucide-react-native/icons/circle-plus').default;
  },
  get pencil(): LucideIcon {
    return require('lucide-react-native/icons/pencil').default;
  },
  get 'trash-2'(): LucideIcon {
    return require('lucide-react-native/icons/trash').default;
  },
  get search(): LucideIcon {
    return require('lucide-react-native/icons/search').default;
  },
  get calendar(): LucideIcon {
    return require('lucide-react-native/icons/calendar').default;
  },
  get 'calendar-days'(): LucideIcon {
    return require('lucide-react-native/icons/calendar-days').default;
  },
  get filter(): LucideIcon {
    return require('lucide-react-native/icons/funnel').default;
  },
  get download(): LucideIcon {
    return require('lucide-react-native/icons/download').default;
  },
  get upload(): LucideIcon {
    return require('lucide-react-native/icons/upload').default;
  },
  get 'undo-2'(): LucideIcon {
    return require('lucide-react-native/icons/undo-2').default;
  },
  get check(): LucideIcon {
    return require('lucide-react-native/icons/check').default;
  },
  get 'check-circle'(): LucideIcon {
    return require('lucide-react-native/icons/circle-check-big').default;
  },
  get 'check-circle-2'(): LucideIcon {
    return require('lucide-react-native/icons/circle-check').default;
  },
  get x(): LucideIcon {
    return require('lucide-react-native/icons/x').default;
  },
  get 'x-circle'(): LucideIcon {
    return require('lucide-react-native/icons/circle-x').default;
  },
  get 'more-horizontal'(): LucideIcon {
    return require('lucide-react-native/icons/ellipsis').default;
  },
  get 'more-vertical'(): LucideIcon {
    return require('lucide-react-native/icons/ellipsis-vertical').default;
  },
  get 'refresh-cw'(): LucideIcon {
    return require('lucide-react-native/icons/refresh-cw').default;
  },
  get eye(): LucideIcon {
    return require('lucide-react-native/icons/eye').default;
  },
  get 'eye-off'(): LucideIcon {
    return require('lucide-react-native/icons/eye-off').default;
  },
  get copy(): LucideIcon {
    return require('lucide-react-native/icons/copy').default;
  },
  get 'share-2'(): LucideIcon {
    return require('lucide-react-native/icons/share-2').default;
  },
  get 'external-link'(): LucideIcon {
    return require('lucide-react-native/icons/external-link').default;
  },

  // Finance
  get wallet(): LucideIcon {
    return require('lucide-react-native/icons/wallet').default;
  },
  get landmark(): LucideIcon {
    return require('lucide-react-native/icons/landmark').default;
  },
  get banknote(): LucideIcon {
    return require('lucide-react-native/icons/banknote').default;
  },
  get receipt(): LucideIcon {
    return require('lucide-react-native/icons/receipt').default;
  },
  get 'piggy-bank'(): LucideIcon {
    return require('lucide-react-native/icons/piggy-bank').default;
  },
  get 'trending-up'(): LucideIcon {
    return require('lucide-react-native/icons/trending-up').default;
  },
  get 'trending-down'(): LucideIcon {
    return require('lucide-react-native/icons/trending-down').default;
  },
  get 'hand-coins'(): LucideIcon {
    return require('lucide-react-native/icons/hand-coins').default;
  },
  get coins(): LucideIcon {
    return require('lucide-react-native/icons/coins').default;
  },
  get 'circle-dollar-sign'(): LucideIcon {
    return require('lucide-react-native/icons/circle-dollar-sign').default;
  },
  get 'badge-dollar-sign'(): LucideIcon {
    return require('lucide-react-native/icons/badge-dollar-sign').default;
  },
  get 'arrow-up-circle'(): LucideIcon {
    return require('lucide-react-native/icons/circle-arrow-up').default;
  },
  get 'arrow-down-circle'(): LucideIcon {
    return require('lucide-react-native/icons/circle-arrow-down').default;
  },
  get 'arrow-up-down'(): LucideIcon {
    return require('lucide-react-native/icons/arrow-up-down').default;
  },
  get 'grip-vertical'(): LucideIcon {
    return require('lucide-react-native/icons/grip-vertical').default;
  },
  get 'arrow-left-right'(): LucideIcon {
    return require('lucide-react-native/icons/arrow-left-right').default;
  },
  get calculator(): LucideIcon {
    return require('lucide-react-native/icons/calculator').default;
  },

  // Food & Dining
  get utensils(): LucideIcon {
    return require('lucide-react-native/icons/utensils').default;
  },
  get 'utensils-crossed'(): LucideIcon {
    return require('lucide-react-native/icons/utensils-crossed').default;
  },
  get coffee(): LucideIcon {
    return require('lucide-react-native/icons/coffee').default;
  },
  get wine(): LucideIcon {
    return require('lucide-react-native/icons/wine').default;
  },
  get beer(): LucideIcon {
    return require('lucide-react-native/icons/beer').default;
  },
  get pizza(): LucideIcon {
    return require('lucide-react-native/icons/pizza').default;
  },
  get sandwich(): LucideIcon {
    return require('lucide-react-native/icons/sandwich').default;
  },
  get apple(): LucideIcon {
    return require('lucide-react-native/icons/apple').default;
  },
  get cherry(): LucideIcon {
    return require('lucide-react-native/icons/cherry').default;
  },
  get soup(): LucideIcon {
    return require('lucide-react-native/icons/soup').default;
  },
  get 'cooking-pot'(): LucideIcon {
    return require('lucide-react-native/icons/cooking-pot').default;
  },
  get 'ice-cream'(): LucideIcon {
    return require('lucide-react-native/icons/ice-cream-cone').default;
  },
  get milk(): LucideIcon {
    return require('lucide-react-native/icons/milk').default;
  },
  get croissant(): LucideIcon {
    return require('lucide-react-native/icons/croissant').default;
  },
  get salad(): LucideIcon {
    return require('lucide-react-native/icons/salad').default;
  },
  get beef(): LucideIcon {
    return require('lucide-react-native/icons/beef').default;
  },
  get fish(): LucideIcon {
    return require('lucide-react-native/icons/fish').default;
  },
  get egg(): LucideIcon {
    return require('lucide-react-native/icons/egg').default;
  },
  get cookie(): LucideIcon {
    return require('lucide-react-native/icons/cookie').default;
  },
  get cake(): LucideIcon {
    return require('lucide-react-native/icons/cake').default;
  },
  get 'cake-slice'(): LucideIcon {
    return require('lucide-react-native/icons/cake-slice').default;
  },
  get candy(): LucideIcon {
    return require('lucide-react-native/icons/candy').default;
  },
  get popcorn(): LucideIcon {
    return require('lucide-react-native/icons/popcorn').default;
  },
  get grape(): LucideIcon {
    return require('lucide-react-native/icons/grape').default;
  },
  get banana(): LucideIcon {
    return require('lucide-react-native/icons/banana').default;
  },
  get carrot(): LucideIcon {
    return require('lucide-react-native/icons/carrot').default;
  },
  get wheat(): LucideIcon {
    return require('lucide-react-native/icons/wheat').default;
  },
  get leaf(): LucideIcon {
    return require('lucide-react-native/icons/leaf').default;
  },
  get 'leafy-green'(): LucideIcon {
    return require('lucide-react-native/icons/leafy-green').default;
  },
  get citrus(): LucideIcon {
    return require('lucide-react-native/icons/citrus').default;
  },

  // Transport
  get car(): LucideIcon {
    return require('lucide-react-native/icons/car').default;
  },
  get 'car-front'(): LucideIcon {
    return require('lucide-react-native/icons/car-front').default;
  },
  get bus(): LucideIcon {
    return require('lucide-react-native/icons/bus').default;
  },
  get train(): LucideIcon {
    return require('lucide-react-native/icons/tram-front').default;
  },
  get 'tram-front'(): LucideIcon {
    return require('lucide-react-native/icons/tram-front').default;
  },
  get plane(): LucideIcon {
    return require('lucide-react-native/icons/plane').default;
  },
  get 'plane-takeoff'(): LucideIcon {
    return require('lucide-react-native/icons/plane-takeoff').default;
  },
  get 'plane-landing'(): LucideIcon {
    return require('lucide-react-native/icons/plane-landing').default;
  },
  get bike(): LucideIcon {
    return require('lucide-react-native/icons/bike').default;
  },
  get ship(): LucideIcon {
    return require('lucide-react-native/icons/ship').default;
  },
  get sailboat(): LucideIcon {
    return require('lucide-react-native/icons/sailboat').default;
  },
  get fuel(): LucideIcon {
    return require('lucide-react-native/icons/fuel').default;
  },
  get 'parking-circle'(): LucideIcon {
    return require('lucide-react-native/icons/circle-letter-p').default;
  },
  get navigation(): LucideIcon {
    return require('lucide-react-native/icons/navigation').default;
  },
  get 'map-pin'(): LucideIcon {
    return require('lucide-react-native/icons/map-pin').default;
  },
  get map(): LucideIcon {
    return require('lucide-react-native/icons/map').default;
  },
  get compass(): LucideIcon {
    return require('lucide-react-native/icons/compass').default;
  },
  get route(): LucideIcon {
    return require('lucide-react-native/icons/route').default;
  },
  get truck(): LucideIcon {
    return require('lucide-react-native/icons/truck').default;
  },
  get ambulance(): LucideIcon {
    return require('lucide-react-native/icons/ambulance').default;
  },

  // Shopping
  get 'shopping-cart'(): LucideIcon {
    return require('lucide-react-native/icons/shopping-cart').default;
  },
  get 'shopping-bag'(): LucideIcon {
    return require('lucide-react-native/icons/shopping-bag').default;
  },
  get package(): LucideIcon {
    return require('lucide-react-native/icons/package').default;
  },
  get 'package-open'(): LucideIcon {
    return require('lucide-react-native/icons/package-open').default;
  },
  get tag(): LucideIcon {
    return require('lucide-react-native/icons/tag').default;
  },
  get tags(): LucideIcon {
    return require('lucide-react-native/icons/tags').default;
  },
  get store(): LucideIcon {
    return require('lucide-react-native/icons/store').default;
  },
  get shirt(): LucideIcon {
    return require('lucide-react-native/icons/shirt').default;
  },
  get watch(): LucideIcon {
    return require('lucide-react-native/icons/watch').default;
  },
  get gem(): LucideIcon {
    return require('lucide-react-native/icons/gem').default;
  },
  get crown(): LucideIcon {
    return require('lucide-react-native/icons/crown').default;
  },
  get gift(): LucideIcon {
    return require('lucide-react-native/icons/gift').default;
  },
  get percent(): LucideIcon {
    return require('lucide-react-native/icons/percent').default;
  },
  get 'badge-percent'(): LucideIcon {
    return require('lucide-react-native/icons/badge-percent').default;
  },

  // Home & Utilities
  get house(): LucideIcon {
    return require('lucide-react-native/icons/house').default;
  },
  get building(): LucideIcon {
    return require('lucide-react-native/icons/building').default;
  },
  get 'building-2'(): LucideIcon {
    return require('lucide-react-native/icons/building-complex').default;
  },
  get lightbulb(): LucideIcon {
    return require('lucide-react-native/icons/lightbulb').default;
  },
  get zap(): LucideIcon {
    return require('lucide-react-native/icons/zap').default;
  },
  get droplet(): LucideIcon {
    return require('lucide-react-native/icons/droplet').default;
  },
  get droplets(): LucideIcon {
    return require('lucide-react-native/icons/droplets').default;
  },
  get flame(): LucideIcon {
    return require('lucide-react-native/icons/flame').default;
  },
  get wind(): LucideIcon {
    return require('lucide-react-native/icons/wind').default;
  },
  get wifi(): LucideIcon {
    return require('lucide-react-native/icons/wifi').default;
  },
  get 'wifi-off'(): LucideIcon {
    return require('lucide-react-native/icons/wifi-off').default;
  },
  get phone(): LucideIcon {
    return require('lucide-react-native/icons/phone').default;
  },
  get smartphone(): LucideIcon {
    return require('lucide-react-native/icons/smartphone').default;
  },
  get tv(): LucideIcon {
    return require('lucide-react-native/icons/tv').default;
  },
  get monitor(): LucideIcon {
    return require('lucide-react-native/icons/monitor').default;
  },
  get laptop(): LucideIcon {
    return require('lucide-react-native/icons/laptop').default;
  },
  get 'tablet-smartphone'(): LucideIcon {
    return require('lucide-react-native/icons/tablet-smartphone').default;
  },
  get 'gamepad-2'(): LucideIcon {
    return require('lucide-react-native/icons/gamepad-2').default;
  },
  get plug(): LucideIcon {
    return require('lucide-react-native/icons/plug').default;
  },
  get cable(): LucideIcon {
    return require('lucide-react-native/icons/cable').default;
  },
  get thermometer(): LucideIcon {
    return require('lucide-react-native/icons/thermometer').default;
  },
  get 'air-vent'(): LucideIcon {
    return require('lucide-react-native/icons/air-vent').default;
  },
  get bath(): LucideIcon {
    return require('lucide-react-native/icons/bath').default;
  },
  get 'bed-double'(): LucideIcon {
    return require('lucide-react-native/icons/bed-double').default;
  },
  get sofa(): LucideIcon {
    return require('lucide-react-native/icons/sofa').default;
  },
  get lamp(): LucideIcon {
    return require('lucide-react-native/icons/lamp').default;
  },
  get 'door-open'(): LucideIcon {
    return require('lucide-react-native/icons/door-open').default;
  },
  get key(): LucideIcon {
    return require('lucide-react-native/icons/key').default;
  },
  get lock(): LucideIcon {
    return require('lucide-react-native/icons/lock').default;
  },
  get unlock(): LucideIcon {
    return require('lucide-react-native/icons/lock-open').default;
  },
  get 'shield-check'(): LucideIcon {
    return require('lucide-react-native/icons/shield-check').default;
  },
  get shield(): LucideIcon {
    return require('lucide-react-native/icons/shield').default;
  },

  // Health & Wellness
  get heart(): LucideIcon {
    return require('lucide-react-native/icons/heart').default;
  },
  get 'heart-pulse'(): LucideIcon {
    return require('lucide-react-native/icons/heart-pulse').default;
  },
  get activity(): LucideIcon {
    return require('lucide-react-native/icons/activity').default;
  },
  get pill(): LucideIcon {
    return require('lucide-react-native/icons/pill').default;
  },
  get stethoscope(): LucideIcon {
    return require('lucide-react-native/icons/stethoscope').default;
  },
  get syringe(): LucideIcon {
    return require('lucide-react-native/icons/syringe').default;
  },
  get bandaid(): LucideIcon {
    return require('lucide-react-native/icons/bandage').default;
  },
  get hospital(): LucideIcon {
    return require('lucide-react-native/icons/hospital').default;
  },
  get cross(): LucideIcon {
    return require('lucide-react-native/icons/cross').default;
  },
  get brain(): LucideIcon {
    return require('lucide-react-native/icons/brain').default;
  },
  get dumbbell(): LucideIcon {
    return require('lucide-react-native/icons/dumbbell').default;
  },
  get 'person-standing'(): LucideIcon {
    return require('lucide-react-native/icons/person-standing').default;
  },
  get footprints(): LucideIcon {
    return require('lucide-react-native/icons/footprints').default;
  },
  get glasses(): LucideIcon {
    return require('lucide-react-native/icons/glasses').default;
  },
  get ear(): LucideIcon {
    return require('lucide-react-native/icons/ear').default;
  },
  get hand(): LucideIcon {
    return require('lucide-react-native/icons/hand').default;
  },
  get smile(): LucideIcon {
    return require('lucide-react-native/icons/face-slightly-smiling').default;
  },
  get frown(): LucideIcon {
    return require('lucide-react-native/icons/face-slightly-frowning').default;
  },
  get meh(): LucideIcon {
    return require('lucide-react-native/icons/face-neutral').default;
  },
  get moon(): LucideIcon {
    return require('lucide-react-native/icons/moon').default;
  },
  get sun(): LucideIcon {
    return require('lucide-react-native/icons/sun').default;
  },
  get 'sun-moon'(): LucideIcon {
    return require('lucide-react-native/icons/sun-moon').default;
  },
  get 'cloud-sun'(): LucideIcon {
    return require('lucide-react-native/icons/cloud-sun').default;
  },
  get umbrella(): LucideIcon {
    return require('lucide-react-native/icons/umbrella').default;
  },

  // Entertainment
  get music(): LucideIcon {
    return require('lucide-react-native/icons/eighth-notes').default;
  },
  get 'music-2'(): LucideIcon {
    return require('lucide-react-native/icons/eighth-note').default;
  },
  get 'music-4'(): LucideIcon {
    return require('lucide-react-native/icons/sixteenth-notes').default;
  },
  get headphones(): LucideIcon {
    return require('lucide-react-native/icons/headphones').default;
  },
  get film(): LucideIcon {
    return require('lucide-react-native/icons/film').default;
  },
  get clapperboard(): LucideIcon {
    return require('lucide-react-native/icons/clapperboard').default;
  },
  get camera(): LucideIcon {
    return require('lucide-react-native/icons/camera').default;
  },
  get image(): LucideIcon {
    return require('lucide-react-native/icons/image').default;
  },
  get images(): LucideIcon {
    return require('lucide-react-native/icons/images').default;
  },
  get palette(): LucideIcon {
    return require('lucide-react-native/icons/palette').default;
  },
  get 'paint-bucket'(): LucideIcon {
    return require('lucide-react-native/icons/paint-bucket').default;
  },
  get brush(): LucideIcon {
    return require('lucide-react-native/icons/brush').default;
  },
  get scissors(): LucideIcon {
    return require('lucide-react-native/icons/scissors').default;
  },
  get sparkles(): LucideIcon {
    return require('lucide-react-native/icons/sparkles').default;
  },
  get 'party-popper'(): LucideIcon {
    return require('lucide-react-native/icons/party-popper').default;
  },
  get drama(): LucideIcon {
    return require('lucide-react-native/icons/drama').default;
  },
  get ticket(): LucideIcon {
    return require('lucide-react-native/icons/ticket').default;
  },
  get 'dice-5'(): LucideIcon {
    return require('lucide-react-native/icons/dice-5').default;
  },
  get puzzle(): LucideIcon {
    return require('lucide-react-native/icons/puzzle').default;
  },
  get blocks(): LucideIcon {
    return require('lucide-react-native/icons/blocks').default;
  },
  get book(): LucideIcon {
    return require('lucide-react-native/icons/book').default;
  },
  get 'book-open'(): LucideIcon {
    return require('lucide-react-native/icons/book-open').default;
  },
  get 'book-marked'(): LucideIcon {
    return require('lucide-react-native/icons/book-bookmark').default;
  },
  get newspaper(): LucideIcon {
    return require('lucide-react-native/icons/newspaper').default;
  },
  get radio(): LucideIcon {
    return require('lucide-react-native/icons/radio').default;
  },
  get mic(): LucideIcon {
    return require('lucide-react-native/icons/mic').default;
  },
  get 'volume-2'(): LucideIcon {
    return require('lucide-react-native/icons/volume-2').default;
  },

  // Education & Work
  get 'graduation-cap'(): LucideIcon {
    return require('lucide-react-native/icons/graduation-cap').default;
  },
  get school(): LucideIcon {
    return require('lucide-react-native/icons/school').default;
  },
  get notebook(): LucideIcon {
    return require('lucide-react-native/icons/notebook').default;
  },
  get 'notebook-pen'(): LucideIcon {
    return require('lucide-react-native/icons/notebook-pen').default;
  },
  get 'file-spreadsheet'(): LucideIcon {
    return require('lucide-react-native/icons/file-spreadsheet').default;
  },
  get 'file-text'(): LucideIcon {
    return require('lucide-react-native/icons/file-text').default;
  },
  get files(): LucideIcon {
    return require('lucide-react-native/icons/files').default;
  },
  get 'folder-open'(): LucideIcon {
    return require('lucide-react-native/icons/folder-open').default;
  },
  get briefcase(): LucideIcon {
    return require('lucide-react-native/icons/briefcase').default;
  },
  get 'badge-check'(): LucideIcon {
    return require('lucide-react-native/icons/badge-check').default;
  },
  get award(): LucideIcon {
    return require('lucide-react-native/icons/award').default;
  },
  get trophy(): LucideIcon {
    return require('lucide-react-native/icons/trophy').default;
  },
  get medal(): LucideIcon {
    return require('lucide-react-native/icons/medal').default;
  },
  get target(): LucideIcon {
    return require('lucide-react-native/icons/target').default;
  },
  get 'lightbulb-idea'(): LucideIcon {
    return require('lucide-react-native/icons/lightbulb').default;
  },
  get 'pen-tool'(): LucideIcon {
    return require('lucide-react-native/icons/pen-tool').default;
  },
  get ruler(): LucideIcon {
    return require('lucide-react-native/icons/ruler').default;
  },
  get presentation(): LucideIcon {
    return require('lucide-react-native/icons/presentation').default;
  },

  // Pets & Animals
  get 'paw-print'(): LucideIcon {
    return require('lucide-react-native/icons/paw-print').default;
  },
  get cat(): LucideIcon {
    return require('lucide-react-native/icons/cat').default;
  },
  get dog(): LucideIcon {
    return require('lucide-react-native/icons/dog').default;
  },
  get bird(): LucideIcon {
    return require('lucide-react-native/icons/bird').default;
  },
  get bug(): LucideIcon {
    return require('lucide-react-native/icons/bug').default;
  },
  get 'fish-animal'(): LucideIcon {
    return require('lucide-react-native/icons/fish').default;
  },
  get rabbit(): LucideIcon {
    return require('lucide-react-native/icons/rabbit').default;
  },
  get squirrel(): LucideIcon {
    return require('lucide-react-native/icons/squirrel').default;
  },
  get snail(): LucideIcon {
    return require('lucide-react-native/icons/snail').default;
  },
  get turtle(): LucideIcon {
    return require('lucide-react-native/icons/turtle').default;
  },

  // Nature & Outdoors
  get trees(): LucideIcon {
    return require('lucide-react-native/icons/trees').default;
  },
  get 'tree-deciduous'(): LucideIcon {
    return require('lucide-react-native/icons/tree-deciduous').default;
  },
  get 'tree-pine'(): LucideIcon {
    return require('lucide-react-native/icons/tree-pine').default;
  },
  get flower(): LucideIcon {
    return require('lucide-react-native/icons/flower').default;
  },
  get 'flower-2'(): LucideIcon {
    return require('lucide-react-native/icons/flower-2').default;
  },
  get sprout(): LucideIcon {
    return require('lucide-react-native/icons/sprout').default;
  },
  get clover(): LucideIcon {
    return require('lucide-react-native/icons/clover').default;
  },
  get mountain(): LucideIcon {
    return require('lucide-react-native/icons/mountain').default;
  },
  get 'mountain-snow'(): LucideIcon {
    return require('lucide-react-native/icons/mountain-snow').default;
  },
  get waves(): LucideIcon {
    return require('lucide-react-native/icons/waves-horizontal').default;
  },
  get tent(): LucideIcon {
    return require('lucide-react-native/icons/tent').default;
  },
  get campfire(): LucideIcon {
    return require('lucide-react-native/icons/flame-kindling').default;
  },
  get flashlight(): LucideIcon {
    return require('lucide-react-native/icons/flashlight').default;
  },
  get backpack(): LucideIcon {
    return require('lucide-react-native/icons/backpack').default;
  },
  get luggage(): LucideIcon {
    return require('lucide-react-native/icons/luggage').default;
  },
  get globe(): LucideIcon {
    return require('lucide-react-native/icons/globe').default;
  },
  get 'globe-2'(): LucideIcon {
    return require('lucide-react-native/icons/earth').default;
  },
  get earth(): LucideIcon {
    return require('lucide-react-native/icons/earth').default;
  },
  get sunrise(): LucideIcon {
    return require('lucide-react-native/icons/sunrise').default;
  },
  get sunset(): LucideIcon {
    return require('lucide-react-native/icons/sunset').default;
  },
  get cloud(): LucideIcon {
    return require('lucide-react-native/icons/cloud').default;
  },
  get 'cloud-rain'(): LucideIcon {
    return require('lucide-react-native/icons/cloud-rain').default;
  },
  get snowflake(): LucideIcon {
    return require('lucide-react-native/icons/snowflake').default;
  },
  get star(): LucideIcon {
    return require('lucide-react-native/icons/star').default;
  },
  get sparkle(): LucideIcon {
    return require('lucide-react-native/icons/sparkle').default;
  },

  // Communication
  get 'message-circle'(): LucideIcon {
    return require('lucide-react-native/icons/message-circle').default;
  },
  get 'message-square'(): LucideIcon {
    return require('lucide-react-native/icons/message-square').default;
  },
  get mail(): LucideIcon {
    return require('lucide-react-native/icons/mail').default;
  },
  get 'mail-open'(): LucideIcon {
    return require('lucide-react-native/icons/mail-open').default;
  },
  get send(): LucideIcon {
    return require('lucide-react-native/icons/send').default;
  },
  get 'at-sign'(): LucideIcon {
    return require('lucide-react-native/icons/at-sign').default;
  },
  get bell(): LucideIcon {
    return require('lucide-react-native/icons/bell').default;
  },
  get 'bell-ring'(): LucideIcon {
    return require('lucide-react-native/icons/bell-ring').default;
  },
  get megaphone(): LucideIcon {
    return require('lucide-react-native/icons/megaphone').default;
  },

  // Social & People
  get users(): LucideIcon {
    return require('lucide-react-native/icons/users').default;
  },
  get user(): LucideIcon {
    return require('lucide-react-native/icons/user').default;
  },
  get 'user-plus'(): LucideIcon {
    return require('lucide-react-native/icons/user-plus').default;
  },
  get 'user-minus'(): LucideIcon {
    return require('lucide-react-native/icons/user-minus').default;
  },
  get 'user-check'(): LucideIcon {
    return require('lucide-react-native/icons/user-check').default;
  },
  get 'users-2'(): LucideIcon {
    return require('lucide-react-native/icons/users-round').default;
  },
  get baby(): LucideIcon {
    return require('lucide-react-native/icons/baby').default;
  },
  get handshake(): LucideIcon {
    return require('lucide-react-native/icons/handshake').default;
  },
  get 'heart-handshake'(): LucideIcon {
    return require('lucide-react-native/icons/heart-handshake').default;
  },
  get 'thumbs-up'(): LucideIcon {
    return require('lucide-react-native/icons/thumbs-up').default;
  },
  get 'thumbs-down'(): LucideIcon {
    return require('lucide-react-native/icons/thumbs-down').default;
  },

  // Tech & Development
  get code(): LucideIcon {
    return require('lucide-react-native/icons/code').default;
  },
  get terminal(): LucideIcon {
    return require('lucide-react-native/icons/terminal').default;
  },
  get database(): LucideIcon {
    return require('lucide-react-native/icons/database').default;
  },
  get server(): LucideIcon {
    return require('lucide-react-native/icons/server').default;
  },
  get 'hard-drive'(): LucideIcon {
    return require('lucide-react-native/icons/hard-drive').default;
  },
  get cpu(): LucideIcon {
    return require('lucide-react-native/icons/cpu').default;
  },
  get usb(): LucideIcon {
    return require('lucide-react-native/icons/usb').default;
  },
  get bluetooth(): LucideIcon {
    return require('lucide-react-native/icons/bluetooth').default;
  },
  get printer(): LucideIcon {
    return require('lucide-react-native/icons/printer').default;
  },
  get keyboard(): LucideIcon {
    return require('lucide-react-native/icons/keyboard').default;
  },
  get 'scan-line'(): LucideIcon {
    return require('lucide-react-native/icons/scan-line').default;
  },
  get 'qr-code'(): LucideIcon {
    return require('lucide-react-native/icons/qr-code').default;
  },
  get fingerprint(): LucideIcon {
    return require('lucide-react-native/icons/fingerprint-pattern').default;
  },
  get bot(): LucideIcon {
    return require('lucide-react-native/icons/bot').default;
  },
  get 'circuit-board'(): LucideIcon {
    return require('lucide-react-native/icons/circuit-board').default;
  },

  // Miscellaneous
  get clock(): LucideIcon {
    return require('lucide-react-native/icons/clock').default;
  },
  get timer(): LucideIcon {
    return require('lucide-react-native/icons/timer').default;
  },
  get hourglass(): LucideIcon {
    return require('lucide-react-native/icons/hourglass').default;
  },
  get alarm(): LucideIcon {
    return require('lucide-react-native/icons/alarm-clock').default;
  },
  get 'rotate-ccw'(): LucideIcon {
    return require('lucide-react-native/icons/rotate-ccw').default;
  },
  get 'rotate-cw'(): LucideIcon {
    return require('lucide-react-native/icons/rotate-cw').default;
  },
  get repeat(): LucideIcon {
    return require('lucide-react-native/icons/repeat').default;
  },
  get infinity(): LucideIcon {
    return require('lucide-react-native/icons/infinity').default;
  },
  get hash(): LucideIcon {
    return require('lucide-react-native/icons/hash').default;
  },
  get asterisk(): LucideIcon {
    return require('lucide-react-native/icons/asterisk').default;
  },
  get 'circle-dot'(): LucideIcon {
    return require('lucide-react-native/icons/circle-dot').default;
  },
  get circle(): LucideIcon {
    return require('lucide-react-native/icons/circle').default;
  },
  get square(): LucideIcon {
    return require('lucide-react-native/icons/square').default;
  },
  get triangle(): LucideIcon {
    return require('lucide-react-native/icons/triangle').default;
  },
  get hexagon(): LucideIcon {
    return require('lucide-react-native/icons/hexagon').default;
  },
  get octagon(): LucideIcon {
    return require('lucide-react-native/icons/octagon').default;
  },
  get flag(): LucideIcon {
    return require('lucide-react-native/icons/flag').default;
  },
  get bookmark(): LucideIcon {
    return require('lucide-react-native/icons/bookmark').default;
  },
  get pin(): LucideIcon {
    return require('lucide-react-native/icons/pin').default;
  },
  get paperclip(): LucideIcon {
    return require('lucide-react-native/icons/paperclip').default;
  },
  get link(): LucideIcon {
    return require('lucide-react-native/icons/link').default;
  },
  get unlink(): LucideIcon {
    return require('lucide-react-native/icons/unlink').default;
  },
  get anchor(): LucideIcon {
    return require('lucide-react-native/icons/anchor').default;
  },
  get wrench(): LucideIcon {
    return require('lucide-react-native/icons/wrench').default;
  },
  get hammer(): LucideIcon {
    return require('lucide-react-native/icons/hammer').default;
  },
  get axe(): LucideIcon {
    return require('lucide-react-native/icons/axe').default;
  },
  get shovel(): LucideIcon {
    return require('lucide-react-native/icons/shovel').default;
  },
  get paintbrush(): LucideIcon {
    return require('lucide-react-native/icons/paintbrush').default;
  },
  get eraser(): LucideIcon {
    return require('lucide-react-native/icons/eraser').default;
  },
  get 'scissors-tool'(): LucideIcon {
    return require('lucide-react-native/icons/scissors').default;
  },
  get slice(): LucideIcon {
    return require('lucide-react-native/icons/slice').default;
  },
  get box(): LucideIcon {
    return require('lucide-react-native/icons/box').default;
  },
  get archive(): LucideIcon {
    return require('lucide-react-native/icons/archive').default;
  },
  get inbox(): LucideIcon {
    return require('lucide-react-native/icons/inbox').default;
  },
  get 'send-icon'(): LucideIcon {
    return require('lucide-react-native/icons/send').default;
  },
  get 'log-in'(): LucideIcon {
    return require('lucide-react-native/icons/log-in').default;
  },
  get 'log-out'(): LucideIcon {
    return require('lucide-react-native/icons/log-out').default;
  },
  get power(): LucideIcon {
    return require('lucide-react-native/icons/power').default;
  },
  get 'toggle-left'(): LucideIcon {
    return require('lucide-react-native/icons/toggle-left').default;
  },
  get 'toggle-right'(): LucideIcon {
    return require('lucide-react-native/icons/toggle-right').default;
  },
  get 'sliders-horizontal'(): LucideIcon {
    return require('lucide-react-native/icons/sliders-horizontal').default;
  },
  get 'settings-2'(): LucideIcon {
    return require('lucide-react-native/icons/settings-2').default;
  },
  get cog(): LucideIcon {
    return require('lucide-react-native/icons/cog').default;
  },
  get 'help-circle'(): LucideIcon {
    return require('lucide-react-native/icons/circle-question-mark').default;
  },
  get info(): LucideIcon {
    return require('lucide-react-native/icons/info').default;
  },
  get 'alert-circle'(): LucideIcon {
    return require('lucide-react-native/icons/circle-alert').default;
  },
  get 'alert-triangle'(): LucideIcon {
    return require('lucide-react-native/icons/triangle-alert').default;
  },
  get ban(): LucideIcon {
    return require('lucide-react-native/icons/ban').default;
  },
  get 'shield-alert'(): LucideIcon {
    return require('lucide-react-native/icons/shield-alert').default;
  },
  get verified(): LucideIcon {
    return require('lucide-react-native/icons/badge-check').default;
  },
  get 'badge-info'(): LucideIcon {
    return require('lucide-react-native/icons/badge-info').default;
  },
} as const;

export type IconName = keyof typeof ICON_REGISTRY;

export const isValidIconName = (name: string): name is IconName => {
  return name in ICON_REGISTRY;
};
