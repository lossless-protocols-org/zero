// Per-icon imports (S1, v2.7.1): the package barrel re-exports 1,758 names and
// Metro keeps every module it touches, so importing from 'lucide-react-native'
// shipped ~1,750 icon modules for the 327 used here (335 imports: a few files
// are imported under two names, as the barrel's aliases were). File names are
// lucide's own (e.g. `Home` lives in `house`); the IconRegistry test snapshots
// every key's displayName so a wrong file is caught. That test runs on lucide's
// CJS build; the app bundles the ESM build of the same pinned version.
// Navigation
import Home from 'lucide-react-native/icons/house';
import BarChart3 from 'lucide-react-native/icons/chart-column';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Shapes from 'lucide-react-native/icons/shapes';
import Settings from 'lucide-react-native/icons/settings';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Menu from 'lucide-react-native/icons/menu';

// Actions
import Plus from 'lucide-react-native/icons/plus';
import PlusCircle from 'lucide-react-native/icons/circle-plus';
import Pencil from 'lucide-react-native/icons/pencil';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Search from 'lucide-react-native/icons/search';
import Calendar from 'lucide-react-native/icons/calendar';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Filter from 'lucide-react-native/icons/funnel';
import Download from 'lucide-react-native/icons/download';
import Upload from 'lucide-react-native/icons/upload';
import Undo2 from 'lucide-react-native/icons/undo-2';
import Check from 'lucide-react-native/icons/check';
import CheckCircle from 'lucide-react-native/icons/circle-check-big';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import X from 'lucide-react-native/icons/x';
import XCircle from 'lucide-react-native/icons/circle-x';
import MoreHorizontal from 'lucide-react-native/icons/ellipsis';
import MoreVertical from 'lucide-react-native/icons/ellipsis-vertical';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Copy from 'lucide-react-native/icons/copy';
import Share2 from 'lucide-react-native/icons/share-2';
import ExternalLink from 'lucide-react-native/icons/external-link';

// Finance
import Wallet from 'lucide-react-native/icons/wallet';
import Landmark from 'lucide-react-native/icons/landmark';
import Banknote from 'lucide-react-native/icons/banknote';
import Receipt from 'lucide-react-native/icons/receipt';
import PiggyBank from 'lucide-react-native/icons/piggy-bank';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import Coins from 'lucide-react-native/icons/coins';
import CircleDollarSign from 'lucide-react-native/icons/circle-dollar-sign';
import BadgeDollarSign from 'lucide-react-native/icons/badge-dollar-sign';
import ArrowUpCircle from 'lucide-react-native/icons/circle-arrow-up';
import ArrowDownCircle from 'lucide-react-native/icons/circle-arrow-down';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import Calculator from 'lucide-react-native/icons/calculator';

// Food & Dining
import Utensils from 'lucide-react-native/icons/utensils';
import UtensilsCrossed from 'lucide-react-native/icons/utensils-crossed';
import Coffee from 'lucide-react-native/icons/coffee';
import Wine from 'lucide-react-native/icons/wine';
import Beer from 'lucide-react-native/icons/beer';
import Pizza from 'lucide-react-native/icons/pizza';
import Sandwich from 'lucide-react-native/icons/sandwich';
import Apple from 'lucide-react-native/icons/apple';
import Cherry from 'lucide-react-native/icons/cherry';
import Soup from 'lucide-react-native/icons/soup';
import CookingPot from 'lucide-react-native/icons/cooking-pot';
import IceCream from 'lucide-react-native/icons/ice-cream-cone';
import Milk from 'lucide-react-native/icons/milk';
import Croissant from 'lucide-react-native/icons/croissant';
import Salad from 'lucide-react-native/icons/salad';
import Beef from 'lucide-react-native/icons/beef';
import Fish from 'lucide-react-native/icons/fish';
import Egg from 'lucide-react-native/icons/egg';
import Cookie from 'lucide-react-native/icons/cookie';
import Cake from 'lucide-react-native/icons/cake';
import CakeSlice from 'lucide-react-native/icons/cake-slice';
import Candy from 'lucide-react-native/icons/candy';
import Popcorn from 'lucide-react-native/icons/popcorn';
import Grape from 'lucide-react-native/icons/grape';
import Banana from 'lucide-react-native/icons/banana';
import Carrot from 'lucide-react-native/icons/carrot';
import Wheat from 'lucide-react-native/icons/wheat';
import Leaf from 'lucide-react-native/icons/leaf';
import LeafyGreen from 'lucide-react-native/icons/leafy-green';
import Citrus from 'lucide-react-native/icons/citrus';

// Transport
import Car from 'lucide-react-native/icons/car';
import CarFront from 'lucide-react-native/icons/car-front';
import Bus from 'lucide-react-native/icons/bus';
import Train from 'lucide-react-native/icons/tram-front';
import TramFront from 'lucide-react-native/icons/tram-front';
import Plane from 'lucide-react-native/icons/plane';
import PlaneTakeoff from 'lucide-react-native/icons/plane-takeoff';
import PlaneLanding from 'lucide-react-native/icons/plane-landing';
import Bike from 'lucide-react-native/icons/bike';
import Ship from 'lucide-react-native/icons/ship';
import Sailboat from 'lucide-react-native/icons/sailboat';
import Fuel from 'lucide-react-native/icons/fuel';
import ParkingCircle from 'lucide-react-native/icons/circle-parking';
import Navigation from 'lucide-react-native/icons/navigation';
import MapPin from 'lucide-react-native/icons/map-pin';
import Map from 'lucide-react-native/icons/map';
import Compass from 'lucide-react-native/icons/compass';
import Route from 'lucide-react-native/icons/route';
import Truck from 'lucide-react-native/icons/truck';
import Ambulance from 'lucide-react-native/icons/ambulance';

// Shopping
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import Package from 'lucide-react-native/icons/package';
import PackageOpen from 'lucide-react-native/icons/package-open';
import Tag from 'lucide-react-native/icons/tag';
import Tags from 'lucide-react-native/icons/tags';
import Store from 'lucide-react-native/icons/store';
import Shirt from 'lucide-react-native/icons/shirt';
import Watch from 'lucide-react-native/icons/watch';
import Gem from 'lucide-react-native/icons/gem';
import Crown from 'lucide-react-native/icons/crown';
import Gift from 'lucide-react-native/icons/gift';
import Percent from 'lucide-react-native/icons/percent';
import BadgePercent from 'lucide-react-native/icons/badge-percent';

// Home & Utilities
import House from 'lucide-react-native/icons/house';
import Building from 'lucide-react-native/icons/building';
import Building2 from 'lucide-react-native/icons/building-2';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import Zap from 'lucide-react-native/icons/zap';
import Droplet from 'lucide-react-native/icons/droplet';
import Droplets from 'lucide-react-native/icons/droplets';
import Flame from 'lucide-react-native/icons/flame';
import Wind from 'lucide-react-native/icons/wind';
import Wifi from 'lucide-react-native/icons/wifi';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import Phone from 'lucide-react-native/icons/phone';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Tv from 'lucide-react-native/icons/tv';
import Monitor from 'lucide-react-native/icons/monitor';
import Laptop from 'lucide-react-native/icons/laptop';
import TabletSmartphone from 'lucide-react-native/icons/tablet-smartphone';
import Gamepad2 from 'lucide-react-native/icons/gamepad-2';
import Plug from 'lucide-react-native/icons/plug';
import Cable from 'lucide-react-native/icons/cable';
import Thermometer from 'lucide-react-native/icons/thermometer';
import AirVent from 'lucide-react-native/icons/air-vent';
import Bath from 'lucide-react-native/icons/bath';
import BedDouble from 'lucide-react-native/icons/bed-double';
import Sofa from 'lucide-react-native/icons/sofa';
import Lamp from 'lucide-react-native/icons/lamp';
import DoorOpen from 'lucide-react-native/icons/door-open';
import Key from 'lucide-react-native/icons/key';
import Lock from 'lucide-react-native/icons/lock';
import Unlock from 'lucide-react-native/icons/lock-open';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Shield from 'lucide-react-native/icons/shield';

// Health & Wellness
import Heart from 'lucide-react-native/icons/heart';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import Activity from 'lucide-react-native/icons/activity';
import Pill from 'lucide-react-native/icons/pill';
import Stethoscope from 'lucide-react-native/icons/stethoscope';
import Syringe from 'lucide-react-native/icons/syringe';
import Bandage from 'lucide-react-native/icons/bandage';
import Hospital from 'lucide-react-native/icons/hospital';
import Cross from 'lucide-react-native/icons/cross';
import Brain from 'lucide-react-native/icons/brain';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import PersonStanding from 'lucide-react-native/icons/person-standing';
import Footprints from 'lucide-react-native/icons/footprints';
import Glasses from 'lucide-react-native/icons/glasses';
import Ear from 'lucide-react-native/icons/ear';
import Hand from 'lucide-react-native/icons/hand';
import Smile from 'lucide-react-native/icons/smile';
import Frown from 'lucide-react-native/icons/frown';
import Meh from 'lucide-react-native/icons/meh';
import Moon from 'lucide-react-native/icons/moon';
import Sun from 'lucide-react-native/icons/sun';
import SunMoon from 'lucide-react-native/icons/sun-moon';
import CloudSun from 'lucide-react-native/icons/cloud-sun';
import Umbrella from 'lucide-react-native/icons/umbrella';

// Entertainment
import Music from 'lucide-react-native/icons/music';
import Music2 from 'lucide-react-native/icons/music-2';
import Music4 from 'lucide-react-native/icons/music-4';
import Headphones from 'lucide-react-native/icons/headphones';
import Film from 'lucide-react-native/icons/film';
import Clapperboard from 'lucide-react-native/icons/clapperboard';
import Camera from 'lucide-react-native/icons/camera';
import Image from 'lucide-react-native/icons/image';
import Images from 'lucide-react-native/icons/images';
import Palette from 'lucide-react-native/icons/palette';
import PaintBucket from 'lucide-react-native/icons/paint-bucket';
import Brush from 'lucide-react-native/icons/brush';
import Scissors from 'lucide-react-native/icons/scissors';
import Sparkles from 'lucide-react-native/icons/sparkles';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import Drama from 'lucide-react-native/icons/drama';
import Ticket from 'lucide-react-native/icons/ticket';
import Dice5 from 'lucide-react-native/icons/dice-5';
import Puzzle from 'lucide-react-native/icons/puzzle';
import Blocks from 'lucide-react-native/icons/blocks';
import Book from 'lucide-react-native/icons/book';
import BookOpen from 'lucide-react-native/icons/book-open';
import BookMarked from 'lucide-react-native/icons/book-marked';
import Newspaper from 'lucide-react-native/icons/newspaper';
import Radio from 'lucide-react-native/icons/radio';
import Mic from 'lucide-react-native/icons/mic';
import Volume2 from 'lucide-react-native/icons/volume-2';

// Education & Work
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import School from 'lucide-react-native/icons/school';
import Notebook from 'lucide-react-native/icons/notebook';
import NotebookPen from 'lucide-react-native/icons/notebook-pen';
import FileSpreadsheet from 'lucide-react-native/icons/file-spreadsheet';
import FileText from 'lucide-react-native/icons/file-text';
import Files from 'lucide-react-native/icons/files';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import Briefcase from 'lucide-react-native/icons/briefcase';
import BadgeCheck from 'lucide-react-native/icons/badge-check';
import Award from 'lucide-react-native/icons/award';
import Trophy from 'lucide-react-native/icons/trophy';
import Medal from 'lucide-react-native/icons/medal';
import Target from 'lucide-react-native/icons/target';
import LightbulbIdea from 'lucide-react-native/icons/lightbulb';
import PenTool from 'lucide-react-native/icons/pen-tool';
import Ruler from 'lucide-react-native/icons/ruler';
import Presentation from 'lucide-react-native/icons/presentation';

// Pets & Animals
import PawPrint from 'lucide-react-native/icons/paw-print';
import Cat from 'lucide-react-native/icons/cat';
import Dog from 'lucide-react-native/icons/dog';
import Bird from 'lucide-react-native/icons/bird';
import Bug from 'lucide-react-native/icons/bug';
import FishAnimal from 'lucide-react-native/icons/fish';
import Rabbit from 'lucide-react-native/icons/rabbit';
import Squirrel from 'lucide-react-native/icons/squirrel';
import Snail from 'lucide-react-native/icons/snail';
import Turtle from 'lucide-react-native/icons/turtle';

// Nature & Outdoors
import Trees from 'lucide-react-native/icons/trees';
import TreeDeciduous from 'lucide-react-native/icons/tree-deciduous';
import TreePine from 'lucide-react-native/icons/tree-pine';
import Flower from 'lucide-react-native/icons/flower';
import Flower2 from 'lucide-react-native/icons/flower-2';
import Sprout from 'lucide-react-native/icons/sprout';
import Clover from 'lucide-react-native/icons/clover';
import Mountain from 'lucide-react-native/icons/mountain';
import MountainSnow from 'lucide-react-native/icons/mountain-snow';
import Waves from 'lucide-react-native/icons/waves-horizontal';
import Tent from 'lucide-react-native/icons/tent';
import FlameKindling from 'lucide-react-native/icons/flame-kindling';
import Flashlight from 'lucide-react-native/icons/flashlight';
import Backpack from 'lucide-react-native/icons/backpack';
import Luggage from 'lucide-react-native/icons/luggage';
import Globe from 'lucide-react-native/icons/globe';
import Globe2 from 'lucide-react-native/icons/earth';
import Earth from 'lucide-react-native/icons/earth';
import Sunrise from 'lucide-react-native/icons/sunrise';
import Sunset from 'lucide-react-native/icons/sunset';
import Cloud from 'lucide-react-native/icons/cloud';
import CloudRain from 'lucide-react-native/icons/cloud-rain';
import Snowflake from 'lucide-react-native/icons/snowflake';
import Star from 'lucide-react-native/icons/star';
import Sparkle from 'lucide-react-native/icons/sparkle';

// Communication
import MessageCircle from 'lucide-react-native/icons/message-circle';
import MessageSquare from 'lucide-react-native/icons/message-square';
import Mail from 'lucide-react-native/icons/mail';
import MailOpen from 'lucide-react-native/icons/mail-open';
import Send from 'lucide-react-native/icons/send';
import AtSign from 'lucide-react-native/icons/at-sign';
import Bell from 'lucide-react-native/icons/bell';
import BellRing from 'lucide-react-native/icons/bell-ring';
import Megaphone from 'lucide-react-native/icons/megaphone';

// Social & Brands
import Users from 'lucide-react-native/icons/users';
import User from 'lucide-react-native/icons/user';
import UserPlus from 'lucide-react-native/icons/user-plus';
import UserMinus from 'lucide-react-native/icons/user-minus';
import UserCheck from 'lucide-react-native/icons/user-check';
import Users2 from 'lucide-react-native/icons/users-round';
import Baby from 'lucide-react-native/icons/baby';
import Handshake from 'lucide-react-native/icons/handshake';
import HeartHandshake from 'lucide-react-native/icons/heart-handshake';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import ThumbsDown from 'lucide-react-native/icons/thumbs-down';

// Tech & Development
import Code from 'lucide-react-native/icons/code';
import Terminal from 'lucide-react-native/icons/terminal';
import Database from 'lucide-react-native/icons/database';
import Server from 'lucide-react-native/icons/server';
import HardDrive from 'lucide-react-native/icons/hard-drive';
import Cpu from 'lucide-react-native/icons/cpu';
import Usb from 'lucide-react-native/icons/usb';
import Bluetooth from 'lucide-react-native/icons/bluetooth';
import Printer from 'lucide-react-native/icons/printer';
import Keyboard from 'lucide-react-native/icons/keyboard';
import ScanLine from 'lucide-react-native/icons/scan-line';
import QrCode from 'lucide-react-native/icons/qr-code';
import Fingerprint from 'lucide-react-native/icons/fingerprint-pattern';
import Bot from 'lucide-react-native/icons/bot';
import CircuitBoard from 'lucide-react-native/icons/circuit-board';

// Miscellaneous
import Clock from 'lucide-react-native/icons/clock';
import Timer from 'lucide-react-native/icons/timer';
import Hourglass from 'lucide-react-native/icons/hourglass';
import AlarmClock from 'lucide-react-native/icons/alarm-clock';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import RotateCw from 'lucide-react-native/icons/rotate-cw';
import Repeat from 'lucide-react-native/icons/repeat';
import InfinityIcon from 'lucide-react-native/icons/infinity'; // `Infinity` would shadow the global
import Hash from 'lucide-react-native/icons/hash';
import Asterisk from 'lucide-react-native/icons/asterisk';
import CircleDot from 'lucide-react-native/icons/circle-dot';
import Circle from 'lucide-react-native/icons/circle';
import Square from 'lucide-react-native/icons/square';
import Triangle from 'lucide-react-native/icons/triangle';
import Hexagon from 'lucide-react-native/icons/hexagon';
import Octagon from 'lucide-react-native/icons/octagon';
import Flag from 'lucide-react-native/icons/flag';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Pin from 'lucide-react-native/icons/pin';
import Paperclip from 'lucide-react-native/icons/paperclip';
import Link from 'lucide-react-native/icons/link';
import Unlink from 'lucide-react-native/icons/unlink';
import Anchor from 'lucide-react-native/icons/anchor';
import Wrench from 'lucide-react-native/icons/wrench';
import Hammer from 'lucide-react-native/icons/hammer';
import Axe from 'lucide-react-native/icons/axe';
import Shovel from 'lucide-react-native/icons/shovel';
import Paintbrush from 'lucide-react-native/icons/paintbrush';
import Eraser from 'lucide-react-native/icons/eraser';
import ScissorsTool from 'lucide-react-native/icons/scissors';
import Slice from 'lucide-react-native/icons/slice';
import Box from 'lucide-react-native/icons/box';
import Archive from 'lucide-react-native/icons/archive';
import Inbox from 'lucide-react-native/icons/inbox';
import SendIcon from 'lucide-react-native/icons/send';
import LogIn from 'lucide-react-native/icons/log-in';
import LogOut from 'lucide-react-native/icons/log-out';
import Power from 'lucide-react-native/icons/power';
import ToggleLeft from 'lucide-react-native/icons/toggle-left';
import ToggleRight from 'lucide-react-native/icons/toggle-right';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Settings2 from 'lucide-react-native/icons/settings-2';
import Cog from 'lucide-react-native/icons/cog';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import Info from 'lucide-react-native/icons/info';
import AlertCircle from 'lucide-react-native/icons/circle-alert';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import Ban from 'lucide-react-native/icons/ban';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import Verified from 'lucide-react-native/icons/badge-check';
import BadgeInfo from 'lucide-react-native/icons/badge-info';

/** @internal test */
export const ICON_REGISTRY = {
  // Navigation
  home: Home,
  'bar-chart-3': BarChart3,
  'credit-card': CreditCard,
  shapes: Shapes,
  settings: Settings,
  'arrow-left': ArrowLeft,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  menu: Menu,

  // Actions
  plus: Plus,
  'plus-circle': PlusCircle,
  pencil: Pencil,
  'trash-2': Trash2,
  search: Search,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  filter: Filter,
  download: Download,
  upload: Upload,
  'undo-2': Undo2,
  check: Check,
  'check-circle': CheckCircle,
  'check-circle-2': CheckCircle2,
  x: X,
  'x-circle': XCircle,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  'refresh-cw': RefreshCw,
  eye: Eye,
  'eye-off': EyeOff,
  copy: Copy,
  'share-2': Share2,
  'external-link': ExternalLink,

  // Finance
  wallet: Wallet,
  landmark: Landmark,
  banknote: Banknote,
  receipt: Receipt,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'hand-coins': HandCoins,
  coins: Coins,
  'circle-dollar-sign': CircleDollarSign,
  'badge-dollar-sign': BadgeDollarSign,
  'arrow-up-circle': ArrowUpCircle,
  'arrow-down-circle': ArrowDownCircle,
  'arrow-left-right': ArrowLeftRight,
  calculator: Calculator,

  // Food & Dining
  utensils: Utensils,
  'utensils-crossed': UtensilsCrossed,
  coffee: Coffee,
  wine: Wine,
  beer: Beer,
  pizza: Pizza,
  sandwich: Sandwich,
  apple: Apple,
  cherry: Cherry,
  soup: Soup,
  'cooking-pot': CookingPot,
  'ice-cream': IceCream,
  milk: Milk,
  croissant: Croissant,
  salad: Salad,
  beef: Beef,
  fish: Fish,
  egg: Egg,
  cookie: Cookie,
  cake: Cake,
  'cake-slice': CakeSlice,
  candy: Candy,
  popcorn: Popcorn,
  grape: Grape,
  banana: Banana,
  carrot: Carrot,
  wheat: Wheat,
  leaf: Leaf,
  'leafy-green': LeafyGreen,
  citrus: Citrus,

  // Transport
  car: Car,
  'car-front': CarFront,
  bus: Bus,
  train: Train,
  'tram-front': TramFront,
  plane: Plane,
  'plane-takeoff': PlaneTakeoff,
  'plane-landing': PlaneLanding,
  bike: Bike,
  ship: Ship,
  sailboat: Sailboat,
  fuel: Fuel,
  'parking-circle': ParkingCircle,
  navigation: Navigation,
  'map-pin': MapPin,
  map: Map,
  compass: Compass,
  route: Route,
  truck: Truck,
  ambulance: Ambulance,

  // Shopping
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  package: Package,
  'package-open': PackageOpen,
  tag: Tag,
  tags: Tags,
  store: Store,
  shirt: Shirt,
  watch: Watch,
  gem: Gem,
  crown: Crown,
  gift: Gift,
  percent: Percent,
  'badge-percent': BadgePercent,

  // Home & Utilities
  house: House,
  building: Building,
  'building-2': Building2,
  lightbulb: Lightbulb,
  zap: Zap,
  droplet: Droplet,
  droplets: Droplets,
  flame: Flame,
  wind: Wind,
  wifi: Wifi,
  'wifi-off': WifiOff,
  phone: Phone,
  smartphone: Smartphone,
  tv: Tv,
  monitor: Monitor,
  laptop: Laptop,
  'tablet-smartphone': TabletSmartphone,
  'gamepad-2': Gamepad2,
  plug: Plug,
  cable: Cable,
  thermometer: Thermometer,
  'air-vent': AirVent,
  bath: Bath,
  'bed-double': BedDouble,
  sofa: Sofa,
  lamp: Lamp,
  'door-open': DoorOpen,
  key: Key,
  lock: Lock,
  unlock: Unlock,
  'shield-check': ShieldCheck,
  shield: Shield,

  // Health & Wellness
  heart: Heart,
  'heart-pulse': HeartPulse,
  activity: Activity,
  pill: Pill,
  stethoscope: Stethoscope,
  syringe: Syringe,
  bandaid: Bandage,
  hospital: Hospital,
  cross: Cross,
  brain: Brain,
  dumbbell: Dumbbell,
  'person-standing': PersonStanding,
  footprints: Footprints,
  glasses: Glasses,
  ear: Ear,
  hand: Hand,
  smile: Smile,
  frown: Frown,
  meh: Meh,
  moon: Moon,
  sun: Sun,
  'sun-moon': SunMoon,
  'cloud-sun': CloudSun,
  umbrella: Umbrella,

  // Entertainment
  music: Music,
  'music-2': Music2,
  'music-4': Music4,
  headphones: Headphones,
  film: Film,
  clapperboard: Clapperboard,
  camera: Camera,
  image: Image,
  images: Images,
  palette: Palette,
  'paint-bucket': PaintBucket,
  brush: Brush,
  scissors: Scissors,
  sparkles: Sparkles,
  'party-popper': PartyPopper,
  drama: Drama,
  ticket: Ticket,
  'dice-5': Dice5,
  puzzle: Puzzle,
  blocks: Blocks,
  book: Book,
  'book-open': BookOpen,
  'book-marked': BookMarked,
  newspaper: Newspaper,
  radio: Radio,
  mic: Mic,
  'volume-2': Volume2,

  // Education & Work
  'graduation-cap': GraduationCap,
  school: School,
  notebook: Notebook,
  'notebook-pen': NotebookPen,
  'file-spreadsheet': FileSpreadsheet,
  'file-text': FileText,
  files: Files,
  'folder-open': FolderOpen,
  briefcase: Briefcase,
  'badge-check': BadgeCheck,
  award: Award,
  trophy: Trophy,
  medal: Medal,
  target: Target,
  'lightbulb-idea': LightbulbIdea,
  'pen-tool': PenTool,
  ruler: Ruler,
  presentation: Presentation,

  // Pets & Animals
  'paw-print': PawPrint,
  cat: Cat,
  dog: Dog,
  bird: Bird,
  bug: Bug,
  'fish-animal': FishAnimal,
  rabbit: Rabbit,
  squirrel: Squirrel,
  snail: Snail,
  turtle: Turtle,

  // Nature & Outdoors
  trees: Trees,
  'tree-deciduous': TreeDeciduous,
  'tree-pine': TreePine,
  flower: Flower,
  'flower-2': Flower2,
  sprout: Sprout,
  clover: Clover,
  mountain: Mountain,
  'mountain-snow': MountainSnow,
  waves: Waves,
  tent: Tent,
  campfire: FlameKindling,
  flashlight: Flashlight,
  backpack: Backpack,
  luggage: Luggage,
  globe: Globe,
  'globe-2': Globe2,
  earth: Earth,
  sunrise: Sunrise,
  sunset: Sunset,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  snowflake: Snowflake,
  star: Star,
  sparkle: Sparkle,

  // Communication
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  mail: Mail,
  'mail-open': MailOpen,
  send: Send,
  'at-sign': AtSign,
  bell: Bell,
  'bell-ring': BellRing,
  megaphone: Megaphone,

  // Social & People
  users: Users,
  user: User,
  'user-plus': UserPlus,
  'user-minus': UserMinus,
  'user-check': UserCheck,
  'users-2': Users2,
  baby: Baby,
  handshake: Handshake,
  'heart-handshake': HeartHandshake,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,

  // Tech & Development
  code: Code,
  terminal: Terminal,
  database: Database,
  server: Server,
  'hard-drive': HardDrive,
  cpu: Cpu,
  usb: Usb,
  bluetooth: Bluetooth,
  printer: Printer,
  keyboard: Keyboard,
  'scan-line': ScanLine,
  'qr-code': QrCode,
  fingerprint: Fingerprint,
  bot: Bot,
  'circuit-board': CircuitBoard,

  // Miscellaneous
  clock: Clock,
  timer: Timer,
  hourglass: Hourglass,
  alarm: AlarmClock,
  'rotate-ccw': RotateCcw,
  'rotate-cw': RotateCw,
  repeat: Repeat,
  infinity: InfinityIcon,
  hash: Hash,
  asterisk: Asterisk,
  'circle-dot': CircleDot,
  circle: Circle,
  square: Square,
  triangle: Triangle,
  hexagon: Hexagon,
  octagon: Octagon,
  flag: Flag,
  bookmark: Bookmark,
  pin: Pin,
  paperclip: Paperclip,
  link: Link,
  unlink: Unlink,
  anchor: Anchor,
  wrench: Wrench,
  hammer: Hammer,
  axe: Axe,
  shovel: Shovel,
  paintbrush: Paintbrush,
  eraser: Eraser,
  'scissors-tool': ScissorsTool,
  slice: Slice,
  box: Box,
  archive: Archive,
  inbox: Inbox,
  'send-icon': SendIcon,
  'log-in': LogIn,
  'log-out': LogOut,
  power: Power,
  'toggle-left': ToggleLeft,
  'toggle-right': ToggleRight,
  'sliders-horizontal': SlidersHorizontal,
  'settings-2': Settings2,
  cog: Cog,
  'help-circle': HelpCircle,
  info: Info,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  ban: Ban,
  'shield-alert': ShieldAlert,
  verified: Verified,
  'badge-info': BadgeInfo,
} as const;

export type IconName = keyof typeof ICON_REGISTRY;

/** @internal test */
export const isValidIconName = (name: string): name is IconName => {
  return name in ICON_REGISTRY;
};

export {type LucideIcon} from 'lucide-react-native';
