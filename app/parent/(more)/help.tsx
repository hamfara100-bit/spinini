import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Linking, ScrollView, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { checkForUpdates, APP_VERSION } from "../../../lib/check-update";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import * as Contacts from "expo-contacts";
import { AudioModule } from "expo-audio";
import { useCameraPermissions } from "expo-camera";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { useData } from "../../../lib/data/store";
import { exportAndShare, savePhotosToGallery, importBackup } from "../../../lib/data-export";

type Tab = "help" | "guide" | "privacy";

const GUIDE_H = Dimensions.get("window").height * 0.72;

const CONTACT_EMAIL = "privacy@famkids.app";

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    heading: "🔒 Screen Time & Locking",
    items: [
      { q: "How do I set screen time limits?", a: "Go to ⏱️ Screen Rules → select a child → adjust the daily limit with +/- buttons. You can also set weekend overrides and educational app exemptions." },
      { q: "How do I instantly lock a child's device?", a: "Tap 🔒 Remote Lock → choose a message and duration → tap Lock Now. The lock screen appears immediately on the child's side with your message." },
      { q: "What is Fun Lock?", a: "Fun Lock is a playful lock mode. Pick a funny photo and record your voice. When you lock the screen, the child sees your photo and hears your voice! Set it up in 🔒 Remote Lock." },
      { q: "What are Downtime Windows?", a: "Downtime Windows are time ranges when the app is locked — great for school hours or bedtime. Set them in ⏱️ Screen Rules." },
      { q: "What is Bedtime Mode?", a: "🌙 Bedtime Mode dims features and shows calming content instead of a hard lock. Set the start/end time in 🌙 Bedtime Mode." },
      { q: "What is Free Mode?", a: "Free Mode lets a child use all device features without limits. You still get full reports on what they used, which apps they opened, where they went, and how long. Toggle it in ⏱️ Screen Rules." },
      { q: "What is Teen Mode?", a: "Teen Mode adjusts the app for older kids (13+). It reduces hard locks in favor of soft nudges, gives teens more transparency over their own usage reports, and enables more self-management tools. Toggle it in ⚙️ Settings → Child Profile." },
    ],
  },
  {
    heading: "🗓️ Family Calendar",
    items: [
      { q: "How do I use the Family Calendar?", a: "Go to 🗓️ Family Calendar. You see a full monthly grid. Tap any day to see events for that day. Tap + Add Event to create a new event for the selected date." },
      { q: "Can I set who sees a calendar event?", a: "Yes. When creating an event, choose 'Everyone' so all family members see it, or '🔒 Parents only' to keep it between co-parents only. You can also pick specific kids to include." },
      { q: "How do calendar alarms work?", a: "When adding an event, tap the 🔔 Alarm section to ping specific kids (or all kids) on the event date. They get a push notification reminder." },
      { q: "Can I delete someone else's event?", a: "Only the creator of an event can delete it. Your own events show a 🗑️ Delete button. Events created by a co-parent do not have that button on your side." },
      { q: "How do I share an event with someone who doesn't have the app?", a: "Tap the ↑ Share button on any event card. This opens your device's native share sheet so you can send the event details via Messages, Email, WhatsApp, or any other app." },
      { q: "Can I sync the calendar to Apple Calendar or Google Calendar?", a: "Use the Share button on an event to copy the details and paste into any calendar app. Full two-way calendar sync (ICS format) is coming in a future update." },
      { q: "Can the AI create calendar events?", a: "Yes! Ask your AI Agent things like 'Add soccer practice every Saturday at 10am for the next 4 weeks for Emma'. The AI will draft the events for your review." },
    ],
  },
  {
    heading: "✅ Notes & To-Do List",
    items: [
      { q: "Where is the To-Do list?", a: "Go to 📝 Notes. You'll see two tabs: 📝 Notes (your sticky-note cards) and ✅ To-Do (your task list)." },
      { q: "How do I add a task?", a: "In the ✅ To-Do tab, type your task in the input field and optionally tap 📅 to pick a due date. Tap + Add to save it." },
      { q: "How do I complete a task?", a: "Tap the checkbox circle to the left of any task. Completed tasks get a strikethrough. Tap again to un-complete." },
      { q: "Can I edit a task after adding it?", a: "Yes. Tap ✏️ Edit on any task to change its title or due date inline. Tap ✓ to save changes." },
      { q: "How do I filter tasks?", a: "Use the filter chips above the list: Open (pending only), All (everything), or Done (completed only). Overdue tasks are highlighted in red." },
      { q: "How do I clear all completed tasks at once?", a: "If you have completed tasks, a 'Clear completed (N)' button appears at the top. Tap it to bulk-delete all done tasks." },
    ],
  },
  {
    heading: "📞 Call & Text Guard",
    items: [
      { q: "How do I block unknown callers?", a: "Go to 📞 Call & Text Guard → select a child → toggle the guard on. Choose block mode: Contacts Only, Whitelist, or Allow All. Blocked calls are logged." },
      { q: "What is the Emergency Unlock code?", a: "A secret text phrase (up to 20 characters) you set per child. If you ever lose your phone and need to reach your child from someone else's number, text that exact phrase to your child's device. The app sees it and unlocks all calls for 24 hours." },
      { q: "How do I set up the Emergency Unlock code?", a: "Go to 📞 Call & Text Guard → tap a child card to open their settings → scroll to '🚨 Lost Phone Emergency Unlock' → type your secret phrase → tap Save. You can test it immediately with the 'Simulate' button." },
      { q: "How long does an emergency unlock last?", a: "Exactly 24 hours from when the secret code was matched. The active banner shows the exact expiry time. You can deactivate it early by tapping Deactivate in the same settings panel." },
      { q: "Is the emergency code secure?", a: "The code is stored encrypted on your device and never sent to our servers. Only someone who knows the exact phrase can trigger the unlock. Choose something memorable but not guessable." },
    ],
  },
  {
    heading: "🔨 Chores & Rewards",
    items: [
      { q: "How do chores work?", a: "Create a chore in 🔨 Chores → tap + Add Chore. Set title, points, and optional cash reward. Assign to kids. Kids submit proof and you approve or reject it." },
      { q: "What is the Time Bank?", a: "Extra screen time kids earn by completing chores and getting good grades. They spend banked minutes to unlock more time or app rewards." },
      { q: "What is the Reward Shop?", a: "🛍️ Reward Shop lets you create custom rewards (screen time, real-world prizes, digital items) that kids purchase with behavior points. Manage it in 🛍️ Reward Shop." },
      { q: "Can chores be recurring?", a: "Yes! When creating a chore, enable Auto-Chore and select days of the week. The chore repeats automatically on those days." },
      { q: "What is the Morning Routine?", a: "🌅 Morning Routine lets you build a daily checklist for each child (brush teeth, make bed, pack bag, etc.). Kids check off steps each morning. Completing the full routine awards bonus points and unlocks their screen time for the day." },
      { q: "What is Borrow Time?", a: "Kids can request extra screen time by borrowing against tomorrow's allowance. Go to ⏱️ Screen Rules → Borrow Time to set the maximum they can borrow and the repayment rules." },
      { q: "What is the Leaderboard?", a: "🏆 Leaderboard shows a fun weekly ranking of all kids by points earned. It encourages friendly competition. Toggle it on/off in ⚙️ Settings → Family." },
    ],
  },
  {
    heading: "💰 Allowance & Money",
    items: [
      { q: "How does automatic allowance work?", a: "Go to 💰 Allowance → select a child → set a weekly or monthly amount and a payout day. The app automatically credits their Piggy Bank on schedule." },
      { q: "What is the Spending report?", a: "In 📊 Reports → 💰 Spending tab, you see a grand total of everything paid/earned per child: chore earnings, point payouts, allowance paid, and behavior bonuses — with a bar chart breakdown and detailed transaction lists." },
      { q: "Where do kids see their own earnings?", a: "Kids can open 📊 My Reports from their home screen. The ⭐ Earnings tab shows their total earned, approved chores, behavior bonuses, and allowance history for the selected time period." },
      { q: "What is a point payout?", a: "When kids cash in behavior points for real money, it's recorded as a payout. You approve point-to-cash conversions in 🔨 Chores → Point Payouts. Each $0.50 per point." },
    ],
  },
  {
    heading: "📊 Reports & Insights",
    items: [
      { q: "What tabs are in Reports?", a: "📊 Reports has 5 tabs: ⏱️ Screen Time (daily usage + chart), 📱 Apps (per-app breakdown), 🌐 Websites (browser history), ⚙️ Features (in-app feature usage), and 💰 Spending (earnings & allowance)." },
      { q: "Can kids see their own reports?", a: "Yes! Kids can open 📊 My Reports from their home screen. They see ⭐ Earnings and 📊 Usage tabs with period pickers (Last 7 Days / Last 30 Days / All Time)." },
      { q: "How do I export reports?", a: "Open 📊 Reports → tap the ↑ Export button. A plain-text summary of screen time, apps, locations, grades, and behavior is shared via your device's share sheet." },
      { q: "What are Behavior Insights?", a: "Behavior Insights (in 📊 Reports) uses your family's chore, behavior, and usage data to surface patterns — such as 'Screen time spikes on days without completed chores'. It offers suggested actions." },
    ],
  },
  {
    heading: "📊 School & Grades",
    items: [
      { q: "How do I manage grades?", a: "Go to 🏫 School → select a child → 📊 Grades tab → + Add Grade. GPA is calculated automatically." },
      { q: "How do grade rewards work?", a: "When adding A+/A/B+ grades, a reward prompt appears. Tap 'Send Reward' to deposit bonus minutes into the child's Time Bank." },
      { q: "How do I assign homework?", a: "Go to 🏫 School → Assignments tab → + Add Assignment. The app schedules a push notification reminder the day before the due date." },
      { q: "What is the Homework Helper?", a: "In the child's School section, the Homework Helper lets you snap a photo of an assignment or type a question. The AI explains the concept step-by-step without just giving the answer." },
    ],
  },
  {
    heading: "📍 Monitoring & Safety",
    items: [
      { q: "How do I see my child's location?", a: "Go to 📍 Location. The map shows the child's last GPS position. Add Safe Zones to get notified when they enter or leave." },
      { q: "What is the SOS button?", a: "The child's home screen has a 🚨 SOS button. When tapped, it captures GPS location, sends a push notification to you, and shows a red alert banner on your dashboard." },
      { q: "What is Camera Watch?", a: "👁️ Camera Watch activates the child's device camera as a live monitor. You get motion alerts with snapshot photos." },
      { q: "How do I block an app entirely?", a: "Go to 📱 App Rules → find the app → set to Block. The Accessibility Service detects when the child opens it and immediately shows a lock overlay. You also get a notification." },
      { q: "What is Study Mode?", a: "Study Mode (in ⏱️ Screen Rules → Study Mode tab) blocks entertainment apps (YouTube, TikTok, games, etc.) during study hours. The child sees a blue banner." },
      { q: "What is the Important Info / Document Vault?", a: "📋 Important Info is a 5-tab document vault for each child: 🚨 Emergency contacts & procedures, 🏥 Insurance cards & policy info, 🪪 Identity documents (birth cert, passport), 💊 Medical records & allergies, and 📁 Other important files. Documents can be PIN-locked and optionally shared with co-parents. Expiry dates trigger badge alerts." },
    ],
  },
  {
    heading: "🤝 Co-Parenting",
    items: [
      { q: "How do co-parent accounts work?", a: "Go to ⚙️ Settings → Co-Parents → + Add Co-Parent. Give them a name, emoji, 4-digit PIN, and role (Admin / Co-Parent / Viewer). Each co-parent logs in with their own PIN." },
      { q: "What is the Co-Parenting screen?", a: "Go to 🤝 Co-Parenting. It has three tabs: 📅 Schedule (custody/handover calendar), 🔔 Alerts (shared event notifications), and 💰 Expenses (shared cost tracking)." },
      { q: "How do I track shared expenses?", a: "In 🤝 Co-Parenting → 💰 Expenses tab, add items like medical costs, school fees, or activities. Each expense shows who paid and the split. Export a summary for reimbursement." },
      { q: "Can co-parents see the Document Vault?", a: "Yes, if you grant access. When adding or editing a document, toggle 'Share with co-parent'. They can view but not edit shared documents unless they are an Admin co-parent." },
      { q: "Can co-parents see 'Parents Only' calendar events?", a: "Yes. 'Parents Only' events are visible to all co-parents with Admin or Co-Parent role. Viewer-role co-parents can also see them. They are hidden only from children." },
    ],
  },
  {
    heading: "🤖 AI & Voice Commands",
    items: [
      { q: "What does the AI Agent do?", a: "Ask natural-language questions like 'Who used the most screen time today?' or 'Lock Emma for 30 minutes'. The agent reads your family data and acts for you." },
      { q: "How do voice commands work?", a: "Go to 🎙️ Voice Commands → follow the deep link setup for Google Assistant or Siri Shortcuts. Say 'Hey Google, ping Mia' or 'Hey Siri, lock Noah's device'." },
      { q: "What is the Parenting Coach?", a: "The 🧑‍🏫 Parenting Coach AI analyzes your family's behavior data and offers personalized advice — discipline approaches, reward strategy tweaks, and conversation starters for tough topics." },
      { q: "What is the Story Character feature?", a: "📖 Story Character lets you or your child describe a character and the AI generates a short illustrated story. Great for bedtime. Find it in the AI Tools section." },
      { q: "What is AI Digest?", a: "📬 Digest sends you a daily or weekly AI-written summary of each child's activity: screen time, chores completed, mood, location check-ins, and anything that needs your attention." },
      { q: "Can I save AI results?", a: "Yes! Any AI response (story, advice, summary) has a 💾 Save button. Saved results appear under each child's AI Results list, where you can view, rename, or delete them." },
    ],
  },
  {
    heading: "🏆 Fun & Engagement",
    items: [
      { q: "What is the Trophy Room?", a: "🏆 Trophy Room is each child's collection of achievement badges earned by completing chores, good grades, streaks, and milestones. Kids love showing it off! Find it in their profile." },
      { q: "What is the Mood Tracker?", a: "😊 Mood Tracker lets kids log how they're feeling each day with an emoji. Parents see a mood history chart in the child's profile — great for spotting patterns or starting conversations." },
      { q: "What are Kid Requests?", a: "Kids can tap 📬 Requests on their home screen to ask for things: extra screen time, a new reward, a chore modification, or a family activity. You approve or decline from the dashboard." },
      { q: "What are Widgets?", a: "Spinini home screen widgets show quick stats — today's screen time, open chores, mood, or a family greeting. Long-press your home screen to add Spinini widgets (iOS 14+ / Android 12+)." },
      { q: "What is Spinini+?", a: "Spinini+ is the optional premium tier. It unlocks unlimited children, advanced AI features, behavior insights, extended history (1 year), and priority support. Manage your subscription in ⚙️ Settings → Spinini+." },
      { q: "What is Notification Batching?", a: "Instead of pinging you for every tiny event, Notification Batching groups non-urgent alerts (chore submissions, mood entries, app blocks) into a single digest at a time you choose. Set it in ⚙️ Settings → Notifications." },
    ],
  },
  {
    heading: "⚙️ Account & Settings",
    items: [
      { q: "How do I add a co-parent?", a: "Go to ⚙️ Settings → Co-Parents → + Add Co-Parent. Give them a name, emoji, 4-digit PIN, and role (Admin / Co-Parent / Viewer)." },
      { q: "What if I forget my parent PIN?", a: "Go to ⚙️ Settings → PIN Recovery Code. If you set one up, it lets you reset your PIN. If not, generate a recovery code now and store it safely." },
      { q: "How does cloud backup work?", a: "Go to ☁️ Cloud Backup → link your Google account → Back Up Now. Data saves to your own Google Drive — we never see it." },
      { q: "How do I export reports?", a: "Open 📊 Reports → tap the ↑ Export button. A plain-text summary of screen time, apps, locations, grades, and behavior is shared via your device's share sheet." },
      { q: "What is the Onboarding Wizard?", a: "New to Spinini? The Onboarding Wizard walks you through adding your first child, setting up screen limits, connecting a co-parent, and enabling the features you care about — all in under 5 minutes. Re-launch it anytime from ⚙️ Settings → Restart Setup Wizard." },
    ],
  },
];

// ─── Parenting Guide data ─────────────────────────────────────────────────────

type GuideTip  = { title: string; points: string[] };
type GuideCategory = { id: string; emoji: string; label: string; color: string; tips: GuideTip[] };

const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    id: "newborn", emoji: "🤱", label: "Newborn\n0–12 mo", color: "#EC4899",
    tips: [
      { title: "What to Expect", points: [
        "Newborns sleep 14–17 hrs/day in 2–4 hour stretches — this is normal.",
        "Crying is their only communication. Check: hunger, diaper, temperature, or need for comfort.",
        "Babies lose 5–10% of birth weight in week 1 but regain it by week 2.",
        "The soft spot (fontanelle) on the head is normal; it closes by 18 months.",
        "Newborn jaundice (yellow skin) is common in week 1 — flag it to your doctor if it persists.",
      ]},
      { title: "Safe Feeding", points: [
        "Breast-feed or formula-feed every 2–3 hours (8–12 times per day in the first weeks).",
        "Never prop a bottle — hold baby during every feed to prevent choking.",
        "Burp after every feeding to release trapped air and reduce reflux.",
        "No solid food before 6 months — the digestive system is not ready.",
        "Never give honey before age 1 — risk of infant botulism.",
        "Introduce one new food at a time; wait 3 days to spot allergic reactions.",
      ]},
      { title: "Safe Sleep (SIDS Prevention)", points: [
        "ALWAYS place baby on their BACK to sleep — reduces SIDS risk by 50%.",
        "Use a firm, flat sleep surface with no pillows, bumpers, stuffed toys, or loose bedding.",
        "Room-share for the first 6 months — but do not bed-share.",
        "Keep room at 68–72°F (20–22°C) — overheating increases risk.",
        "Swaddle only until baby shows signs of rolling over (usually 2–3 months).",
        "Pacifiers at sleep time reduce SIDS risk once breastfeeding is established.",
      ]},
      { title: "Development Milestones", points: [
        "1 month — focuses on faces; startles at sounds.",
        "2 months — first social smiles; coos and gurgles.",
        "4 months — laughs; holds head up; tracks moving objects.",
        "6 months — sits with support; ready to begin solid foods.",
        "9 months — crawls; waves bye-bye; babbles 'mama/dada'.",
        "12 months — first steps; first real words (1–3 words with meaning).",
        "Ranges are wide. Talk to your pediatrician if milestones are significantly delayed.",
      ]},
    ],
  },
  {
    id: "toddler", emoji: "🚼", label: "Toddler\n1–3 yrs", color: "#F97316",
    tips: [
      { title: "What to Expect", points: [
        "Tantrums peak between 18 months and 3 years — it is brain development, not bad behavior.",
        "They assert independence constantly: 'No!' and 'Mine!' are normal developmental milestones.",
        "Vocabulary explodes from ~20 words at 18 months to 900+ by age 3.",
        "Separation anxiety is normal and usually peaks at 15–18 months.",
        "Parallel play (near but not with others) is age-appropriate — cooperative play comes later.",
      ]},
      { title: "Handling Tantrums", points: [
        "Stay calm — your regulation models theirs. Never match their escalated energy.",
        "Name their feeling first: 'You're frustrated because you can't have the toy.'",
        "Do NOT give in to stop a tantrum — it teaches that tantrums work.",
        "Ensure safety, then wait it out. Storms pass faster without fuel.",
        "Offer comfort after the storm, not during: 'That was hard. I'm here now.'",
        "Prevent with HALT: tantrums spike when a child is Hungry, Angry, Lonely, or Tired.",
      ]},
      { title: "Language & Learning", points: [
        "Talk constantly — narrate what you're doing to build vocabulary naturally.",
        "Read aloud every single day. Point to pictures; ask 'What's that?'",
        "Sing songs and nursery rhymes — rhythm strongly aids language acquisition.",
        "Limit screens: AAP recommends no screens before 18–24 months except video calls.",
        "Ask open-ended questions: 'What happened next?' rather than 'Did you like it?'",
      ]},
      { title: "Safety", points: [
        "Install safety gates at stairs, cabinet locks, and outlet covers — immediately.",
        "Secure heavy furniture (bookshelves, dressers) to walls — tip-overs are a leading cause of injury.",
        "NEVER leave in a bath alone — children can drown in 2 inches of water in minutes.",
        "Choking hazard test: anything that fits through a toilet-paper tube is a hazard.",
        "Cut all round foods (grapes, cherry tomatoes, hot dogs) lengthwise AND in quarters.",
      ]},
    ],
  },
  {
    id: "ages4to10", emoji: "🧒", label: "Ages\n4–10", color: "#8B5CF6",
    tips: [
      { title: "Building Character", points: [
        "Assign age-appropriate chores — children who do chores develop responsibility and empathy.",
        "Praise effort, not just results: 'You worked really hard on that' builds a growth mindset.",
        "Let them fail safely. Rescuing every time robs them of resilience they need for life.",
        "Model the values you want to see — they watch and copy everything you do.",
        "Family dinners 3–4× per week correlate strongly with better grades and lower risk behavior.",
      ]},
      { title: "Emotional Intelligence", points: [
        "Name emotions for them AND for yourself: 'I'm feeling frustrated right now.'",
        "Validate before correcting: 'I understand you're upset. AND we still need to...'",
        "Teach: all emotions are okay — not all actions are okay.",
        "Use books and movies as safe windows to discuss difficult emotions.",
        "Create a simple daily check-in ritual: 'Best thing today? Hardest thing?'",
      ]},
      { title: "School & Learning", points: [
        "Establish a consistent homework routine — same time, same place every day.",
        "Read with them even after they can read alone — builds bond and vocabulary.",
        "Ask 'What was the best thing today? What was hard?' — not just 'How was school?'",
        "Limit activities to 1–2 after-school commitments — overscheduled kids show higher anxiety.",
        "Communicate regularly with teachers; catch problems early before they compound.",
      ]},
      { title: "Childhood Is Short — Protect It", points: [
        "Unstructured outdoor play every day is as important for development as academics.",
        "Let them be bored sometimes. Boredom is the birthplace of creativity and imagination.",
        "Let them pick one hobby they genuinely love and fully support it.",
        "Create family traditions — weekly game night, pancake Saturdays, holiday rituals.",
        "Put your phone down when they speak to you. Your full attention is irreplaceable.",
        "The years go fast — they will not be children twice. Enjoy this season with them.",
      ]},
    ],
  },
  {
    id: "feeding", emoji: "🍽️", label: "Safe\nFeeding", color: "#10B981",
    tips: [
      { title: "Choking Prevention", points: [
        "Never leave children under 4 alone while eating — stay at the table.",
        "Cut round foods (grapes, cherry tomatoes, hot dogs) lengthwise AND in quarters.",
        "Avoid hard raw vegetables, whole nuts, popcorn, and large chunks before age 4.",
        "Children must sit down while eating — running with food dramatically raises choking risk.",
        "Learn infant and child CPR/Heimlich before you need it. One class saves lives.",
      ]},
      { title: "Nutrition by Age", points: [
        "0–6 months: Breast milk or formula only — no water, no juice.",
        "6–12 months: Iron-rich purées, then soft chunks. Introduce allergens early under guidance.",
        "1–3 years: Family foods in soft pieces. Full-fat dairy until age 2.",
        "4–12 years: Balanced plate — ½ vegetables/fruit, ¼ protein, ¼ whole grains.",
        "Teens: Iron and calcium needs spike — ensure lean protein, beans, dairy, and leafy greens.",
        "Avoid ultra-processed foods as staples. Reserve them as occasional treats, not daily fuel.",
      ]},
      { title: "Raising Healthy Eaters", points: [
        "Division of responsibility: YOU decide what/when/where; THEY decide if/how much.",
        "Offer vegetables early and often — it can take 10–15 exposures before a child accepts a new food.",
        "Eat together as a family — children eat more variety when they see adults eating it.",
        "Never use food as reward or punishment — it creates lifelong unhealthy emotional ties.",
        "Keep healthy options visible and accessible. Make junk food less visible.",
      ]},
      { title: "Food Safety", points: [
        "Always wash hands for 20 seconds before preparing or eating food.",
        "Cook meat to safe internal temperatures — use a thermometer, not color.",
        "Refrigerate leftovers within 2 hours. When in doubt, throw it out.",
        "Keep raw meat separate from ready-to-eat foods in the fridge — use separate boards.",
        "Teach children from age 4: if it smells off, don't taste it — always tell an adult.",
      ]},
    ],
  },
  {
    id: "sleep", emoji: "😴", label: "Sleep &\nSleepovers", color: "#6366F1",
    tips: [
      { title: "How Much Sleep by Age", points: [
        "Newborn (0–3 mo): 14–17 hours total per day.",
        "Infant (4–11 mo): 12–15 hours including naps.",
        "Toddler (1–2 yrs): 11–14 hours including nap.",
        "Preschool (3–5 yrs): 10–13 hours.",
        "School age (6–12 yrs): 9–11 hours.",
        "Teens (13–17 yrs): 8–10 hours — most get far less.",
        "A consistent bedtime — same time every night — is the single most powerful sleep tool.",
      ]},
      { title: "Building Healthy Sleep Habits", points: [
        "Dim lights and stop screens 1 hour before bed — blue light suppresses melatonin.",
        "Keep the bedroom cool (65–68°F / 18–20°C), dark, and quiet.",
        "A predictable routine (bath → book → lights out) signals the brain that sleep is near.",
        "No phones or tablets in bedrooms at bedtime — charge devices in a common area.",
        "Never use the bed as a punishment location — it must feel safe and calm.",
      ]},
      { title: "Sleepover Safety Rules", points: [
        "Know the host family — meet the parents before any sleepover, not just the child's friend.",
        "Ask directly: Are there firearms in the home? How are they stored?",
        "Ask: Who else will be in the house that night?",
        "Your child should know they can call you any time, no questions asked.",
        "Establish a code word — they text it, you pick them up immediately, no embarrassment.",
        "Not every home has the same rules. It is always okay to say no to a sleepover.",
        "Trust your instincts. If something feels off about a household, it probably is.",
      ]},
      { title: "When Kids Won't Sleep", points: [
        "Nightmares peak at ages 3–6 and again in early adolescence — comfort without creating dependency.",
        "Night terrors: don't wake them, just keep them safe — they will not remember.",
        "Stalling at bedtime: offer one small choice (which pajamas, which book) to reduce power struggles.",
        "If a child takes 30+ minutes to fall asleep consistently, bedtime may be too early.",
      ]},
    ],
  },
  {
    id: "discipline", emoji: "✋", label: "Discipline", color: "#EF4444",
    tips: [
      { title: "Core Principles", points: [
        "Discipline means 'to teach' — the goal is building self-regulation, not punishing.",
        "Connection before correction — a child who feels seen is far more cooperative.",
        "Consistency is the most powerful tool. Rules without consistent follow-through are noise.",
        "Natural consequences teach reality: 'If you don't wear a jacket, you'll be cold.'",
        "Never discipline in the heat of the moment. Wait until everyone is calm.",
      ]},
      { title: "Effective Techniques", points: [
        "Use 'when/then': 'When homework is done, then we watch TV.'",
        "Redirect before reacting — offer an acceptable alternative before saying no.",
        "Time-in over time-out: sit with them, calm down together, and problem-solve.",
        "Logical consequences over arbitrary punishment: break a toy → lose it for a week.",
        "Catch them being good. Behavior you notice and praise tends to repeat.",
        "Remove the audience during meltdowns — a child performing for others escalates.",
      ]},
      { title: "What NOT to Do", points: [
        "Never shame: 'You're a bad kid' attacks identity. Address the behavior, not the person.",
        "Avoid empty threats — if you won't follow through, don't say it.",
        "Don't compare siblings or classmates — it breeds resentment, not motivation.",
        "Never discipline through fear. Fear-based obedience disappears the moment you're absent.",
        "Hitting teaches that bigger people solve problems with physical force. It increases aggression.",
      ]},
      { title: "When They Can't Have What They Want", points: [
        "Validate the desire before the boundary: 'I know you really want it. The answer is still no.'",
        "Don't over-explain to a dysregulated child — their brain isn't listening. Stay brief.",
        "Teach delay of gratification early: 'You can have it after dinner.' Then follow through.",
        "Help them name the feeling: 'It's really disappointing when we can't have what we want.'",
        "Don't bribe to stop the crying — it teaches crying is the tool to use.",
        "Model graceful disappointment — let them see YOU not get something and handle it calmly.",
      ]},
    ],
  },
  {
    id: "hygiene", emoji: "🪥", label: "Hygiene\n& Health", color: "#06B6D4",
    tips: [
      { title: "Dental Care", points: [
        "Start brushing at the FIRST tooth — as early as 6 months.",
        "Use fluoride toothpaste — rice-grain size under age 3, pea-size from age 3+.",
        "Brush TWICE daily: morning and before bed, no exceptions.",
        "Begin flossing as soon as two teeth touch — usually around age 2–3.",
        "Replace toothbrush every 3 months or after any illness.",
        "First dental visit by age 1 or within 6 months of the first tooth appearing.",
      ]},
      { title: "Brushing the Tongue — Most Important Step", points: [
        "The tongue harbors 70–80% of all mouth bacteria — it is the primary source of bad breath.",
        "Brush the tongue every single time you brush teeth — back to front, gently.",
        "Use a tongue scraper for older children and teens — more effective than a brush.",
        "Unclean tongues cause cavities too — bacteria transfer directly from tongue to teeth.",
        "Start the habit at age 2 — children accept it easily when it starts early.",
        "Routine order: brush teeth → floss → scrape tongue → rinse. Teach all four steps.",
      ]},
      { title: "Handwashing & Body Hygiene", points: [
        "20-second rule: hands, back of hands, between fingers, thumbs, nails, wrists.",
        "Critical times: before eating, after bathroom, after outdoor play, after touching animals.",
        "Bath or shower: daily for active toddlers and all teens; every 1–2 days fine for school-age.",
        "Wash hair 2–3× per week for most children; daily for very active teens.",
        "Trim nails straight across to prevent ingrown nails — especially toenails.",
        "Introduce deodorant at the first signs of body odor — often 8–12 years old.",
      ]},
      { title: "Building Habits That Stick", points: [
        "Make routines visual — a bathroom chart works beautifully for young children.",
        "Do it together until they do it well alone. Brush your teeth side by side for years.",
        "Never skip the routine when tired — that is exactly when habits break.",
        "Frame hygiene as self-respect, not shame: 'We take care of our bodies because we matter.'",
        "For resistant kids: try electric toothbrushes, flavored floss, fun tongue scrapers.",
      ]},
    ],
  },
  {
    id: "electronics", emoji: "📱", label: "Electronics\n& Screens", color: "#64748B",
    tips: [
      { title: "Screen Guidelines by Age (AAP)", points: [
        "Under 18–24 months: No screens except video-calling family.",
        "Ages 2–5: Maximum 1 hour per day of high-quality, co-viewed content.",
        "Ages 6–12: Consistent limits on time AND content; no screens at dinner or bedtime.",
        "Teens: Prioritize sleep, physical activity, and in-person connection over screen time.",
        "All ages: No devices in bedrooms at night — charge in a common area.",
        "Intentionality matters more than perfection. Have a plan, be flexible, stay involved.",
      ]},
      { title: "The Risks of Too Much Screen Time", points: [
        "Sleep: screens before bed delay sleep onset and reduce deep sleep quality.",
        "Attention: auto-playing videos condition the brain for constant short-burst stimulation.",
        "Social skills lag when screen time replaces face-to-face play and conversation.",
        "Posture & eyes: use the 20-20-20 rule — every 20 min, look 20 ft away for 20 sec.",
        "Dopamine loops in games and social media closely mirror addiction reward pathways.",
        "Children who spend 7+ hours/day on screens are twice as likely to have anxiety or depression.",
      ]},
      { title: "Rules That Actually Work", points: [
        "Set rules together with your child — they respect rules they helped create.",
        "Time-based limits tied to behavior: 'Homework done → 45 minutes of gaming.'",
        "Create screen-free zones: dining table always, bedrooms at night.",
        "Watch together sometimes — co-viewing lets you discuss what they see.",
        "Model your own limits — they notice when you stare at your phone during dinner.",
      ]},
      { title: "Healthy Alternatives to Screens", points: [
        "Art, crafts, and building (LEGOs, woodworking, origami) develop patience and focus.",
        "Sports and outdoor play: best substitute — improves mood, focus, and sleep.",
        "Teach a skill early: music, drawing, cooking, photography — they carry these for life.",
        "Boredom is productive. Resist the urge to entertain constantly. Boredom sparks creativity.",
        "Even 20 minutes of outdoor time daily measurably reduces anxiety in children.",
      ]},
    ],
  },
  {
    id: "friends", emoji: "👫", label: "Friends &\nBullying", color: "#F59E0B",
    tips: [
      { title: "Choosing Good Friends", points: [
        "Good friends make your child feel good about themselves — not pressured, judged, or anxious.",
        "After playdates, ask yourself: is my child happy and settled, or unsettled and off? That is data.",
        "Ask open-ended questions: 'What do you like about them?' Not lectures — curiosity.",
        "Don't ban friendships outright — it usually backfires and drives the friendship underground.",
        "Know their friends' parents. Invite the family over. Involvement is protection.",
        "Invest in their other friendships so bad influence has competition.",
      ]},
      { title: "Signs of a Bad Influence", points: [
        "Your child starts hiding things, lying more, or becoming increasingly secretive.",
        "Rapid shift in values — language, attitude, or behavior changes suddenly after a new friendship.",
        "They feel pressured to do things they don't want to do.",
        "The friend group mocks rules, parents, teachers, or school.",
        "Address concerns calmly with curiosity: 'Tell me more about this friend of yours.'",
      ]},
      { title: "Bullying — Prevention", points: [
        "Talk openly about bullying before it happens — children need the vocabulary.",
        "Teach the difference: teasing (both can laugh), vs bullying (one person is repeatedly hurt).",
        "Build confidence and identity outside school through hobbies, sports, skills, and faith.",
        "Children with strong self-esteem are less likely to be targeted and more likely to resist pressure.",
        "Teach assertive (not aggressive) responses: firm voice, eye contact, walk away calmly.",
        "Bystander power: research shows bullying stops within 10 seconds when a peer speaks up.",
      ]},
      { title: "Bullying — When It Happens", points: [
        "Believe them first — don't minimize: 'That sounds really hard. Tell me everything.'",
        "Do not immediately tell them to fight back — this escalates most situations.",
        "Document every incident: date, what happened, what was said, who witnessed.",
        "Contact the school in writing (email) — a paper trail creates accountability.",
        "Don't contact the bully's parents yourself without school involvement first.",
        "For cyberbullying: screenshot everything, block, report on the platform, then report to school.",
        "If school does not act — escalate to the district, or police for threats or harassment.",
        "Keep the conversation open — isolated kids suffer the longest.",
      ]},
    ],
  },
  {
    id: "teens", emoji: "🧑", label: "Teen Years\n11–17", color: "#DC2626",
    tips: [
      { title: "What Is Changing in Their Brain", points: [
        "The teen brain is under construction — the prefrontal cortex (decisions, impulse control) isn't fully developed until age 25.",
        "Moodiness, risk-taking, and peer obsession are neurologically normal — not just attitude.",
        "Sleep shifts forward biologically — teens genuinely cannot fall asleep before 11pm easily.",
        "Identity is their core project: 'Who am I?' Try to support, not answer that for them.",
        "Pushing back against parents is a healthy developmental step toward independence.",
      ]},
      { title: "Keeping Them Safe", points: [
        "Know where they are, who they're with, and what time they'll be back. Always.",
        "The more connected to family, the less peer pressure controls their choices.",
        "Teens who feel safe coming to you without judgment make better decisions.",
        "Talk about alcohol, drugs, and sex early and matter-of-factly — before peers do.",
        "Establish a no-questions code: 'Text me the word, I come pick you up, no lecture.'",
        "Online safety: discuss sexting, predators, screenshots, and the permanent nature of the internet.",
      ]},
      { title: "Keeping Them Busy (Idle = Risky)", points: [
        "Idle teens are at highest risk — boredom fuels peer pressure and risk-seeking behavior.",
        "Sports teams: the best single protective factor — discipline, identity, belonging, fitness.",
        "Crafts, arts, music, coding, photography, woodworking — teach a skill they can own.",
        "Part-time jobs at 16+: build responsibility, money skills, and identity outside of school.",
        "Volunteer work builds empathy and purpose — two powerful protective factors.",
        "Never force an activity — a forced hobby breeds resentment. Let them choose.",
      ]},
      { title: "Their Emotional World", points: [
        "Be present without being intrusive — drive them places and they will talk when ready.",
        "Don't lecture during an emotional moment. Listen first. Advice only if asked.",
        "Normalize their emotions: 'It makes sense that you feel that way.'",
        "Share your own teenage struggles — it humanizes you and builds real connection.",
        "Watch for depression: persistent sadness, withdrawal, sleep changes → seek professional help.",
        "Remind them often that being young doesn't last forever. Help them enjoy it, not rush through it.",
      ]},
    ],
  },
];

// ─── Privacy content ───────────────────────────────────────────────────────────

const PRIVACY_QUICK = [
  { emoji: "💾", title: "Data stays on your device", body: "All family data (profiles, chores, journals, screen time) is stored locally on your device. Our AI server only receives the text you type for AI features — no family data, no identifiers." },
  { emoji: "🚫", title: "We never sell your data", body: "We do not share data with advertisers, data brokers, or analytics companies. Period." },
  { emoji: "🤝", title: "Third-party services", body: "AI features use OpenRouter (Llama 3.1 free model) — only your typed prompt is sent, encrypted in transit. Google Drive backup goes to YOUR account only. No other third parties." },
  { emoji: "👶", title: "COPPA compliant", body: "Spinini is directed at parents, not children. We do not collect data from children via our servers. All child data stays on your device." },
  { emoji: "🔐", title: "Permissions you grant", body: "We only request permissions we actually need — camera, microphone, location, notifications, usage access, accessibility service, and overlay. Each can be revoked in device Settings." },
  { emoji: "🗑️", title: "Delete your data anytime", body: "Uninstall the app or clear app storage to delete everything locally. Delete the Spinini folder from Google Drive to remove backups." },
  { emoji: "⚖️", title: "GDPR & CCPA rights", body: "You have rights to access, correct, delete, and export your data. Email " + CONTACT_EMAIL + " and we respond within 30 days." },
];

const DATA_TABLE = [
  ["What we collect", "Why", "Stored where"],
  ["Parent name, PIN (hashed)", "Account access", "On your device only"],
  ["Child names, ages, photos", "Profiles", "On your device only"],
  ["GPS location (background)", "Location map, Safe Zones", "On your device only"],
  ["Per-app screen time", "Reports, limit enforcement", "On your device only"],
  ["Foreground app name", "Block rule enforcement", "On your device only"],
  ["Camera snapshots", "Camera Watch sessions", "On your device only"],
  ["Journals, drawings, chores", "Family content", "On your device / your Drive"],
  ["AI chat text (prompts only)", "AI responses", "OpenRouter API (encrypted, not stored)"],
  ["Google OAuth token", "Drive backup", "On your device only"],
];

const PERMISSIONS_TABLE = [
  ["Permission", "Purpose", "Required?"],
  ["Camera", "Camera Watch, chore proofs, profile photos", "Optional"],
  ["Microphone", "Fun Lock voice, story narration", "Optional"],
  ["Location (background)", "Location map, safe zones, SOS", "Optional"],
  ["Notifications", "Homework reminders, pings, SOS alerts", "Recommended"],
  ["Photo Library", "Chore proofs, memories, profile pictures", "Optional"],
  ["Contacts", "Child's emergency contact list", "Optional"],
  ["Usage Access (Android)", "Per-app screen time data", "Required for reports"],
  ["Accessibility Service (Android)", "Detect foreground app for blocking", "Required for app blocking"],
  ["Display Over Other Apps (Android)", "Show lock overlay over blocked apps", "Required for locking"],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requestAllPermissions(cameraRequest: () => Promise<any>): Promise<string[]> {
  const missing: string[] = [];
  try { const r = await cameraRequest(); if (r.status !== "granted") missing.push("Camera"); } catch {}
  try { const r = await AudioModule.requestRecordingPermissionsAsync(); if (!r.granted) missing.push("Microphone"); } catch {}
  try { const r = await Location.requestForegroundPermissionsAsync(); if (r.status !== "granted") missing.push("Location"); } catch {}
  try { const r = await Location.requestBackgroundPermissionsAsync(); if (r.status !== "granted") missing.push("Background Location"); } catch {}
  try { const r = await Notifications.requestPermissionsAsync(); if (r.status !== "granted") missing.push("Notifications"); } catch {}
  try { const r = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (r.status !== "granted") missing.push("Photo Library"); } catch {}
  try { const r = await Contacts.requestPermissionsAsync(); if (r.status !== "granted") missing.push("Contacts"); } catch {}
  return missing;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HelpPrivacyScreen() {
  const router = useRouter();
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<Tab>("help");
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [importing, setImporting] = useState(false);
  const [, requestCamera] = useCameraPermissions();
  const [selectedCat, setSelectedCat] = useState<string>(GUIDE_CATEGORIES[0].id);
  const activeGuide = GUIDE_CATEGORIES.find(c => c.id === selectedCat) ?? GUIDE_CATEGORIES[0];

  async function handleExportData() {
    setExporting(true);
    try {
      const r = await exportAndShare(state);
      // The share sheet has already opened; this confirms what was bundled.
      Alert.alert(
        "📦 Export ready",
        `Bundled ${r.noteCount} note${r.noteCount !== 1 ? "s" : ""}, ${r.ideaCount} idea${r.ideaCount !== 1 ? "s" : ""} and ${r.photoCount} photo${r.photoCount !== 1 ? "s" : ""} from ${r.kids} child${r.kids !== 1 ? "ren" : ""} into a .zip.\n\nUse the share sheet to save it to Google Drive, Files, or anywhere you like.`,
      );
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  function handleImportData() {
    Alert.alert(
      "Restore from backup?",
      "This REPLACES all current data on this device with the contents of a Spinini export .zip. Use this when setting up a new device. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Choose file",
          style: "destructive",
          onPress: async () => {
            setImporting(true);
            try {
              const res = await importBackup();
              if (!res) return; // user cancelled the file picker
              (dispatch as (a: any) => void)({ type: "@@HYDRATE", payload: res.state });
              Alert.alert(
                "✅ Data restored",
                `Imported ${res.kids} child${res.kids !== 1 ? "ren" : ""} and ${res.photosRestored} photo${res.photosRestored !== 1 ? "s" : ""}.`,
              );
            } catch (e) {
              Alert.alert("Import failed", e instanceof Error ? e.message : String(e));
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  }

  async function handleSavePhotos() {
    setSavingPhotos(true);
    try {
      const n = await savePhotosToGallery(state);
      Alert.alert(
        n > 0 ? "🖼️ Photos saved" : "No photos to save",
        n > 0
          ? `Saved ${n} photo${n !== 1 ? "s" : ""} to your gallery in the "Spinini" album.`
          : "We couldn't find any saved pictures in your family's data yet.",
      );
    } catch (e) {
      Alert.alert("Couldn't save photos", e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPhotos(false);
    }
  }

  async function handleCheckPermissions() {
    setChecking(true);
    const missing = await requestAllPermissions(requestCamera);
    setChecking(false);
    if (missing.length === 0) {
      Alert.alert("✅ All Permissions Granted", "The app has everything it needs to work properly.");
    } else {
      Alert.alert(
        "⚠️ Missing Permissions",
        `These permissions were not granted:\n• ${missing.join("\n• ")}\n\nGo to device Settings → Privacy to enable them manually.`
      );
    }
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🛡️ Help & Privacy</Text>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === "help" && styles.tabActive]} onPress={() => setTab("help")}>
          <Text style={[styles.tabText, tab === "help" && styles.tabTextActive]}>❓ Help</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "guide" && styles.tabActive]} onPress={() => setTab("guide")}>
          <Text style={[styles.tabText, tab === "guide" && styles.tabTextActive]}>📚 Guide</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "privacy" && styles.tabActive]} onPress={() => setTab("privacy")}>
          <Text style={[styles.tabText, tab === "privacy" && styles.tabTextActive]}>🔒 Privacy</Text>
        </TouchableOpacity>
      </View>

      {tab === "help" ? (
        <>
          {/* ── Check for Updates ── */}
          <TouchableOpacity
            style={[styles.updateBtn, updating && { opacity: 0.7 }]}
            onPress={() => checkForUpdates(setUpdating)}
            disabled={updating}
            activeOpacity={0.85}
          >
            {updating ? (
              <ActivityIndicator color="#fff" size="small" style={{ marginVertical: 4 }} />
            ) : (
              <>
                <Text style={styles.updateBtnIcon}>🔄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.updateBtnTitle}>Check for Updates</Text>
                  <Text style={styles.updateBtnSub}>Version {APP_VERSION} installed</Text>
                </View>
                <Text style={styles.updateBtnArrow}>›</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Upgrade to Ad-Free (parent mode only) ── */}
          <TouchableOpacity
            style={styles.upgradeAdFreeBtn}
            onPress={() => router.push("/parent/(more)/upgrade-adfree" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.upgradeAdFreeBtnIcon}>🚫📢</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeAdFreeBtnTitle}>Remove Ads from Spinini</Text>
              <Text style={styles.upgradeAdFreeBtnSub}>
                App is 100% free · $19.99 one-time removes all parent-side ads
              </Text>
            </View>
            <Text style={styles.upgradeAdFreeBtnArrow}>›</Text>
          </TouchableOpacity>

          {/* Permissions */}
          <TouchableOpacity style={[styles.permBtn, checking && { opacity: 0.7 }]} onPress={handleCheckPermissions} disabled={checking}>
            {checking ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.permBtnText}>🔐 Check & Request App Permissions</Text>}
          </TouchableOpacity>
          <Text style={styles.permHint}>Tap to ensure Spinini has all necessary device permissions — camera, location, microphone, notifications, and more.</Text>

          {/* ── Export my data ── */}
          <View style={styles.exportCard}>
            <Text style={styles.exportTitle}>📦 Export My Data</Text>
            <Text style={styles.exportSub}>
              Bundle everyone's notes, ideas and photos into a .zip you can save to Google Drive,
              Files, or anywhere — organised in neat folders per child. Your data never leaves your device until you share it.
            </Text>
            <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.7 }]} onPress={handleExportData} disabled={exporting} activeOpacity={0.85}>
              {exporting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.exportBtnText}>Export &amp; Share .zip</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportSecondaryBtn, savingPhotos && { opacity: 0.7 }]} onPress={handleSavePhotos} disabled={savingPhotos} activeOpacity={0.85}>
              {savingPhotos ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={styles.exportSecondaryText}>🖼️ Save all photos to gallery</Text>}
            </TouchableOpacity>

            <View style={styles.exportDivider} />
            <Text style={styles.exportSub}>
              Got a new device? Restore everything from a backup .zip you exported on the old one.
            </Text>
            <TouchableOpacity style={[styles.exportSecondaryBtn, importing && { opacity: 0.7 }]} onPress={handleImportData} disabled={importing} activeOpacity={0.85}>
              {importing ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={styles.exportSecondaryText}>📥 Import / Restore from .zip</Text>}
            </TouchableOpacity>
          </View>

          {SECTIONS.map((section, si) => (
            <View key={si} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.heading}</Text>
              {section.items.map((item, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.q}>{item.q}</Text>
                  <Text style={styles.a}>{item.a}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Spinini — Keeping Families Connected 💜</Text>
          </View>
        </>
      ) : tab === "guide" ? (
        <>
          {/* ── Header ── */}
          <View style={styles.guideHeader}>
            <Text style={styles.guideHeaderTitle}>📚 Parenting Guide</Text>
            <Text style={styles.guideHeaderSub}>Research-backed how-tos for every stage</Text>
          </View>

          {/* ── Two-panel layout ── */}
          <View style={[styles.guidePanel, { height: GUIDE_H }]}>

            {/* Left sidebar — categories */}
            <ScrollView
              style={styles.guideSidebar}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {GUIDE_CATEGORIES.map(cat => {
                const active = cat.id === selectedCat;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catBtn, active && { backgroundColor: cat.color, borderColor: cat.color }]}
                    onPress={() => setSelectedCat(cat.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.catLabel, active && styles.catLabelActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Right content */}
            <ScrollView
              style={styles.guideContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {/* Category hero */}
              <View style={[styles.catHero, { backgroundColor: activeGuide.color + "18", borderColor: activeGuide.color + "40" }]}>
                <Text style={styles.catHeroEmoji}>{activeGuide.emoji}</Text>
                <Text style={[styles.catHeroTitle, { color: activeGuide.color }]}>
                  {activeGuide.label.replace("\n", " ")}
                </Text>
              </View>

              {activeGuide.tips.map((section, si) => (
                <View key={si} style={styles.tipSection}>
                  <View style={[styles.tipSectionBar, { backgroundColor: activeGuide.color }]} />
                  <Text style={[styles.tipSectionTitle, { color: activeGuide.color }]}>{section.title}</Text>
                  {section.points.map((point, pi) => (
                    <View key={pi} style={styles.tipRow}>
                      <Text style={[styles.tipBullet, { color: activeGuide.color }]}>•</Text>
                      <Text style={styles.tipText}>{point}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </>
      ) : (
        <>
          {/* Privacy hero */}
          <View style={styles.privacyHero}>
            <Text style={styles.privacyHeroEmoji}>🛡️</Text>
            <Text style={styles.privacyHeroTitle}>Your Privacy Matters</Text>
            <Text style={styles.privacyHeroSub}>Effective May 20, 2026</Text>
          </View>

          {/* TL;DR summary */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>The Short Version</Text>
            {[
              "Your data stays on YOUR device — we have no servers storing it.",
              "We never sell your data or use it for advertising.",
              "You can delete everything by uninstalling the app.",
              "AI features use Anthropic's API over encrypted HTTPS.",
              "Google Drive backup goes to YOUR account only.",
            ].map((item, i) => (
              <Text key={i} style={styles.summaryItem}>✅  {item}</Text>
            ))}
          </View>

          {/* Quick cards */}
          <Text style={styles.privSection}>Our Commitments</Text>
          {PRIVACY_QUICK.map((card, i) => (
            <View key={i} style={styles.privCard}>
              <Text style={styles.privCardEmoji}>{card.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.privCardTitle}>{card.title}</Text>
                <Text style={styles.privCardBody}>{card.body}</Text>
              </View>
            </View>
          ))}

          {/* Data table */}
          <Text style={styles.privSection}>What Data We Collect</Text>
          <View style={styles.tableWrap}>
            {DATA_TABLE.map((row, ri) => (
              <View key={ri} style={[styles.tableRow, ri === 0 && styles.tableHeaderRow]}>
                {row.map((cell, ci) => (
                  <Text key={ci} style={[styles.tableCell, ri === 0 && styles.tableHeaderCell, { flex: ci === 0 ? 1.4 : ci === 2 ? 1.4 : 1 }]}>
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          {/* Permissions table */}
          <Text style={styles.privSection}>Device Permissions</Text>
          <View style={styles.tableWrap}>
            {PERMISSIONS_TABLE.map((row, ri) => (
              <View key={ri} style={[styles.tableRow, ri === 0 && styles.tableHeaderRow]}>
                {row.map((cell, ci) => (
                  <Text key={ci} style={[styles.tableCell, ri === 0 && styles.tableHeaderCell, { flex: ci === 0 ? 1.2 : ci === 1 ? 1.8 : 0.8 }]}>
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          {/* Special disclosure cards */}
          <Text style={styles.privSection}>Required Disclosures</Text>

          <View style={styles.disclosureCard}>
            <Text style={styles.disclosureTitle}>♿ Accessibility Service (Android)</Text>
            <Text style={styles.disclosureBody}>
              Spinini requests the Android Accessibility Service permission. It is used {"—"} and only used {"—"} to detect which app is in the foreground so blocked apps can be immediately overlaid with a lock screen. We do not read the content of any app, capture keystrokes, see passwords, or access any data from other apps beyond the package name.
            </Text>
          </View>

          <View style={styles.disclosureCard}>
            <Text style={styles.disclosureTitle}>📊 Usage Access (Android)</Text>
            <Text style={styles.disclosureBody}>
              Spinini reads per-app screen time data via Android's UsageStatsManager. This data is used only to generate parental usage reports and enforce daily app time limits. It is stored locally on your device and never transmitted to our servers.
            </Text>
          </View>

          <View style={styles.disclosureCard}>
            <Text style={styles.disclosureTitle}>🪟 Display Over Other Apps (Android)</Text>
            <Text style={styles.disclosureBody}>
              Spinini uses the SYSTEM_ALERT_WINDOW permission to display a full-screen lock overlay when a child opens a blocked app or when a parent activates Remote Lock. No content is captured through this overlay. It can be revoked at any time in Settings → Apps → Spinini → Display Over Other Apps.
            </Text>
          </View>

          {/* Apple nutrition label summary */}
          <Text style={styles.privSection}>Apple App Store — Data Summary</Text>
          <View style={styles.appleCard}>
            <Text style={styles.appleLabel}>Data Used to Track You</Text>
            <Text style={styles.appleValue}>None — we do not track you across other apps.</Text>
            <View style={styles.appleDivider} />
            <Text style={styles.appleLabel}>Data Linked to You (stored on your device)</Text>
            {["Contact info (parent name)", "User content (journals, drawings, messages)", "Location", "Usage data (screen time)", "Health & fitness entries", "Financial info (piggy bank)", "Photos & videos", "Browsing history (safe browser, local only)"].map((item, i) => (
              <Text key={i} style={styles.appleItem}>• {item}</Text>
            ))}
          </View>

          {/* Children's privacy */}
          <Text style={styles.privSection}>COPPA — Children's Privacy</Text>
          <View style={styles.card}>
            <Text style={styles.a}>
              Spinini is a parental control tool directed at parents and legal guardians, not at children. We do not operate servers that collect children's personal information. Children's data (journal, drawings, school info) is stored only on the parent-controlled device. Parents provide consent when creating a child profile.{"\n\n"}
              If you believe we have inadvertently collected information from a child, contact us at {CONTACT_EMAIL} and we will delete it.
            </Text>
          </View>

          {/* Rights */}
          <Text style={styles.privSection}>Your Rights (GDPR / CCPA)</Text>
          <View style={styles.card}>
            {[
              "Access — request a copy of data we hold",
              "Correction — request correction of inaccurate data",
              "Deletion — request erasure ('Right to be Forgotten')",
              "Portability — receive your data in portable format",
              "Object — object to certain processing activities",
              "CCPA: We do not sell personal information",
            ].map((right, i) => (
              <Text key={i} style={[styles.a, { marginBottom: 4 }]}>✓  {right}</Text>
            ))}
            <Text style={[styles.a, { marginTop: 8, color: Colors.textSecondary }]}>
              Contact {CONTACT_EMAIL} — we respond within 30 days.
            </Text>
          </View>

          {/* Changes */}
          <Text style={styles.privSection}>Changes to This Policy</Text>
          <View style={styles.card}>
            <Text style={styles.a}>
              We may update this Privacy Policy from time to time. When we do, we update the Effective Date at the top and show an in-app notice for material changes. Continued use constitutes acceptance.
            </Text>
          </View>

          {/* Contact */}
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Spinini Privacy Request`)}>
            <Text style={styles.contactBtnText}>📬 Email Our Privacy Team</Text>
          </TouchableOpacity>
          <Text style={styles.permHint}>{CONTACT_EMAIL}</Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Spinini Inc.</Text>
            <Text style={[styles.footerText, { fontWeight: "400", fontSize: FontSize.xs }]}>
              All data stays local on your device unless you enable Google Drive backup.
            </Text>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:              { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },

  tabRow:             { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  tab:                { flex: 1, paddingVertical: 11, borderRadius: Radius.lg, backgroundColor: Colors.surfaceLight, alignItems: "center", ...Shadow.sm },
  tabActive:          { backgroundColor: Colors.primary },
  tabText:            { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive:      { color: "#fff" },

  // Check for Updates button
  updateBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0EA5E9",
    borderRadius: Radius.xl, paddingVertical: 11, paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: "#0EA5E9", shadowOpacity: 0.30,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 5,
  },
  updateBtnIcon:  { fontSize: 24 },
  updateBtnTitle: { fontSize: FontSize.base, fontWeight: "900", color: "#fff" },
  updateBtnSub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.80)", marginTop: 2 },
  updateBtnArrow: { fontSize: 22, color: "rgba(255,255,255,0.60)" },

  // Upgrade to Ad-Free CTA
  upgradeAdFreeBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#6C3CE1",
    borderRadius: Radius.xl, paddingVertical: 11, paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: "#6C3CE1", shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6,
  },
  upgradeAdFreeBtnIcon: { fontSize: 28 },
  upgradeAdFreeBtnTitle: { fontSize: FontSize.base, fontWeight: "900", color: "#fff" },
  upgradeAdFreeBtnSub: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.78)", marginTop: 2, lineHeight: 16 },
  upgradeAdFreeBtnArrow: { fontSize: 24, color: "rgba(255,255,255,0.60)" },

  permBtn:            { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 13, alignItems: "center", marginBottom: 6 },
  permBtnText:        { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  permHint:           { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", marginBottom: Spacing.lg },

  exportCard:         { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1.5, borderColor: Colors.primary + "33", ...Shadow.sm },
  exportTitle:        { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  exportSub:          { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  exportBtn:          { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 13, alignItems: "center", marginBottom: 8 },
  exportBtnText:      { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  exportSecondaryBtn: { backgroundColor: Colors.primary + "18", borderRadius: Radius.md, paddingVertical: 13, alignItems: "center" },
  exportSecondaryText:{ color: Colors.primary, fontWeight: "800", fontSize: FontSize.base },
  exportDivider:      { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  section:            { marginBottom: Spacing.md },
  sectionTitle:       { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8, paddingLeft: 4, borderLeftWidth: 3, borderLeftColor: Colors.primary, paddingVertical: 2 },
  card:               { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  q:                  { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary, marginBottom: 4 },
  a:                  { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22 },
  footer:             { backgroundColor: Colors.primary + "12", borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", marginTop: Spacing.md, gap: 4 },
  footerText:         { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },

  // Privacy tab
  privacyHero:        { alignItems: "center", paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  privacyHeroEmoji:   { fontSize: 48, marginBottom: 8 },
  privacyHeroTitle:   { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary },
  privacyHeroSub:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  summaryBox:         { backgroundColor: Colors.success + "15", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.success + "40" },
  summaryTitle:       { fontSize: FontSize.base, fontWeight: "800", color: Colors.success, marginBottom: 8 },
  summaryItem:        { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22, marginBottom: 2 },

  privSection:        { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm },

  privCard:           { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  privCardEmoji:      { fontSize: 28, marginTop: 2 },
  privCardTitle:      { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  privCardBody:       { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  tableWrap:          { borderRadius: Radius.lg, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  tableRow:           { flexDirection: "row" },
  tableHeaderRow:     { backgroundColor: Colors.primary + "15" },
  tableCell:          { padding: 8, fontSize: 11, color: Colors.textPrimary, borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.border, lineHeight: 16 },
  tableHeaderCell:    { fontWeight: "800", color: Colors.primary },

  disclosureCard:     { backgroundColor: "#FEF3C7", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: Colors.warning },
  disclosureTitle:    { fontSize: FontSize.sm, fontWeight: "800", color: "#92400E", marginBottom: 6 },
  disclosureBody:     { fontSize: FontSize.sm, color: "#78350F", lineHeight: 20 },

  appleCard:          { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  appleLabel:         { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  appleValue:         { fontSize: FontSize.sm, color: Colors.success, fontWeight: "600", marginBottom: 8 },
  appleDivider:       { height: 1, backgroundColor: Colors.border, marginBottom: 8 },
  appleItem:          { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },

  contactBtn:         { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", marginTop: Spacing.md },
  contactBtnText:     { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // ── Parenting Guide ────────────────────────────────────────────────────────
  guideHeader:        { alignItems: "center", paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  guideHeaderTitle:   { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary },
  guideHeaderSub:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 3 },

  guidePanel:         { flexDirection: "row", gap: 8 },

  guideSidebar:       { width: 100, flexShrink: 0 },
  catBtn:             {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: Radius.lg, marginBottom: 6,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  catEmoji:           { fontSize: 22, marginBottom: 3 },
  catLabel:           { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, textAlign: "center", lineHeight: 13 },
  catLabelActive:     { color: "#fff" },

  guideContent:       { flex: 1 },
  catHero:            {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: Radius.xl, padding: 12,
    borderWidth: 1.5, marginBottom: 10,
  },
  catHeroEmoji:       { fontSize: 32 },
  catHeroTitle:       { fontSize: FontSize.md, fontWeight: "900", flexShrink: 1 },

  tipSection:         { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, ...Shadow.sm },
  tipSectionBar:      { height: 3, borderRadius: 2, marginBottom: 6, width: 32 },
  tipSectionTitle:    { fontSize: FontSize.sm, fontWeight: "800", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  tipRow:             { flexDirection: "row", gap: 6, marginBottom: 6, alignItems: "flex-start" },
  tipBullet:          { fontSize: 16, lineHeight: 21, fontWeight: "800" },
  tipText:            { flex: 1, fontSize: 12.5, color: Colors.textPrimary, lineHeight: 19 },
});
