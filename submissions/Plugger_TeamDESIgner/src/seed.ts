import type {
  AppState,
  CampusEvent,
  Club,
  EventCategory,
  VibeTag,
  RsvpStatus,
  User,
} from "./models";
import assets from "./assetManifest.json";
const clubMarks = [assets.clubs.codrit, assets.clubs["ieee-rit-b"], assets.clubs.udbhav, assets.clubs.lenscraft, assets.clubs["robotics-aero"], assets.clubs["sports-collective"]];

const clubInfo: [string, EventCategory, string, number, string, number[]][] = [
  [
    "CodeRIT",
    "Tech",
    "The coding community at Ramaiah. Bring a half-built prototype to our open labs, find teammates, or join a late-night sprint.",
    246,
    "coderit",
    [1, 2],
  ],
  [
    "IEEE RIT-B",
    "Tech",
    "The student branch for people who take things apart. We run hardware labs, bot meets and peer-led engineering workshops.",
    192,
    "ieeeritb",
    [3],
  ],
  [
    "UDBHAV Cultural Council",
    "Cultural",
    "The student crew behind RIT’s stages. From first rehearsals to the final encore, we make space for campus performers.",
    315,
    "udbhavrit",
    [4],
  ],
  [
    "LensCraft RIT",
    "Social",
    "Photography walks and critique circles for campus image makers. Phone cameras and first-time photographers are welcome.",
    118,
    "lenscraftrit",
    [1, 5],
  ],
  [
    "RIT Robotics & Aero Club",
    "Workshop",
    "A hands-on lab for flight, motion and embedded systems. Join a build session in the Mechanical Block.",
    87,
    "ritrobotics",
    [6],
  ],
  [
    "Ramaiah Sports Collective",
    "Sports",
    "Find a running buddy, book a practice game, or meet the student crews who keep the grounds busy after class.",
    224,
    "ramaiahsports",
    [7],
  ],
];
const eventInfo: [
  string,
  number,
  EventCategory,
  VibeTag[],
  number,
  number,
  string,
  string,
  number,
  string,
][] = [
  [
    "Live Robotics Bot Arena",
    2,
    "Tech",
    ["Get Active", "Learn Something"],
    -30,
    60,
    "ESB Quadrangle",
    "ESB Block",
    2,
    "Watch student-built bots take on the arena in the ESB Quadrangle. Meet the IEEE pit crew between heats and get a close look at the drives and sensors.",
  ],
  [
    "Street Portrait Photo Walk",
    4,
    "Social",
    ["Chill", "Meet People"],
    -15,
    75,
    "LHC Courtyard",
    "Lecture Hall Complex",
    4,
    "Meet by the courtyard steps for a guided street portrait walk. We’ll work in pairs on natural light, then swap our favourite frames. Bring any camera.",
  ],
  [
    "Rapid Web & AI Sprint",
    1,
    "Tech",
    ["Learn Something", "Meet People"],
    40,
    160,
    "DES Block Lab 3",
    "DES Block",
    3,
    "Build a working web prototype in two hours with CodeRIT mentors. Bring a laptop and meet your team at Lab 3.",
  ],
  [
    "Design Systems Sync & Portfolio Review",
    4,
    "Workshop",
    ["Learn Something", "Chill"],
    60,
    150,
    "Apex Seminar Hall 2",
    "Apex Block",
    5,
    "Bring a portfolio piece to an open design critique. We’ll compare type scales, sketch components and give each other concrete feedback.",
  ],
  [
    "Overnight Mini-Hackathon",
    1,
    "Tech",
    ["Late Night", "Learn Something"],
    1560,
    2280,
    "Apex Block Auditorium",
    "Apex Block",
    5,
    "Pair up at sunset, build through the night and show your project over breakfast. Desks and power points are limited; unclaimed places go to the waitlist.",
  ],
  [
    "UDBHAV Pro-Show & Battle of Bands",
    3,
    "Cultural",
    ["Late Night", "Meet People"],
    3000,
    3240,
    "RIT Main Ground",
    "Sports Grounds",
    7,
    "Campus bands go head to head before the UDBHAV headliner takes the main stage. Doors open at the ground entrance; have your entry pass ready.",
  ],
  [
    "Midnight Chai & UI Jam",
    4,
    "Workshop",
    ["Late Night", "Meet People"],
    1800,
    2040,
    "ESB Rooftop Terrace",
    "ESB Block",
    4,
    "Bring one interface to sketch over chai on the terrace. Contributions cover drinks and snacks, and the host confirms each seat.",
  ],
  [
    "Campus Night Run 5K",
    6,
    "Sports",
    ["Get Active", "Meet People"],
    5760,
    5820,
    "RIT Main Ground",
    "Sports Grounds",
    7,
    "Vote for a weekend start time for our five-kilometre loop. Meet at the main ground for a group warm-up. All paces welcome.",
  ],
  [
    "Secret Core-Team Afterparty",
    3,
    "Social",
    ["Late Night", "Chill"],
    4440,
    4680,
    "Old Canteen Lawn",
    "Canteen Block",
    4,
    "An evening for the volunteers who made UDBHAV possible. Bring your crew pass and the password from the organizing team.",
  ],
  [
    "Drone Assembly Hands-On Workshop",
    5,
    "Workshop",
    ["Learn Something"],
    5760,
    5940,
    "Mechanical Block Bay 1",
    "Mechanical Block",
    6,
    "Build a small quadcopter with the aero team. We’ll cover frames, motor wiring and controller setup at shared workbenches.",
  ],
  [
    "Freshers Orientation & Code Jam",
    1,
    "Tech",
    ["Meet People", "Learn Something"],
    -4320,
    -4140,
    "DES Block Lab 3",
    "DES Block",
    3,
    "Our opening code jam brought new students into the lab for an evening of pair programming. Find the group album and reconnect with your teammates.",
  ],
  [
    "Monsoon Acoustic Night",
    3,
    "Cultural",
    ["Chill", "Late Night"],
    -8640,
    -8460,
    "RIT Amphitheatre",
    "Amphitheatre",
    5,
    "Guitars, unplugged sets and songs from the crowd. Revisit the acoustic night and add your favourite moment to the wall.",
  ],
];
const names = [
  "Sai Sagar",
  "Aarav Kulkarni",
  "Diya Nair",
  "Rohan Deshmukh",
  "Meera Iyer",
  "Karthik Rao",
  "Ananya Sharma",
  "Pranav Menon",
];
const bios = [
  "Building small things with CodeRIT. Usually in the design lab after class.",
  "Frontend tinkerer and regular at open lab.",
  "IEEE volunteer, circuit builder and robotics fan.",
  "Stage manager at UDBHAV. Always looking for new campus bands.",
  "Portrait photographer and LensCraft walk leader.",
  "Mechanical engineering student with a soft spot for quadcopters.",
  "Weekend runner and captain of our campus 5K crew.",
  "Acoustic guitarist and first-year code jam regular.",
];

export function seed(): AppState {
  const seedAnchor = Date.now();
  const offset = (minutes: number) =>
    new Date(seedAnchor + minutes * 60000).toISOString();
  const clubs: Club[] = clubInfo.map(
    (
      [name, category, description, memberCount, instagramHandle, admins],
      i,
    ) => ({
      id: "c" + (i + 1),
      name,
      category,
      description,
      memberCount,
      instagramHandle,
      slug: instagramHandle,
      logoUrl: clubMarks[i],
      adminUserIds: admins.map((n) => "u" + n),
    }),
  );
  const users: User[] = names.map((name, i) => ({
    name,
    id: "u" + (i + 1),
    usn: "1MS24CS0" + String(14 + i * 7),
    email: name.toLowerCase().replace(" ", ".") + "@student.msrit.edu",
    bio: bios[i],
    avatarUrl: assets.avatars[("u" + (i + 1)) as keyof typeof assets.avatars],
    socials: { instagram: name.toLowerCase().replace(" ", "_") },
    role: i === 0 || i === 7 ? "student" : "organizer",
    interests:
      i === 0 ? ["Tech", "Workshop", "Cultural"] : [clubs[i % 6].category],
    followedClubIds: i === 0 ? ["c1", "c2", "c4"] : [clubs[i % 6].id],
    savedEventIds: i === 0 ? ["e10"] : [],
    managedClubIds: clubs
      .filter((c) => c.adminUserIds.includes("u" + (i + 1)))
      .map((c) => c.id),
  }));
  const events: CampusEvent[] = eventInfo.map(
    (
      [
        title,
        club,
        category,
        vibes,
        start,
        end,
        name,
        building,
        distance,
        description,
      ],
      i,
    ) => ({
      id: "e" + (i + 1),
      title,
      posterUrl: assets.posters[("e" + (i + 1)) as keyof typeof assets.posters],
      description,
      clubId: "c" + club,
      hostUserId:
        clubs[club - 1].adminUserIds[clubs[club - 1].adminUserIds.length - 1],
      coHostUserIds: [],
      category,
      vibes,
      startTime: offset(start),
      endTime: offset(end),
      venue: { name, building, distanceMinutesFromCenter: distance },
      isPollMode: false,
      datePollOptions: [],
      isFree: true,
      ticketTiers: [],
      promoCodes: [],
      chipIn: { enabled: false, mode: "required" },
      questionnaire: [],
      settings: {
        isPublic: true,
        rsvpsOpen: end > 0,
        requireApproval: false,
        maxPlusOnes: 0,
        allowGuestsInviteMutuals: true,
        anonymizeGuestList: false,
        hideGuestCount: false,
        hideActivityTimestamps: false,
        allowPhotoUploads: true,
        autoRemindersEnabled: true,
        allowBlastReplies: true,
      },
      createdAt: offset(-10080),
      isSeed: true,
    }),
  );
  events[4].settings.capacity = 4;
  Object.assign(events[5], {
    isFree: false,
    ticketTiers: [
      ["Early Bird", 199, 50],
      ["General", 349, 150],
      ["VIP Backstage", 599, 20],
    ].map(([name, priceInr, capacity], i) => ({
      id: "tier" + i,
      name,
      priceInr,
      capacity,
      soldCount: 0,
    })),
    promoCodes: [
      { code: "RIT50", discountPercent: 50 },
      { code: "CAMPUS20", discountPercent: 20 },
    ],
  });
  events[6].isFree = false;
  events[6].chipIn = {
    enabled: true,
    mode: "required",
    amountInr: 100,
    upiId: "lenscraft@okaxis",
    paymentLink: "upi://pay?pa=lenscraft%40okaxis&am=100&cu=INR",
  };
  events[6].settings.requireApproval = true;
  events[6].settings.maxPlusOnes = 2;
  events[6].questionnaire = [
    { id: "usn", label: "Your USN?", type: "short_text", required: true },
    {
      id: "drink",
      label: "Chai or Filter Coffee?",
      type: "dropdown",
      options: ["Chai", "Filter coffee"],
      required: true,
    },
  ];
  events[7].isPollMode = true;
  const saturday = new Date(seedAnchor);
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7));
  saturday.setHours(18, 0, 0, 0);
  if (saturday.getTime() <= seedAnchor)
    saturday.setDate(saturday.getDate() + 7);
  events[7].datePollOptions = [
    [0, ["u2", "u3", "u6"]],
    [24, ["u4", "u5"]],
    [168, ["u2", "u4"]],
  ].map(([hours, voters], i) => {
    const t = saturday.getTime() + Number(hours) * 3600000;
    return {
      id: "slot" + i,
      startTime: new Date(t).toISOString(),
      endTime: new Date(t + 3600000).toISOString(),
      voterUserIds: voters as string[],
    };
  });
  Object.assign(events[8].settings, { isPublic: false, password: "RIT2026" });
  events[9].settings.maxPlusOnes = 1;
  const rsvps: AppState["rsvps"] = [];
  function attendees(ev: number, status: RsvpStatus, ids: number[]) {
    ids.forEach((id) => {
      const time = offset(-8000 + rsvps.length * 3);
      rsvps.push({
        id: "seed-r" + (rsvps.length + 1),
        eventId: "e" + ev,
        userId: "u" + id,
        status,
        firstRsvpAt: time,
        updatedAt: time,
        plusOneNames: [],
        questionnaireAnswers: {},
        amountPaidInr: 0,
        chipInConfirmed: false,
        checkedIn: ev >= 11,
        boops: {},
      });
    });
  }
  attendees(1, "going", [2, 3, 4, 6]);
  attendees(2, "going", [1, 5, 7]);
  attendees(3, "going", [2, 8]);
  attendees(4, "going", [1, 5]);
  attendees(5, "going", [2, 3, 4, 5]);
  attendees(5, "waitlist", [6, 7]);
  attendees(7, "pending", [4]);
  attendees(9, "going", [4, 8]);
  attendees(10, "maybe", [2]);
  attendees(11, "going", [1, 2, 3, 4, 5, 6]);
  attendees(12, "going", [1, 4, 5, 8]);
  const activity = (
    id: string,
    eventId: string,
    userId: string,
    text: string,
    minutes: number,
  ): AppState["activities"][number] => ({
    id,
    eventId,
    userId,
    text,
    type: "comment",
    createdAt: offset(minutes),
    boops: {},
    replies: [],
  });
  const blast = activity(
    "seed-a1",
    "e1",
    "u3",
    "The first round is underway. The best view is along the ESB steps!",
    -28,
  );
  Object.assign(blast, { type: "blast", pinned: true, targetAudience: "all" });
  const acoustic = activity(
    "seed-a3",
    "e12",
    "u5",
    "That last acoustic set in the rain was something else.",
    -8460,
  );
  acoustic.boops = { "🔥": ["u1", "u4"], "❤️": ["u8"] };
  acoustic.replies = [
    {
      id: "seed-reply1",
      userId: "u4",
      text: "The encore was my favourite part.",
      createdAt: offset(-8420),
    },
  ];
  const updates = [
    ["e1", "The arena is live", "The first robotics heat has started at ESB."],
    [
      "e2",
      "Photo walk check-in",
      "The LensCraft group is meeting by the courtyard steps.",
    ],
    [
      "e4",
      "Portfolio review today",
      "Bring your portfolio to Apex Seminar Hall 2.",
    ],
    ["e5", "New from CodeRIT", "The overnight hackathon waitlist is open."],
    [
      "e8",
      "Vote on a run time",
      "The sports collective is choosing its next 5K slot.",
    ],
    ["e11", "Photos from the lab", "Your Code Jam album is ready."],
    [
      "e9",
      "Core-team invite",
      "Your UDBHAV crew shared the event password: RIT2026.",
    ],
  ];
  return {
    currentUserId: "u1",
    activeRole: "student",
    themePref: "dark",
    seedAnchor,
    unlockedEventIds: [],
    users,
    clubs,
    events,
    rsvps,
    activities: [
      blast,
      activity(
        "seed-a2",
        "e1",
        "u2",
        "The sensor rig on lane two looks brilliant.",
        -12,
      ),
      acoustic,
    ],
    photos: [
      "Lab partners at work",
      "The DES open lab",
      "Our prototype showcase",
    ].map((caption, i) => ({
      id: "seed-p" + i,
      eventId: "e11",
      userId: "u" + (2 + i),
      imageDataUrl: assets.album.e11[i],
      caption,
      uploadedAt: offset(-4100 + i),
    })),
    notifications: updates.map(([eventId, title, message], i) => ({
      id: "seed-n" + i,
      userId: "u1",
      eventId,
      title,
      message,
      createdAt: offset(-6 - i * 42),
      read: i >= 3,
    })),
  };
}
