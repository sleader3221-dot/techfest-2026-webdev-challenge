export type UserRole = "student" | "organizer";
export type ThemePref = "dark" | "light";
export type EventCategory =
  "Tech" | "Cultural" | "Sports" | "Workshop" | "Recruitment" | "Social";
export type VibeTag =
  "Chill" | "Learn Something" | "Get Active" | "Meet People" | "Late Night";
export type RsvpStatus =
  "going" | "maybe" | "cant_go" | "waitlist" | "pending" | "declined";
export type LiveStatus =
  "happening_now" | "starting_soon" | "upcoming" | "past";

export interface User {
  id: string;
  name: string;
  usn: string;
  email: string;
  bio: string;
  avatarUrl: string;
  socials: { instagram?: string; linkedin?: string; github?: string };
  role: UserRole;
  interests: EventCategory[];
  followedClubIds: string[];
  savedEventIds: string[];
  managedClubIds: string[];
}
export interface Club {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  category: EventCategory;
  memberCount: number;
  adminUserIds: string[];
  instagramHandle?: string;
}
export interface CampusVenue {
  name: string;
  building: string;
  distanceMinutesFromCenter: number;
}
export interface QuestionnaireField {
  id: string;
  label: string;
  type: "short_text" | "dropdown";
  options?: string[];
  required: boolean;
}
export interface TicketTier {
  id: string;
  name: string;
  priceInr: number;
  capacity: number;
  soldCount: number;
}
export interface PromoCode {
  code: string;
  discountPercent: number;
}
export interface DatePollOption {
  id: string;
  startTime: string;
  endTime: string;
  voterUserIds: string[];
}
export interface ChipInConfig {
  enabled: boolean;
  mode: "required" | "pay_what_you_can";
  amountInr?: number;
  upiId?: string;
  paymentLink?: string;
}
export interface EventSettings {
  isPublic: boolean;
  password?: string;
  rsvpsOpen: boolean;
  requireApproval: boolean;
  capacity?: number;
  maxPlusOnes: number;
  allowGuestsInviteMutuals: boolean;
  anonymizeGuestList: boolean;
  hideGuestCount: boolean;
  hideActivityTimestamps: boolean;
  allowPhotoUploads: boolean;
  autoRemindersEnabled: boolean;
  allowBlastReplies: boolean;
}
export interface CampusEvent {
  id: string;
  title: string;
  posterUrl: string;
  description: string;
  clubId: string;
  hostUserId: string;
  coHostUserIds: string[];
  category: EventCategory;
  vibes: VibeTag[];
  startTime: string;
  endTime: string;
  venue: CampusVenue;
  isPollMode: boolean;
  datePollOptions: DatePollOption[];
  isFree: boolean;
  ticketTiers: TicketTier[];
  promoCodes: PromoCode[];
  chipIn: ChipInConfig;
  questionnaire: QuestionnaireField[];
  settings: EventSettings;
  createdAt: string;
  isSeed?: boolean; // true for e1..e12, used by seedRebase
}
export interface RsvpRecord {
  id: string;
  eventId: string;
  userId: string;
  status: RsvpStatus;
  firstRsvpAt: string;
  updatedAt: string;
  plusOneNames: string[];
  questionnaireAnswers: Record<string, string>;
  ticketTierId?: string;
  promoCodeUsed?: string;
  amountPaidInr: number;
  chipInConfirmed: boolean;
  checkedIn: boolean;
  checkedInAt?: string;
  boops: Record<string, string[]>;
}
export interface ActivityReply {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}
export interface ActivityItem {
  id: string;
  eventId: string;
  userId: string;
  type: "comment" | "blast" | "system";
  text: string;
  gifLabel?: string;
  gifDataUrl?: string;
  imageDataUrl?: string;
  targetAudience?: "all" | "going" | "maybe" | "waitlist";
  pinned?: boolean;
  createdAt: string;
  boops: Record<string, string[]>;
  replies: ActivityReply[];
}
export interface PhotoItem {
  id: string;
  eventId: string;
  userId: string;
  imageDataUrl: string;
  caption: string;
  uploadedAt: string;
}
export interface NotificationItem {
  id: string;
  userId: string;
  eventId?: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}
export interface AppState {
  currentUserId: string;
  activeRole: UserRole;
  themePref: ThemePref;
  seedAnchor: number; // ms timestamp when seed times were last anchored
  unlockedEventIds: string[];
  users: User[];
  clubs: Club[];
  events: CampusEvent[];
  rsvps: RsvpRecord[];
  activities: ActivityItem[];
  photos: PhotoItem[];
  notifications: NotificationItem[];
}
