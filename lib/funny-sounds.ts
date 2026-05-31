export interface FunnyPreset {
  id: string;
  emoji: string;
  label: string;
  text: string;     // spoken via expo-speech
  pitch: number;
  rate: number;
  color: string;    // card background
}

export const FUNNY_PRESETS: FunnyPreset[] = [
  {
    id: "chicken",
    emoji: "🐔",
    label: "Chicken",
    text: "Bawk bawk bawk bawk bawk bawk! Your parent says hello! Bawk!",
    pitch: 1.8,
    rate: 1.5,
    color: "#FEF08A",
  },
  {
    id: "robot",
    emoji: "🤖",
    label: "Robot",
    text: "Beep boop. I am your parent unit. Initiating homework protocol. Beep boop. Compliance required.",
    pitch: 0.3,
    rate: 0.65,
    color: "#BAE6FD",
  },
  {
    id: "ghost",
    emoji: "👻",
    label: "Spooky",
    text: "Wooooooo... your parent is watching you... woooooo... clean your room or else... woooooo...",
    pitch: 0.45,
    rate: 0.5,
    color: "#E9D5FF",
  },
  {
    id: "baby",
    emoji: "👶",
    label: "Baby Voice",
    text: "Hewwo wittle one! Mommy or Daddy says hewwo! Come give me a big hug hug! Pwease!",
    pitch: 2.2,
    rate: 0.8,
    color: "#FECACA",
  },
  {
    id: "speedy",
    emoji: "⚡",
    label: "Speedy",
    text: "Hey there super speed message incoming do your homework eat your vegetables drink your water get some sleep be good and have a great day bye!",
    pitch: 1.1,
    rate: 2.6,
    color: "#FDE68A",
  },
  {
    id: "deep",
    emoji: "🦁",
    label: "Deep Voice",
    text: "This... is your parent... speaking. You will... do great things today. I believe in you.",
    pitch: 0.25,
    rate: 0.55,
    color: "#D1FAE5",
  },
  {
    id: "minion",
    emoji: "💛",
    label: "Minion",
    text: "Bello bello bello! Ba na na! Your papoy says to be a good little minion today! Papoy! Papoy!",
    pitch: 1.6,
    rate: 1.2,
    color: "#FEF9C3",
  },
  {
    id: "pirate",
    emoji: "🏴‍☠️",
    label: "Pirate",
    text: "Ahoy there matey! Your cap'n says it be time to swab the deck and do yer chores! Arrr! Or ye walk the plank! Arrr!",
    pitch: 0.6,
    rate: 0.9,
    color: "#FED7AA",
  },
  {
    id: "wizard",
    emoji: "🧙",
    label: "Wizard",
    text: "By the ancient power of parenting, I hereby command thee! Clean thy room! Do thy homework! Eat thy vegetables! So it is written!",
    pitch: 0.55,
    rate: 0.7,
    color: "#C7D2FE",
  },
  {
    id: "opera",
    emoji: "🎭",
    label: "Opera",
    text: "Oh my dearest darling child, please come to dinner now, the food is getting very very cooooold! La la la!",
    pitch: 1.5,
    rate: 0.55,
    color: "#FBCFE8",
  },
  {
    id: "alien",
    emoji: "👽",
    label: "Alien",
    text: "Greetings earth child. We come in peace. Do your homework or we shall consume all the snacks. This is not a drill.",
    pitch: 0.4,
    rate: 0.6,
    color: "#BBF7D0",
  },
  {
    id: "whisper",
    emoji: "🤫",
    label: "Whisper",
    text: "Hey... psst... hey you... yeah you... just wanted to say hi... and remind you... to do your homework... okay bye...",
    pitch: 1.0,
    rate: 0.65,
    color: "#E2E8F0",
  },
];
