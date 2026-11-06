
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Hammer,
  HeartHandshake,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import {
  createBooking,
  discoverWorkerServices,
  getServices,
  getCustomerBookings,
  loginUser,
  logoutUser,
  registerUser,
  type AuthUser,
  type Service,
  getWorkerBookings,
  getMyWorkerProfile,
  getMyWorkerServices,
  updateBookingStatus,
  createWorkerProfile,
  createWorkerService,
  type Booking,
  type WorkerListing,
} from "./api";
const workforumLogo = new URL("./workforum-logo.png", import.meta.url).href;

function BrandLogo() {
  return (
    <>
      <span className="brand-emblem" aria-hidden="true">
        <img src={workforumLogo} alt="" />
      </span>
      <span className="brand-wordmark">
        <img src={workforumLogo} alt="WorkForum" />
      </span>
    </>
  );
}

const academyNotes = [
  {
    number: "01",
    title: "Make your profile feel like you.",
    description: "A clear introduction and the city you serve help customers understand who you are and where you work.",
    Icon: UserRound,
  },
  {
    number: "02",
    title: "Make the details easy to find.",
    description: "Give each service a straightforward description, transparent starting price, and realistic time estimate.",
    Icon: Wrench,
  },
  {
    number: "03",
    title: "Keep the conversation clear.",
    description: "When a request comes in, a timely and thoughtful response helps set expectations from the start.",
    Icon: MessageCircle,
  },
];

function getServiceIcon(name: string) {
  if (/electric/i.test(name)) return Sparkles;
  if (/carpent/i.test(name)) return Hammer;
  if (/clean|beauty|personal/i.test(name)) return HeartHandshake;
  if (/garden|outdoor/i.test(name)) return Sparkles;
  if (/plumb|repair|paint|ac /i.test(name)) return Wrench;
  return BriefcaseBusiness;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function AnimatedStatistic({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = numberRef.current;
    if (!node) return;

    const showFinalValue = () => setCount(value);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      showFinalValue();
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver((entries, currentObserver) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      currentObserver.disconnect();
      const start = performance.now();
      const update = (now: number) => {
        const progress = Math.min(1, (now - start) / 1400);
        const eased = 1 - (1 - progress) ** 3;
        setCount(Math.floor(value * eased));
        if (progress < 1) frame = requestAnimationFrame(update);
        else setCount(value);
      };
      frame = requestAnimationFrame(update);
    }, { threshold: 0.5 });

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return <span ref={numberRef} aria-hidden="true">{count.toLocaleString("en-IN")}</span>;
}


/** Transparent prototype score (0–100); not a trained AI model. */
function getSmartMatch(worker: WorkerListing, allWorkers: WorkerListing[], term: string) {
  const prices = allWorkers.map((item) => Number(item.price)).filter((price) => Number.isFinite(price) && price > 0);
  const minPrice = prices.length ? Math.min(...prices) : Number(worker.price);
  const maxPrice = prices.length ? Math.max(...prices) : Number(worker.price);
  const price = Number(worker.price) || 0;
  const rating = Number(worker.average_rating) || 0;
  const jobs = Number(worker.completed_jobs) || 0;
  const query = term.trim().toLowerCase();
  const serviceMatch = query && `${worker.service_name} ${worker.category}`.toLowerCase().includes(query);
  const score = Math.round(
    (worker.is_available ? 25 : 0) +
    (worker.verification_status === "verified" ? 15 : 0) +
    Math.min(20, Math.max(0, rating / 5 * 20)) +
    Math.min(15, Math.log10(jobs + 1) * 7.5) +
    (maxPrice === minPrice ? 15 : Math.max(0, 15 * (maxPrice - price) / (maxPrice - minPrice))) +
    (serviceMatch ? 10 : 0)
  );
  const reasons: string[] = [];
  if (worker.is_available) reasons.push("Available now");
  if (worker.verification_status === "verified") reasons.push("Verified profile");
  if (rating >= 4) reasons.push(`${rating.toFixed(1)}★ rating`);
  if (jobs > 0) reasons.push(`${jobs} completed job${jobs === 1 ? "" : "s"}`);
  if (prices.length && price === minPrice) reasons.push("Lowest listed price");
  if (serviceMatch) reasons.push("Matches your search");
  return { score: Math.min(100, score), reasons: reasons.slice(0, 3) };
}


function WorkerDashboard({ userName, onSignOut, onNotice }: { userName: string; onSignOut: () => void; onNotice: (message: string) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [myServices, setMyServices] = useState<WorkerListing[]>([]);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [profileBio, setProfileBio] = useState("Reliable local service professional committed to quality work and fair pricing.");
  const [city, setCity] = useState("Mira-Bhayandar");
  const [serviceId, setServiceId] = useState("");
  const [price, setPrice] = useState("499");
  const [duration, setDuration] = useState("60");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  async function refreshDashboard() {
    setLoading(true);
    setDashboardError("");
    const outcomes = await Promise.allSettled([
      getServices(), getMyWorkerProfile(), getMyWorkerServices(), getWorkerBookings(),
    ]);
    if (outcomes[0].status === "fulfilled") {
      setServices(outcomes[0].value);
      if (!serviceId && outcomes[0].value.length) setServiceId(outcomes[0].value[0].id);
    }
    setProfileExists(outcomes[1].status === "fulfilled");
    if (outcomes[2].status === "fulfilled") setMyServices(outcomes[2].value);
    else setMyServices([]);
    if (outcomes[3].status === "fulfilled") setBookings(outcomes[3].value);
    else {
      setBookings([]);
      const reason = outcomes[3].reason;
      setDashboardError(reason instanceof Error ? reason.message : "Could not load bookings.");
    }
    setLoading(false);
  }

  useEffect(() => { void refreshDashboard(); }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("profile");
    try {
      await createWorkerProfile({ bio: profileBio.trim(), city: city.trim() });
      setProfileExists(true);
      onNotice("Worker profile created successfully.");
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create profile.";
      if (/already|exist|409/i.test(message)) {
        setProfileExists(true);
        onNotice("Your worker profile already exists. You can continue to services and bookings.");
        await refreshDashboard();
      } else onNotice(`Profile setup failed: ${message}`);
    } finally { setBusyId(""); }
  }

  async function addService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceId) { onNotice("No service categories are available yet."); return; }
    setBusyId("service");
    try {
      await createWorkerService({ service_id: serviceId, base_price: Number(price), estimated_duration_minutes: Number(duration) });
      onNotice("Your service listing has been published.");
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish service.";
      onNotice(/already|exist|409/i.test(message) ? "You already offer this service. Choose another category or edit your existing listing." : `Service listing failed: ${message}`);
    } finally { setBusyId(""); }
  }

  async function addPopularServices() {
    const existingServiceIds = new Set(myServices.map((item) => item.service_id));
    const missing = services.filter((service) => !existingServiceIds.has(service.id));
    if (!missing.length) {
      onNotice("You already have listings for every available service category.");
      return;
    }
    setBusyId("bulk-services");
    let added = 0;
    const failed: string[] = [];
    const suggestedPrice = (name: string) => {
      const value = name.toLowerCase();
      if (/plumb/.test(value)) return { price: 499, minutes: 60 };
      if (/electric/.test(value)) return { price: 599, minutes: 60 };
      if (/clean/.test(value)) return { price: 399, minutes: 90 };
      if (/carpent/.test(value)) return { price: 699, minutes: 90 };
      if (/paint/.test(value)) return { price: 999, minutes: 180 };
      if (/ac|air condition|appliance|repair/.test(value)) return { price: 799, minutes: 90 };
      if (/pest/.test(value)) return { price: 899, minutes: 90 };
      if (/garden|landscap/.test(value)) return { price: 499, minutes: 60 };
      if (/beauty|salon|personal care/.test(value)) return { price: 599, minutes: 60 };
      if (/tutor|teach|education/.test(value)) return { price: 499, minutes: 60 };
      if (/move|pack/.test(value)) return { price: 999, minutes: 120 };
      return { price: 499, minutes: 60 };
    };
    for (const service of missing) {
      const suggested = suggestedPrice(service.name);
      try {
        await createWorkerService({ service_id: service.id, base_price: suggested.price, estimated_duration_minutes: suggested.minutes });
        added += 1;
      } catch (error) {
        failed.push(service.name);
      }
    }
    await refreshDashboard();
    onNotice(`Published ${added} additional service${added === 1 ? "" : "s"}${failed.length ? `. Could not publish: ${failed.join(", ")}` : ". Suggested prices are editable in your service listings."}`);
    setBusyId("");
  }

  async function changeStatus(booking: Booking, next: "accepted" | "rejected" | "completed") {
    setBusyId(booking.id);
    try {
      await updateBookingStatus(booking.id, next);
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: next } : item));
      onNotice(`Booking ${booking.id.slice(0, 8)} updated to ${next}.`);
    } catch (error) {
      onNotice(`Could not update booking: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally { setBusyId(""); }
  }

  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  return (
    <section className="worker-dashboard mx-auto min-h-[70vh] max-w-7xl px-5 py-10 lg:px-8" data-motion="workspace-entry">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Worker workspace</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Welcome, {userName}</h1><p className="mt-2 text-slate-500">Manage your local services and respond to customer requests.</p></div>
        <div className="flex gap-2"><button onClick={() => void refreshDashboard()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">Refresh</button><button onClick={onSignOut} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Sign out</button></div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <div data-motion="workspace-metric" className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Incoming requests</p><p className="mt-2 text-3xl font-bold">{bookings.length}</p></div>
        <div data-motion="workspace-metric" className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Awaiting response</p><p className="mt-2 text-3xl font-bold text-amber-600">{pendingCount}</p></div>
        <div data-motion="workspace-metric" className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Your service listings</p><p className="mt-2 text-3xl font-bold">{myServices.length}</p></div>
      </div>
      {profileExists === false && <form onSubmit={saveProfile} className="mt-7 rounded-2xl border border-teal-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Set up your worker profile</h2><p className="mt-1 text-sm text-slate-500">Create your profile before publishing services or receiving requests.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">City<input value={city} onChange={(e) => setCity(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold sm:col-span-2">Professional bio<textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} required minLength={10} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label></div><button disabled={busyId === "profile"} className="mt-4 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busyId === "profile" ? "Saving…" : "Create worker profile"}</button></form>}
      {profileExists && <form onSubmit={addService} className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Publish a service</h2><p className="mt-1 text-sm text-slate-500">Set a transparent price and estimated duration for customers.</p><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">Service category<select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label className="text-sm font-semibold">Price (₹)<input type="number" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Duration (minutes)<input type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label></div><button disabled={busyId === "service" || !services.length} className="mt-4 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busyId === "service" ? "Publishing…" : "Publish service listing"}</button><button type="button" onClick={() => void addPopularServices()} disabled={busyId === "bulk-services" || !services.length || !profileExists} className="mt-4 ml-3 rounded-xl border border-teal-200 px-5 py-3 font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60">{busyId === "bulk-services" ? "Publishing categories…" : `Quick-add all other categories (${Math.max(0, services.length - myServices.length)} available)`}</button><p className="mt-2 text-xs text-slate-500">Quick-add uses suggested demo prices. Review and adjust prices to match your actual services.</p></form>}
      <div className="mt-8"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold">Incoming bookings</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{bookings.length} total</span></div>
        {loading ? <div className="mt-4 rounded-2xl bg-white p-8 text-slate-500">Loading your workspace…</div> : dashboardError ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{dashboardError}<p className="mt-2">Create your worker profile above if you haven't already, then refresh.</p></div> : bookings.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h3 className="font-bold">No bookings yet</h3><p className="mt-2 text-sm text-slate-500">Publish a service listing and customer requests for your services will appear here.</p></div> : <div className="mt-4 grid gap-4">{bookings.map((booking) => <article key={booking.id} data-motion="booking-card" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="booking-status rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide">{booking.status}</span><span className="text-xs text-slate-400">#{booking.id.slice(0, 8)}</span></div><h3 className="mt-3 text-lg font-bold">{booking.service_name || "Service request"}</h3><p className="mt-1 text-sm text-slate-500">Customer: {booking.customer_name || booking.customer_id}</p></div><p className="text-2xl font-extrabold text-teal-800">₹{Number(booking.agreed_price).toLocaleString("en-IN")}</p></div><p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{booking.description}</p><p className="mt-3 text-xs text-slate-400">Received {new Date(booking.created_at).toLocaleString("en-IN")}</p><div className="mt-4 flex flex-wrap gap-2">{booking.status === "pending" && <><button disabled={busyId === booking.id} onClick={() => void changeStatus(booking, "accepted")} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Accept booking</button><button disabled={busyId === booking.id} onClick={() => void changeStatus(booking, "rejected")} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">Reject</button></>}{booking.status === "accepted" && <button disabled={busyId === booking.id} onClick={() => void changeStatus(booking, "completed")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Mark completed</button>}</div></article>)}</div>}
      </div>
    </section>
  );
}

function App() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All services");
  const [maxPrice, setMaxPrice] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [canScrollWorkersPrev, setCanScrollWorkersPrev] = useState(false);
  const [canScrollWorkersNext, setCanScrollWorkersNext] = useState(false);
  const [expandedAcademyNote, setExpandedAcademyNote] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeExiting, setNoticeExiting] = useState(false);
  const noticeDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealedWorkerIds = useRef(new Set<string>());
  const workersCarouselRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [workers, setWorkers] = useState<WorkerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWorker, setSelectedWorker] =
    useState<WorkerListing | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem("workforum_user");
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authClosing, setAuthClosing] = useState(false);
  const [requestClosing, setRequestClosing] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState<"customer" | "worker">("customer");
  const [authBusy, setAuthBusy] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([]);
  const [customerBookingsLoading, setCustomerBookingsLoading] = useState(false);
  const [customerBookingsError, setCustomerBookingsError] = useState("");

  function showNotice(message: string) {
    if (noticeDismissTimer.current !== null) {
      clearTimeout(noticeDismissTimer.current);
      noticeDismissTimer.current = null;
    }
    setNoticeExiting(false);
    setNotice(message);
  }

  function dismissNotice() {
    setNoticeExiting(true);
    if (noticeDismissTimer.current !== null) clearTimeout(noticeDismissTimer.current);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    noticeDismissTimer.current = setTimeout(() => {
      setNotice("");
      setNoticeExiting(false);
      noticeDismissTimer.current = null;
    }, delay);
  }

  function openAuthDialog() {
    if (authCloseTimer.current !== null) clearTimeout(authCloseTimer.current);
    setAuthClosing(false);
    setAuthOpen(true);
  }

  function closeAuthDialog() {
    if (!authOpen || authClosing) return;
    setAuthClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    authCloseTimer.current = setTimeout(() => {
      setAuthOpen(false);
      setAuthClosing(false);
      authCloseTimer.current = null;
    }, delay);
  }

  function openRequestDialog(worker: WorkerListing) {
    if (requestCloseTimer.current !== null) clearTimeout(requestCloseTimer.current);
    setRequestClosing(false);
    setSelectedWorker(worker);
  }

  function closeRequestDialog() {
    if (!selectedWorker || requestClosing) return;
    setRequestClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    requestCloseTimer.current = setTimeout(() => {
      setSelectedWorker(null);
      setRequestClosing(false);
      requestCloseTimer.current = null;
    }, delay);
  }

  function closeMobileMenu() {
    if (!menuOpen || menuClosing) return;
    setMenuClosing(true);
    menuCloseTimer.current = setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
      menuCloseTimer.current = null;
    }, 180);
  }

  function toggleMobileMenu() {
    if (menuOpen) {
      closeMobileMenu();
    } else {
      if (menuCloseTimer.current !== null) clearTimeout(menuCloseTimer.current);
      setMenuClosing(false);
      setMenuOpen(true);
    }
  }

  useEffect(() => () => {
    if (noticeDismissTimer.current !== null) clearTimeout(noticeDismissTimer.current);
    if (authCloseTimer.current !== null) clearTimeout(authCloseTimer.current);
    if (requestCloseTimer.current !== null) clearTimeout(requestCloseTimer.current);
    if (menuCloseTimer.current !== null) clearTimeout(menuCloseTimer.current);
  }, []);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    let activeButton: HTMLElement | null = null;
    const resetMagneticButton = () => {
      activeButton?.style.setProperty("--magnetic-x", "0px");
      activeButton?.style.setProperty("--magnetic-y", "0px");
      activeButton = null;
    };
    const moveMagneticButton = (event: PointerEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-magnetic]")
        : null;
      if (!target || target.matches(":disabled")) {
        resetMagneticButton();
        return;
      }

      if (activeButton && activeButton !== target) resetMagneticButton();
      activeButton = target;
      const bounds = target.getBoundingClientRect();
      const movement = window.matchMedia("(max-width: 1024px)").matches ? 2 : 4;
      target.style.setProperty("--magnetic-x", `${((event.clientX - bounds.left) / bounds.width - 0.5) * movement}px`);
      target.style.setProperty("--magnetic-y", `${((event.clientY - bounds.top) / bounds.height - 0.5) * movement}px`);
    };
    const leaveMagneticButton = (event: PointerEvent) => {
      if (!activeButton || !(event.target instanceof Node) || !activeButton.contains(event.target)) return;
      if (event.relatedTarget instanceof Node && activeButton.contains(event.relatedTarget)) return;
      resetMagneticButton();
    };
    document.addEventListener("pointermove", moveMagneticButton, { passive: true });
    document.addEventListener("pointerout", leaveMagneticButton);
    document.addEventListener("pointerleave", resetMagneticButton);

    return () => {
      resetMagneticButton();
      document.removeEventListener("pointermove", moveMagneticButton);
      document.removeEventListener("pointerout", leaveMagneticButton);
      document.removeEventListener("pointerleave", resetMagneticButton);
    };
  }, []);

  useEffect(() => {
    const cursor = document.querySelector<HTMLElement>(".workforum-cursor");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!cursor || !finePointer.matches || reducedMotion.matches) return;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let activeTarget: Element | null = null;
    const updatePointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      const target = event.target instanceof Element
        ? event.target.closest("[data-cursor]")
        : null;
      const isInteractiveControl = event.target instanceof Element &&
        event.target.closest("a, button, input, select, textarea, [role='button']");
      activeTarget = isInteractiveControl ? null : target;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        cursor.style.setProperty("--cursor-x", `${pointerX}px`);
        cursor.style.setProperty("--cursor-y", `${pointerY}px`);
        cursor.dataset.active = activeTarget ? "true" : "false";
        frame = 0;
      });
    };
    const leavePage = () => {
      activeTarget = null;
      cursor.dataset.active = "false";
    };
    document.addEventListener("pointermove", updatePointer, { passive: true });
    document.addEventListener("pointerleave", leavePage);
    return () => {
      cancelAnimationFrame(frame);
      cursor.dataset.active = "false";
      document.removeEventListener("pointermove", updatePointer);
      document.removeEventListener("pointerleave", leavePage);
    };
  }, []);

  useEffect(() => {
    if (!authOpen && !selectedWorker) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (authOpen && !authBusy) closeAuthDialog();
      if (selectedWorker) closeRequestDialog();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [authOpen, authBusy, selectedWorker, authClosing, requestClosing]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser || currentUser.role !== "customer" || !localStorage.getItem("workforum_token")) {
      setCustomerBookings([]);
      setCustomerBookingsError("");
      setCustomerBookingsLoading(false);
      return;
    }
    setCustomerBookingsLoading(true);
    setCustomerBookingsError("");
    getCustomerBookings()
      .then((items) => { if (!cancelled) setCustomerBookings(items); })
      .catch((err: unknown) => {
        if (!cancelled) setCustomerBookingsError(err instanceof Error ? err.message : "Could not load booking history.");
      })
      .finally(() => { if (!cancelled) setCustomerBookingsLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getServices(), discoverWorkerServices()])
      .then(([serviceData, workerData]) => {
        if (cancelled) return;
        setServices(serviceData);
        setWorkers(workerData);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("WorkForum API error:", err);
        setError(
          "Could not connect to the marketplace API. Check that FastAPI is running.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return services;

    return services.filter((service) =>
      `${service.name} ${service.category} ${service.description}`
        .toLowerCase()
        .includes(term),
    );
  }, [services, search]);

  const workerCategories = useMemo(
    () => Array.from(new Set(workers.map((worker) => worker.category || worker.service_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [workers],
  );
  const availableListingCount = useMemo(
    () => workers.filter((worker) => worker.is_available).length,
    [workers],
  );

  const filteredWorkers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const priceLimit = maxPrice.trim() ? Number(maxPrice) : null;
    return workers.filter((worker) => {
      const matchesSearch = !term || `${worker.worker_name} ${worker.service_name} ${worker.category} ${worker.city} ${worker.description}`.toLowerCase().includes(term);
      const matchesCategory = selectedCategory === "All services" || (worker.category || worker.service_name) === selectedCategory;
      const matchesPrice = priceLimit === null || (Number.isFinite(priceLimit) && worker.price <= priceLimit);
      const matchesAvailability = !availableOnly || worker.is_available;
      const matchesLocation = !locationQuery.trim() || worker.city.toLowerCase().includes(locationQuery.trim().toLowerCase());
      return matchesSearch && matchesCategory && matchesPrice && matchesAvailability && matchesLocation;
    });
  }, [workers, search, selectedCategory, maxPrice, availableOnly, locationQuery]);

  const smartMatchedWorkers = useMemo(() => {
    return filteredWorkers
      .map((worker) => ({ worker, match: getSmartMatch(worker, workers, search) }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [filteredWorkers, workers, search]);
  const workerResultsKey = smartMatchedWorkers.map(({ worker }) => worker.listing_id).join("|");

  useEffect(() => {
    const track = workersCarouselRef.current;
    if (!track) {
      setCanScrollWorkersPrev(false);
      setCanScrollWorkersNext(false);
      return;
    }

    const updateNavigation = () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      setCanScrollWorkersPrev(track.scrollLeft > 2);
      setCanScrollWorkersNext(maxScroll > 2 && track.scrollLeft < maxScroll - 2);
    };
    const resetToStart = () => {
      track.scrollLeft = 0;
      updateNavigation();
    };

    resetToStart();
    track.addEventListener("scroll", updateNavigation, { passive: true });
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(updateNavigation) : null;
    resizeObserver?.observe(track);
    window.addEventListener("resize", updateNavigation);

    return () => {
      track.removeEventListener("scroll", updateNavigation);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateNavigation);
    };
  }, [workerResultsKey, loading]);

  function scrollWorkers(direction: -1 | 1) {
    const track = workersCarouselRef.current;
    const firstCard = track?.querySelector<HTMLElement>(".worker-card");
    if (!track || !firstCard) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const targetScroll = Math.max(0, Math.min(maxScroll, track.scrollLeft + direction * (firstCard.getBoundingClientRect().width + gap)));
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    setCanScrollWorkersPrev(targetScroll > 2);
    setCanScrollWorkersNext(maxScroll > 2 && targetScroll < maxScroll - 2);
    track.scrollTo({ left: targetScroll, behavior });
  }

  function scrollToWorkers() {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    document.getElementById("workers")?.scrollIntoView({ behavior, block: "start" });
  }

  function searchForService(name: string) {
    setSearch(name);
    scrollToWorkers();
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    scrollToWorkers();
  }

  useEffect(() => {
    const revealSelector = ".reveal, [data-motion]";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      document.querySelectorAll<HTMLElement>(revealSelector).forEach((item) => {
        item.classList.add("is-visible");
      });
      return;
    }

    document.documentElement.classList.add("motion-ready");
    const reveal = (element: HTMLElement) => {
      const workerId = element.dataset.motionKey;
      if (element.dataset.motion === "worker-card" && workerId) {
        revealedWorkerIds.current.add(workerId);
      }
      element.classList.add("is-visible");
    };
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            reveal(entry.target);
            currentObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );
    const observeElement = (element: HTMLElement) => {
      if (element.classList.contains("is-visible")) return;
      const workerId = element.dataset.motionKey;
      if (element.dataset.motion === "worker-card" && workerId && revealedWorkerIds.current.has(workerId)) {
        element.classList.add("is-visible");
      } else {
        observer.observe(element);
      }
    };
    const observe = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(revealSelector)) {
        observeElement(root);
      }
      root.querySelectorAll<HTMLElement>(revealSelector).forEach((item) => {
        observeElement(item);
      });
    };
    observe(document);

    const mutations = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) observe(node);
        });
      });
    });
    mutations.observe(document.getElementById("root") ?? document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);

  async function handleRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || !localStorage.getItem("workforum_token")) {
      setAuthMode("login");
      openAuthDialog();
      showNotice("Sign in as a customer to submit your service request.");
      return;
    }

    if (currentUser.role !== "customer") {
      showNotice("Please sign in with a customer account to request a service.");
      return;
    }

    if (!selectedWorker) return;

    setBookingBusy(true);
    try {
      const booking = await createBooking({
        worker_service_id: selectedWorker.listing_id,
        description: jobDescription.trim(),
      });
      setCustomerBookings((items) => [booking, ...items.filter((item) => item.id !== booking.id)]);
      showNotice(
        `Booking confirmed in the system! Booking ID: ${booking.id} · Status: ${booking.status} · Agreed price: ₹${Number(booking.agreed_price).toLocaleString("en-IN")}.`,
      );
      closeRequestDialog();
      setCustomerName("");
      setCustomerPhone("");
      setJobDescription("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create booking.";
      showNotice(`Booking failed: ${message}`);
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      const result =
        authMode === "register"
          ? await registerUser({
              full_name: authName.trim(),
              email: authEmail.trim(),
              phone: authPhone.trim(),
              password: authPassword,
              role: authRole,
            })
          : await loginUser(authEmail.trim(), authPassword);

      setCurrentUser(result.user);
      closeAuthDialog();
      setAuthPassword("");
      showNotice(`Signed in as ${result.user.full_name}. You can now request services.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      showNotice(`Sign-in failed: ${message}`);
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    logoutUser();
    setCurrentUser(null);
    showNotice("You have been signed out.");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <span className="workforum-cursor" aria-hidden="true" />
      <header className={`site-header ${currentUser?.role === "worker" ? "dashboard-header" : "homepage-header"}`}>
        <nav className="site-nav mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#" className="brand-lockup" aria-label="WorkForum home">
            <BrandLogo />
          </a>

          <div className="desktop-links">
            <a href="#services">Explore services</a>
            <a href="#workers">Find professionals</a>
            <a href="#how-it-works">How it works</a>
            <a href="#academy">Academy</a>
          </div>

          {currentUser ? (
            <div className="header-actions">
              <span className="header-user">Hi, {currentUser.full_name}</span>
              <button
                onClick={handleLogout}
                className="header-secondary"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="header-actions">
              <button onClick={() => { setAuthMode("login"); openAuthDialog(); }} className="header-secondary">Sign in</button>
              <button data-magnetic onClick={() => { setAuthRole("customer"); setAuthMode("register"); openAuthDialog(); }} className="header-primary">Get started <ArrowRight size={15} /></button>
            </div>
          )}

          <button
            className="menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen && !menuClosing}
            aria-controls="mobile-navigation"
            onClick={toggleMobileMenu}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </nav>

        {menuOpen && (
          <div id="mobile-navigation" className={`mobile-navigation${menuClosing ? " is-closing" : ""}`} data-motion="mobile-menu">
            <a onClick={closeMobileMenu} href="#services">Explore services</a>
            <a onClick={closeMobileMenu} href="#workers">Find professionals</a>
            <a onClick={closeMobileMenu} href="#how-it-works">How it works</a>
            <a onClick={closeMobileMenu} href="#academy">Academy</a>
            {currentUser ? (
              <button onClick={() => { closeMobileMenu(); handleLogout(); }} className="mobile-menu-action">
                Sign out
              </button>
            ) : (
              <div className="mobile-auth-actions">
                <button onClick={() => { closeMobileMenu(); setAuthMode("login"); openAuthDialog(); }} className="mobile-sign-in">Sign in</button>
                <button data-magnetic onClick={() => { closeMobileMenu(); setAuthRole("customer"); setAuthMode("register"); openAuthDialog(); }} className="header-primary">Get started <ArrowRight size={15} /></button>
              </div>
            )}
          </div>
        )}
      </header>

      {notice && (
        <div
          role="status"
          data-motion="notification"
          className={`mx-auto mt-4 flex max-w-7xl items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900${noticeExiting ? " is-dismissing" : ""}`}
        >
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={dismissNotice}
            className="shrink-0 rounded p-1 hover:bg-teal-100"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {currentUser?.role === "customer" && (
        <section id="booking-history" className="mx-auto mt-6 max-w-7xl px-5 lg:px-8" data-motion="workspace-entry">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Customer workspace</p>
                <h2 className="mt-1 text-2xl font-extrabold">My booking history</h2>
                <p className="mt-1 text-sm text-slate-500">Track requests, agreed prices, and service progress.</p>
              </div>
              <span className="w-fit rounded-full bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-800">{customerBookings.length} bookings</span>
            </div>
            {customerBookingsLoading ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading your bookings…</p> : customerBookingsError ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Could not load booking history: {customerBookingsError}</p> : customerBookings.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center"><p className="font-semibold">No bookings yet</p><p className="mt-1 text-sm text-slate-500">When you request a service, it will appear here with its current status.</p></div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{customerBookings.map((booking) => <article key={booking.id} data-motion="booking-card" className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{booking.service_name || "Service booking"}</h3><p className="mt-1 text-xs text-slate-500">Booking #{booking.id.slice(0, 8)}</p></div><span className={`booking-status rounded-full px-3 py-1 text-xs font-bold capitalize ${booking.status === "completed" ? "bg-emerald-100 text-emerald-800" : booking.status === "rejected" ? "bg-rose-100 text-rose-800" : booking.status === "accepted" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{booking.status}</span></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-xs text-slate-500">Requested</p><p className="mt-1 text-sm">{booking.created_at ? new Date(booking.created_at).toLocaleString("en-IN") : "Date unavailable"}</p></div><p className="text-xl font-extrabold text-teal-800">₹{Number(booking.agreed_price).toLocaleString("en-IN")}</p></div>{booking.description && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{booking.description}</p>}</article>)}</div>}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Live account analytics</p>
                <h2 className="mt-1 text-2xl font-extrabold">Your service activity</h2>
                <p className="mt-1 text-sm text-slate-500">Calculated from your bookings currently returned by WorkForum.</p>
              </div>
              <span className="text-xs text-slate-400">Personal metrics · updates when booking data refreshes</span>
            </div>
            {(() => {
              const completed = customerBookings.filter((booking) => booking.status === "completed");
              const active = customerBookings.filter((booking) => booking.status === "pending" || booking.status === "accepted");
              const spend = completed.reduce((sum, booking) => sum + Number(booking.agreed_price || 0), 0);
              const statuses = [
                { label: "Pending", count: customerBookings.filter((booking) => booking.status === "pending").length, color: "bg-amber-500" },
                { label: "Accepted", count: customerBookings.filter((booking) => booking.status === "accepted").length, color: "bg-blue-500" },
                { label: "Completed", count: completed.length, color: "bg-emerald-500" },
                { label: "Rejected", count: customerBookings.filter((booking) => booking.status === "rejected").length, color: "bg-rose-500" },
              ];
              const maxStatus = Math.max(1, ...statuses.map((status) => status.count));
              const serviceCounts = Object.entries(customerBookings.reduce<Record<string, number>>((counts, booking) => {
                const name = booking.service_name || "Other service";
                counts[name] = (counts[name] || 0) + 1;
                return counts;
              }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
              return <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div data-motion="workspace-metric" className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Total requests</p><p className="mt-2 text-3xl font-extrabold">{customerBookings.length}</p></div>
                  <div data-motion="workspace-metric" className="rounded-xl bg-teal-50 p-4"><p className="text-sm text-teal-800">In progress</p><p className="mt-2 text-3xl font-extrabold text-teal-900">{active.length}</p></div>
                  <div data-motion="workspace-metric" className="rounded-xl bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Completed jobs</p><p className="mt-2 text-3xl font-extrabold text-emerald-900">{completed.length}</p></div>
                  <div data-motion="workspace-metric" className="rounded-xl bg-cyan-50 p-4"><p className="text-sm text-cyan-800">Completed booking value</p><p className="mt-2 text-3xl font-extrabold text-cyan-900">₹{spend.toLocaleString("en-IN")}</p></div>
                </div>
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div><h3 className="font-bold">Booking status breakdown</h3><div className="mt-4 space-y-4">{statuses.map((status) => <div key={status.label}><div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{status.label}</span><span className="font-bold">{status.count}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div data-motion="status-bar" className={`h-full rounded-full ${status.color}`} style={{ width: `${(status.count / maxStatus) * 100}%` }} /></div></div>)}</div></div>
                  <div><h3 className="font-bold">Most requested services</h3>{serviceCounts.length ? <div className="mt-3 space-y-2">{serviceCounts.map(([name, count]) => <div key={name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5"><span className="truncate text-sm text-slate-700">{name}</span><span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">{count} {count === 1 ? "request" : "requests"}</span></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Your service breakdown will appear after you make a booking.</p>}</div>
                </div>
              </>;
            })()}
          </div>
        </section>
      )}

      {currentUser?.role === "worker" && (
        <WorkerDashboard
          userName={currentUser.full_name}
          onSignOut={handleLogout}
          onNotice={showNotice}
        />
      )}

      <main className={currentUser?.role === "worker" ? "hidden" : ""}>
        <section className="hero-section" id="top">
          <div className="hero-backdrop" aria-hidden="true" data-motion="hero-image">
            <img className="hero-backdrop-image" src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=2200&q=90" alt="" fetchPriority="high" />
            <div className="hero-backdrop-shade" />
            <div className="hero-grain" />
          </div>
          <div className="hero-shell">
            <div className="hero-copy reveal">
              <p className="hero-eyebrow"><span /> LOCAL SKILLS. LASTING IMPACT.</p>
              <h1><span className="hero-headline-line"><span>Good work begins</span></span><span className="hero-headline-line"><span>right around</span></span><span className="hero-headline-line"><span><em>the corner.</em></span></span></h1>
              <p className="hero-description" data-motion="hero-description">
                Find the people who make a house feel like home. WorkForum connects you with local professionals for the jobs that matter.
              </p>
              <div className="hero-actions" data-motion-group="hero-actions">
                <a href="#workers" className="primary-button" data-motion="hero-action" data-magnetic>Find a professional <ArrowRight size={17} /></a>
                <button data-motion="hero-action" onClick={() => { setAuthRole("worker"); setAuthMode("register"); openAuthDialog(); }}>
                  Offer your services <ArrowRight size={16} />
                </button>
              </div>
              <form className="hero-search" data-motion="hero-search" onSubmit={handleSearch}>
                <label className="hero-search-field">
                  <Search size={19} aria-hidden="true" />
                  <span className="sr-only">What do you need help with?</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="What do you need help with?"
                    aria-label="Search services and workers"
                  />
                </label>
                <span className="hero-search-divider" />
                <label className="hero-search-field location-field">
                  <MapPin size={19} aria-hidden="true" />
                  <span className="sr-only">Your city or neighborhood</span>
                  <input
                    value={locationQuery}
                    onChange={(event) => setLocationQuery(event.target.value)}
                    placeholder="City or neighborhood"
                    aria-label="Search by city or neighborhood"
                  />
                </label>
                <button type="submit" className="search-submit" aria-label="Search professionals"><ArrowRight size={18} /></button>
              </form>
            </div>
          </div>
          <div className="hero-bottom-line">
            <span>YOUR NEIGHBORHOOD, FULL OF KNOW-HOW</span>
            <a href="#services">Explore what’s possible <ArrowRight size={14} /></a>
            <span className="hero-index">WORKFORUM · 01</span>
          </div>
        </section>

        <section id="services" className="content-section mx-auto max-w-7xl px-5 py-16 lg:px-8 reveal">
          <div className="categories-heading">
            <div>
              <p className="editorial-eyebrow">Explore service categories</p>
              <h2>Find the right help<br />for the work at hand.</h2>
              <p>Explore local services and find a professional who fits your project.</p>
            </div>
            <a href="#workers" className="browse-professionals-link" data-magnetic>
              Browse professionals <ArrowRight size={15} />
            </a>
          </div>

          <div className="category-grid mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              <p className="col-span-full rounded-2xl bg-white p-8 text-slate-500">
                Loading services...
              </p>
            ) : filteredServices.length === 0 ? (
              <p className="col-span-full rounded-2xl bg-white p-8 text-slate-500">
                No matching services found.
              </p>
            ) : (
              filteredServices.map((service) => {
                const Icon = getServiceIcon(service.name);

                return (
                  <button
                    key={service.id}
                    data-motion="category-card"
                    onClick={() => searchForService(service.name)}
                    className="category-card group rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-800 transition group-hover:bg-teal-700 group-hover:text-white">
                      <Icon size={23} />
                    </div>
                    <h3 className="mt-5 font-bold">{service.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {service.description}
                    </p>
                    <span className="category-label mt-3 inline-block rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                      {service.category}
                    </span>
                    <ArrowRight
                      className="mt-5 text-slate-400 group-hover:text-teal-700"
                      size={18}
                    />
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section id="workers" className="workers-section border-y border-slate-200 bg-white reveal">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <div className="professionals-heading">
              <p className="editorial-eyebrow">Find professionals</p>
              <h2>Good people for<br />the job at hand.</h2>
              <p>Compare local service listings by specialty, availability, profile details, and worker-set prices.</p>
            </div>

            <div className="market-filters mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="filter-field">Search
                <div className="filter-input-wrap"><Search size={15} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Service or professional" aria-label="Search professionals and services" /></div>
              </label>
              <label className="filter-field">Location
                <div className="filter-input-wrap"><MapPin size={15} aria-hidden="true" /><input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="City or neighborhood" aria-label="Filter by city or neighborhood" /></div>
              </label>
              <label className="filter-field">Service category
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option>All services</option>{workerCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
              </label>
              <label className="filter-field">Maximum price
                <div className="filter-input-wrap price-input"><span>₹</span><input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Any price" aria-label="Maximum price in rupees" /></div>
              </label>
              <div className="filter-footer">
                <label className="availability-toggle"><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} /> <span>Available professionals only</span></label>
                <button type="button" onClick={() => { setSearch(""); setLocationQuery(""); setSelectedCategory("All services"); setMaxPrice(""); setAvailableOnly(false); }}>Reset filters</button>
                <p>Showing <strong>{filteredWorkers.length}</strong> of {workers.length} service listings</p>
              </div>
            </div>

            {!loading && !error && (
              <div className="market-stats" aria-label="Marketplace statistics">
                <article data-motion="market-stat" aria-label={`${workers.length} service listings`}>
                  <strong><AnimatedStatistic value={workers.length} /></strong>
                  <span>Service listings</span>
                </article>
                <article data-motion="market-stat" aria-label={`${availableListingCount} listings available now`}>
                  <strong><AnimatedStatistic value={availableListingCount} /></strong>
                  <span>Available now</span>
                </article>
                <article data-motion="market-stat" aria-label={`${workerCategories.length} categories represented`}>
                  <strong><AnimatedStatistic value={workerCategories.length} /></strong>
                  <span>Categories represented</span>
                </article>
                <p>Counts reflect the marketplace listings currently returned by WorkForum.</p>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            {loading ? (
              <p className="mt-8 rounded-2xl bg-slate-50 p-8 text-slate-500">
                Loading available workers...
              </p>
            ) : filteredWorkers.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                <Search className="mx-auto text-slate-400" size={28} />
                <p className="mt-3 font-semibold">
                  {workers.length === 0
                    ? "No available worker listings yet"
                    : "No matching workers found"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {workers.length === 0
                    ? "Add an active service listing to an available worker profile."
                    : "Try changing the category, increasing the price limit, or resetting your filters."}
                </p>
                {(search || locationQuery || selectedCategory !== "All services" || maxPrice || availableOnly) && (
                  <button onClick={() => { setSearch(""); setLocationQuery(""); setSelectedCategory("All services"); setMaxPrice(""); setAvailableOnly(false); }} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">Reset filters</button>
                )}
              </div>
            ) : (
              <>
              <div className="smartmatch-strip mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm" data-motion="smartmatch">
                <span><Sparkles size={15} className="smartmatch-icon" /> <strong>SmartMatch</strong><span>Listings ranked for your search</span></span>
                <span>Availability · profile status · rating · experience · price</span>
              </div>
              <div className="professional-carousel-controls" aria-label="Professional listing carousel controls">
                <span>Browse listings</span>
                <div>
                  <button
                    type="button"
                    aria-label="Show previous professional listing"
                    aria-controls="professional-listings-carousel"
                    onClick={() => scrollWorkers(-1)}
                    disabled={!canScrollWorkersPrev}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Show next professional listing"
                    aria-controls="professional-listings-carousel"
                    onClick={() => scrollWorkers(1)}
                    disabled={!canScrollWorkersNext}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div
                id="professional-listings-carousel"
                ref={workersCarouselRef}
                className="professional-carousel-track"
                role="region"
                aria-label="Professional listings"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    scrollWorkers(-1);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    scrollWorkers(1);
                  }
                }}
              >
                {smartMatchedWorkers.map(({ worker, match }, rankIndex) => (
                  <article
                    key={worker.listing_id}
                    data-motion="worker-card"
                    data-motion-key={worker.listing_id}
                    className="worker-card rounded-2xl border border-slate-200 p-5 transition hover:border-teal-200 hover:shadow-lg"
                    data-cursor
                  >
                    <div className="worker-matchline">
                      <span>SMARTMATCH · {rankIndex + 1}</span>
                      <span>{match.score}<small> / 100</small></span>
                    </div>
                    <div className="worker-identity">
                      <div className="worker-avatar" aria-hidden="true">{initials(worker.worker_name)}</div>
                      <div className="worker-title">
                        <h3>{worker.worker_name}</h3>
                        <p>{worker.service_name}</p>
                      </div>
                      <span className={`verification-label ${worker.verification_status === "verified" ? "is-verified" : ""}`}>
                        {worker.verification_status === "verified" && <BadgeCheck size={13} />}
                        {worker.verification_status === "verified" ? "Verified" : worker.verification_status === "pending" ? "Pending" : "Not verified"}
                      </span>
                    </div>

                    <p className="worker-description">
                      {worker.description}
                    </p>

                    <div className="worker-meta">
                      <span><MapPin size={14} /><span>{worker.city}</span></span>
                      <span><Star size={14} className={worker.average_rating > 0 ? "has-rating" : ""} /><span>{worker.average_rating > 0 ? worker.average_rating.toFixed(1) : "No rating yet"}</span></span>
                      <span><Clock3 size={14} /><span>{worker.estimated_duration_minutes} min estimate</span></span>
                      <span><BriefcaseBusiness size={14} /><span>{worker.completed_jobs} completed</span></span>
                      <span className={`availability-label ${worker.is_available ? "is-available" : ""}`}>
                        <i />{worker.is_available ? "Available" : "Unavailable"}
                      </span>
                    </div>

                    {match.reasons.length > 0 && <p className="match-reasons"><Sparkles size={13} /> {match.reasons.join(" · ")}</p>}

                    <div className="worker-card-footer">
                      <div>
                        <span className="worker-price">₹{worker.price.toLocaleString("en-IN")}</span>
                        <p>Starting price</p>
                      </div>
                      <button
                        onClick={() => openRequestDialog(worker)}
                        className="request-service-button"
                        data-magnetic
                      >
                        Request <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              </>
            )}
          </div>
        </section>

        <section id="how-it-works" className="how-section reveal">
            <div className="how-shell">
              <div className="section-heading">
                <p className="eyebrow">A good match, made simple</p>
                <h2>Make room for<br /><em>good work.</em></h2>
                <p>One place to find a professional, or put your own skills to work.</p>
              </div>
              <div className="how-steps" role="region" aria-label="How WorkForum works" tabIndex={isMobileViewport ? 0 : undefined}>
                <article className="how-step" data-motion="how-step">
                  <span className="step-number">01</span>
                  <span className="step-icon"><Search size={22} /></span>
                  <p className="step-audience">FOR CUSTOMERS</p>
                  <h3>Find your person</h3>
                  <p>Explore services and compare local professionals, availability, profile details, and starting prices.</p>
                </article>
                <article className="how-step" data-motion="how-step">
                  <span className="step-number">02</span>
                  <span className="step-icon"><HeartHandshake size={22} /></span>
                  <p className="step-audience">FOR CUSTOMERS</p>
                  <h3>Request with clarity</h3>
                  <p>Choose a professional, describe the job, and submit a request from their live service listing.</p>
                </article>
                <article className="how-step" data-motion="how-step">
                  <span className="step-number">03</span>
                  <span className="step-icon"><BadgeCheck size={22} /></span>
                  <p className="step-audience">FOR PROFESSIONALS</p>
                  <h3>Grow your presence</h3>
                  <p>Create a profile, publish your services and prices, then manage incoming requests in your workspace.</p>
                </article>
              </div>
              <a href="#workers" className="text-link">Explore the marketplace <ArrowRight size={15} /></a>
            </div>
        </section>

        <section id="academy" className="academy-section reveal">
            <div className="academy-shell">
              <div className="academy-intro">
                <p className="eyebrow">THE WORKFORUM ACADEMY</p>
                <h2>Good work is a craft.<br /><em>Keep growing.</em></h2>
                <p>Practical foundations for independent service professionals—built around the things customers need to know before they book.</p>
                <button onClick={() => { setAuthRole("worker"); setAuthMode("register"); openAuthDialog(); }} className="academy-cta">Start your professional profile <ArrowRight size={16} /></button>
              </div>
              <div className="academy-lessons">
                {academyNotes.map(({ number, title, description, Icon }) => (
                  <article key={number} data-cursor>
                    <span>FIELD NOTE {number}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    <Icon size={20} />
                  </article>
                ))}
                <p className="academy-note">A starting point, not a course library. WorkForum Academy is a practical guide for getting your profile and services ready.</p>
              </div>
              <div className="academy-mobile-notes">
                {academyNotes.map(({ number, title, description, Icon }) => {
                  const isExpanded = expandedAcademyNote === number;
                  const panelId = `academy-note-${number}`;
                  return (
                    <div className={`academy-mobile-note${isExpanded ? " is-expanded" : ""}`} key={number} data-motion="academy-note">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        onClick={() => setExpandedAcademyNote(isExpanded ? null : number)}
                      >
                        <span className="academy-mobile-number">FIELD NOTE {number}</span>
                        <span className="academy-mobile-title">{title}</span>
                        <Icon className="academy-mobile-icon" size={18} aria-hidden="true" />
                        <ChevronDown className="academy-mobile-chevron" size={17} aria-hidden="true" />
                      </button>
                      <div className="academy-mobile-panel" id={panelId} aria-hidden={!isExpanded}>
                        <div><p>{description}</p></div>
                      </div>
                    </div>
                  );
                })}
                <p className="academy-note">A starting point, not a course library. WorkForum Academy is a practical guide for getting your profile and services ready.</p>
              </div>
            </div>
        </section>

        <section id="trust" className="trust-section reveal">
            <div className="trust-shell">
              <div className="trust-heading">
                <p className="eyebrow">A little more context goes a long way</p>
                <h2>See what matters.<br /><em>Choose with care.</em></h2>
                <p>WorkForum brings useful listing details together so customers can make a more informed choice—and professionals can show how they work.</p>
              </div>
              <div className="trust-details">
                <article data-motion="trust-row"><ShieldCheck size={20} /><div><h3>Profile status, made visible</h3><p>Verification labels reflect the status recorded on a professional’s profile. They are not a guarantee of work quality.</p></div></article>
                <article data-motion="trust-row"><Star size={20} /><div><h3>Ratings with context</h3><p>Ratings and completed-job counts are shown when available from the marketplace profile.</p></div></article>
                <article data-motion="trust-row"><Sparkles size={20} /><div><h3>A transparent match</h3><p>SmartMatch sorts listings using availability, verification, ratings, experience, price, and relevance. It’s a prototype score, not a trained AI model.</p></div></article>
              </div>
              <div className="community-note" data-motion="community-note">
                <HeartHandshake size={23} />
                <p><strong>Local skill makes a difference.</strong> WorkForum is here to make it easier to find neighborhood professionals and help good work get noticed.</p>
                <a href="#services">Explore local services <ArrowRight size={15} /></a>
              </div>
            </div>
        </section>

        <section className="join-section reveal">
          <div className="join-shell">
            <div className="join-copy" data-motion="cta-copy"><p className="eyebrow">Your next good thing starts here</p><h2>Ready to get it<br />off your list?</h2><p>Find a local pro for your next project, or bring your skills to the neighborhood.</p></div>
            <div className="join-actions">
              <a href="#workers" className="primary-button" data-motion="cta-action" data-magnetic>Find a professional <ArrowRight size={17} /></a>
              <button data-motion="cta-action" onClick={() => { setAuthRole("worker"); setAuthMode("register"); openAuthDialog(); }}>I’m a professional <ArrowRight size={17} /></button>
            </div>
          </div>
        </section>
      </main>

      <footer className={`site-footer reveal ${currentUser?.role === "worker" ? "hidden" : ""}`}>
        <div className="footer-main">
          <div className="footer-brand"><a href="#" className="brand-lockup" aria-label="WorkForum home"><BrandLogo /></a><p>Good work starts closer to home.</p></div>
          <div className="footer-links"><div><strong>Discover</strong><a href="#services">Explore services</a><a href="#workers">Find a professional</a><a href="#how-it-works">How it works</a></div><div><strong>For professionals</strong><a href="#academy">WorkForum Academy</a><button onClick={() => { setAuthRole("worker"); setAuthMode("register"); openAuthDialog(); }}>Offer your services</button></div></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} WorkForum. Made for local communities.</span><span>Service categories and listings are powered by the WorkForum marketplace.</span></div>
      </footer>

      {authOpen && (
        <div
          data-motion="dialog-backdrop"
          className={`dialog-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4${authClosing ? " is-closing" : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !authBusy) closeAuthDialog();
          }}
        >
          <div
            role="dialog"
            data-motion="dialog-panel"
            aria-modal="true"
            aria-labelledby="auth-title"
            className="dialog-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-teal-700">WorkForum account</p>
                <h2 id="auth-title" className="mt-1 text-2xl font-bold">
                  {authMode === "login" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose a customer account to book services or a worker account to manage service requests.
                </p>
              </div>
              <button
                aria-label="Close authentication form"
                disabled={authBusy}
                onClick={closeAuthDialog}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-lg px-3 py-2 ${authMode === "login" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("register")}
                className={`rounded-lg px-3 py-2 ${authMode === "register" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500"}`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
              {authMode === "register" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-semibold" htmlFor="auth-role">Account type</label>
                    <select
                      id="auth-role"
                      value={authRole}
                      onChange={(event) => setAuthRole(event.target.value as "customer" | "worker")}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-teal-600"
                    >
                      <option value="customer">Customer — request services</option>
                      <option value="worker">Worker — manage service requests</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="auth-name" className="mb-1 block text-sm font-semibold">Full name</label>
                    <input
                      id="auth-name"
                      required
                      minLength={2}
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-phone" className="mb-1 block text-sm font-semibold">Phone number</label>
                    <input
                      id="auth-phone"
                      required
                      type="tel"
                      value={authPhone}
                      onChange={(event) => setAuthPhone(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                      placeholder="Your contact number"
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="auth-email" className="mb-1 block text-sm font-semibold">Email</label>
                <input
                  id="auth-email"
                  required
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="auth-password" className="mb-1 block text-sm font-semibold">Password</label>
                <input
                  id="auth-password"
                  required
                  minLength={8}
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                  placeholder="At least 8 characters"
                />
              </div>
              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy ? "Please wait..." : authMode === "login" ? "Sign in" : `Create ${authRole} account`}
              </button>
              <p className="text-xs leading-5 text-slate-500">
                Your password is sent to the WorkForum API over this local development connection.
              </p>
            </form>
          </div>
        </div>
      )}

      {selectedWorker && (
        <div
          data-motion="dialog-backdrop"
          className={`dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4${requestClosing ? " is-closing" : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRequestDialog();
            }
          }}
        >
          <div
            role="dialog"
            data-motion="dialog-panel"
            aria-modal="true"
            aria-labelledby="request-title"
            className="dialog-panel w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-teal-700">
                  Service request
                </p>
                <h2 id="request-title" className="mt-1 text-2xl font-bold">
                  Request {selectedWorker.service_name}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedWorker.worker_name} · {selectedWorker.city}
                </p>
              </div>
              <button
                aria-label="Close request form"
                onClick={closeRequestDialog}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-teal-50 p-4">
              <p className="text-sm text-teal-900">Worker-set starting price</p>
              <p className="mt-1 text-2xl font-extrabold text-teal-900">
                ₹{selectedWorker.price.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs text-teal-800">
                Estimated duration: {selectedWorker.estimated_duration_minutes}{" "}
                minutes
              </p>
            </div>

            <form onSubmit={handleRequestSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="customer-name"
                  className="mb-1 block text-sm font-semibold"
                >
                  Your name
                </label>
                <input
                  id="customer-name"
                  required
                  minLength={2}
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label
                  htmlFor="customer-phone"
                  className="mb-1 block text-sm font-semibold"
                >
                  Contact number
                </label>
                <input
                  id="customer-phone"
                  required
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                  placeholder="Enter your contact number"
                />
              </div>

              <div>
                <label
                  htmlFor="job-description"
                  className="mb-1 block text-sm font-semibold"
                >
                  What help do you need?
                </label>
                <textarea
                  id="job-description"
                  required
                  minLength={5}
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600"
                  placeholder="Describe the work briefly"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                disabled={bookingBusy}
                className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bookingBusy ? "Submitting booking..." : "Confirm service request"}
              </button>
              <p className="text-xs leading-5 text-slate-500">
                Your request is saved to WorkForum when you confirm. Sign in with a customer account; your account is linked to the booking.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
