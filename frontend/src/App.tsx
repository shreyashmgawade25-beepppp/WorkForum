
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  Hammer,
  HeartHandshake,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
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
    <section className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Worker workspace</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Welcome, {userName}</h1><p className="mt-2 text-slate-500">Manage your local services and respond to customer requests.</p></div>
        <div className="flex gap-2"><button onClick={() => void refreshDashboard()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">Refresh</button><button onClick={onSignOut} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Sign out</button></div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Incoming requests</p><p className="mt-2 text-3xl font-bold">{bookings.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Awaiting response</p><p className="mt-2 text-3xl font-bold text-amber-600">{pendingCount}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Your service listings</p><p className="mt-2 text-3xl font-bold">{myServices.length}</p></div>
      </div>
      {profileExists === false && <form onSubmit={saveProfile} className="mt-7 rounded-2xl border border-teal-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Set up your worker profile</h2><p className="mt-1 text-sm text-slate-500">Create your profile before publishing services or receiving requests.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">City<input value={city} onChange={(e) => setCity(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold sm:col-span-2">Professional bio<textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} required minLength={10} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label></div><button disabled={busyId === "profile"} className="mt-4 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busyId === "profile" ? "Saving…" : "Create worker profile"}</button></form>}
      {profileExists && <form onSubmit={addService} className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Publish a service</h2><p className="mt-1 text-sm text-slate-500">Set a transparent price and estimated duration for customers.</p><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">Service category<select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label className="text-sm font-semibold">Price (₹)<input type="number" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Duration (minutes)<input type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label></div><button disabled={busyId === "service" || !services.length} className="mt-4 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busyId === "service" ? "Publishing…" : "Publish service listing"}</button></form>}
      <div className="mt-8"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold">Incoming bookings</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{bookings.length} total</span></div>
        {loading ? <div className="mt-4 rounded-2xl bg-white p-8 text-slate-500">Loading your workspace…</div> : dashboardError ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{dashboardError}<p className="mt-2">Create your worker profile above if you haven't already, then refresh.</p></div> : bookings.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h3 className="font-bold">No bookings yet</h3><p className="mt-2 text-sm text-slate-500">Publish a service listing and customer requests for your services will appear here.</p></div> : <div className="mt-4 grid gap-4">{bookings.map((booking) => <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide">{booking.status}</span><span className="text-xs text-slate-400">#{booking.id.slice(0, 8)}</span></div><h3 className="mt-3 text-lg font-bold">{booking.service_name || "Service request"}</h3><p className="mt-1 text-sm text-slate-500">Customer: {booking.customer_name || booking.customer_id}</p></div><p className="text-2xl font-extrabold text-teal-800">₹{Number(booking.agreed_price).toLocaleString("en-IN")}</p></div><p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{booking.description}</p><p className="mt-3 text-xs text-slate-400">Received {new Date(booking.created_at).toLocaleString("en-IN")}</p><div className="mt-4 flex flex-wrap gap-2">{booking.status === "pending" && <><button disabled={busyId === booking.id} onClick={() => void changeStatus(booking, "accepted")} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Accept booking</button><button disabled={busyId === booking.id} onClick={() => void changeStatus(booking, "rejected")} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">Reject</button></>}{booking.status === "accepted" && <button disabled={busyId === booking.id} onClick={() => void changeStatus(booking, "completed")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Mark completed</button>}</div></article>)}</div>}
      </div>
    </section>
  );
}

function App() {
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
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

  const filteredWorkers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return workers;

    return workers.filter((worker) =>
      `${worker.worker_name} ${worker.service_name} ${worker.category} ${worker.city}`
        .toLowerCase()
        .includes(term),
    );
  }, [workers, search]);

  const smartMatchedWorkers = useMemo(() => {
    return filteredWorkers
      .map((worker) => ({ worker, match: getSmartMatch(worker, workers, search) }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [filteredWorkers, workers, search]);

  function searchForService(name: string) {
    setSearch(name);
    document.getElementById("workers")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    document.getElementById("workers")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  async function handleRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || !localStorage.getItem("workforum_token")) {
      setAuthMode("login");
      setAuthOpen(true);
      setNotice("Sign in as a customer to submit your service request.");
      return;
    }

    if (currentUser.role !== "customer") {
      setNotice("Please sign in with a customer account to request a service.");
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
      setNotice(
        `Booking confirmed in the system! Booking ID: ${booking.id} · Status: ${booking.status} · Agreed price: ₹${Number(booking.agreed_price).toLocaleString("en-IN")}.`,
      );
      setSelectedWorker(null);
      setCustomerName("");
      setCustomerPhone("");
      setJobDescription("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create booking.";
      setNotice(`Booking failed: ${message}`);
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
      setAuthOpen(false);
      setAuthPassword("");
      setNotice(`Signed in as ${result.user.full_name}. You can now request services.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      setNotice(`Sign-in failed: ${message}`);
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    logoutUser();
    setCurrentUser(null);
    setNotice("You have been signed out.");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
              <HeartHandshake size={23} />
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              Work<span className="text-teal-700">Forum</span>
            </span>
          </a>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#services" className="hover:text-teal-700">
              Explore services
            </a>
            <a href="#workers" className="hover:text-teal-700">
              Find workers
            </a>
            <a href="#trust" className="hover:text-teal-700">
              How trust works
            </a>
          </div>

          {currentUser ? (
            <div className="hidden items-center gap-3 md:flex">
              <span className="max-w-40 truncate text-sm text-slate-600">
                Hi, {currentUser.full_name}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthMode("login"); setAuthOpen(true); }}
              className="hidden rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 md:block"
            >
              Sign in / Join <ArrowRight className="ml-1 inline" size={15} />
            </button>
          )}

          <button
            className="rounded-lg p-2 md:hidden"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </nav>

        {menuOpen && (
          <div className="grid gap-3 border-t border-slate-100 bg-white px-5 py-4 md:hidden">
            <a onClick={() => setMenuOpen(false)} href="#services">
              Explore services
            </a>
            <a onClick={() => setMenuOpen(false)} href="#workers">
              Find workers
            </a>
            <a onClick={() => setMenuOpen(false)} href="#trust">
              How trust works
            </a>
          </div>
        )}
      </header>

      {notice && (
        <div
          role="status"
          className="mx-auto mt-4 flex max-w-7xl items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
        >
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
            className="shrink-0 rounded p-1 hover:bg-teal-100"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {currentUser?.role === "customer" && (
        <section id="booking-history" className="mx-auto mt-6 max-w-7xl px-5 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Customer workspace</p>
                <h2 className="mt-1 text-2xl font-extrabold">My booking history</h2>
                <p className="mt-1 text-sm text-slate-500">Track requests, agreed prices, and service progress.</p>
              </div>
              <span className="w-fit rounded-full bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-800">{customerBookings.length} bookings</span>
            </div>
            {customerBookingsLoading ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading your bookings…</p> : customerBookingsError ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Could not load booking history: {customerBookingsError}</p> : customerBookings.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center"><p className="font-semibold">No bookings yet</p><p className="mt-1 text-sm text-slate-500">When you request a service, it will appear here with its current status.</p></div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{customerBookings.map((booking) => <article key={booking.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{booking.service_name || "Service booking"}</h3><p className="mt-1 text-xs text-slate-500">Booking #{booking.id.slice(0, 8)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${booking.status === "completed" ? "bg-emerald-100 text-emerald-800" : booking.status === "rejected" ? "bg-rose-100 text-rose-800" : booking.status === "accepted" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{booking.status}</span></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-xs text-slate-500">Requested</p><p className="mt-1 text-sm">{booking.created_at ? new Date(booking.created_at).toLocaleString("en-IN") : "Date unavailable"}</p></div><p className="text-xl font-extrabold text-teal-800">₹{Number(booking.agreed_price).toLocaleString("en-IN")}</p></div>{booking.description && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{booking.description}</p>}</article>)}</div>}
          </div>
        </section>
      )}

      {currentUser?.role === "worker" && (
        <WorkerDashboard
          userName={currentUser.full_name}
          onSignOut={handleLogout}
          onNotice={setNotice}
        />
      )}

      <main className={currentUser?.role === "worker" ? "hidden" : ""}>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3.5 py-2 text-sm text-teal-200">
                <Sparkles size={15} />
                Local talent. Real opportunities.
              </div>

              <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Good work starts{" "}
                <span className="text-teal-300">closer to home.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Discover local professionals, compare worker-set prices, and
                find the help you need. One marketplace connecting communities
                with the people who power them.
              </p>

              <form
                className="mt-9 flex max-w-xl flex-col gap-3 rounded-2xl bg-white p-3 shadow-2xl sm:flex-row"
                onSubmit={handleSearch}
              >
                <div className="flex flex-1 items-center gap-3 px-3">
                  <Search className="shrink-0 text-slate-400" size={20} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search plumbing, repairs, workers..."
                    aria-label="Search services and workers"
                    className="w-full py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white transition hover:bg-teal-800"
                >
                  Find help <ArrowRight className="ml-2 inline" size={16} />
                </button>
              </form>

              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="text-teal-300" size={17} />
                  Trust-focused
                </span>
                <span className="flex items-center gap-2">
                  <HeartHandshake className="text-teal-300" size={17} />
                  Fair pricing
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="text-teal-300" size={17} />
                  Hyperlocal discovery
                </span>
              </div>
            </div>

            <div className="mx-auto w-full max-w-lg">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur sm:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">
                      Your local community
                    </p>
                    <h2 className="mt-1 text-xl font-bold">
                      Work, within reach.
                    </h2>
                  </div>
                  <div className="rounded-2xl bg-teal-400/10 p-3 text-teal-300">
                    <MapPin size={24} />
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <BriefcaseBusiness
                      className="mb-3 text-teal-300"
                      size={23}
                    />
                    <p className="text-2xl font-bold">
                      {loading ? "..." : services.length}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Service types
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <HeartHandshake
                      className="mb-3 text-cyan-300"
                      size={23}
                    />
                    <p className="text-2xl font-bold">
                      {loading ? "..." : workers.length}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Active listings
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-teal-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-teal-400/15 p-2.5 text-teal-300">
                      <Clock3 size={22} />
                    </div>
                    <div>
                      <p className="font-semibold">Find help nearby</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Explore real worker listings and prices.
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    Listings and service categories are loaded from the
                    WorkForum API.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-teal-700">
                Explore the network
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                What can we help with?
              </h2>
              <p className="mt-3 text-slate-500">
                Browse service categories from the live backend.
              </p>
            </div>
            <a href="#workers" className="text-sm font-semibold text-teal-800">
              Browse workers <ArrowRight className="ml-1 inline" size={16} />
            </a>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    onClick={() => searchForService(service.name)}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-800 transition group-hover:bg-teal-700 group-hover:text-white">
                      <Icon size={23} />
                    </div>
                    <h3 className="mt-5 font-bold">{service.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {service.description}
                    </p>
                    <span className="mt-3 inline-block rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
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

        <section id="workers" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-teal-700">
                Live marketplace
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Find talent near you.
              </h2>
              <p className="mt-3 text-slate-500">
                Real worker profiles, availability, service details, and
                worker-set prices from the backend.
              </p>
            </div>

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
                    : "Try searching for Plumbing or clear your search."}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-teal-900"><Sparkles size={16} /> SmartMatch ranking</span>
                <span className="text-teal-800">Sorted by availability, verification, rating, experience, and price</span>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {smartMatchedWorkers.map(({ worker, match }, rankIndex) => (
                  <article
                    key={worker.listing_id}
                    className="rounded-2xl border border-slate-200 p-5 transition hover:border-teal-200 hover:shadow-lg"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">#{rankIndex + 1} match</span>
                      <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-900">{match.score}/100 score</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-lg font-bold text-teal-800">
                          {initials(worker.worker_name)}
                        </div>
                        <div>
                          <h3 className="font-bold">{worker.worker_name}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {worker.service_name}
                          </p>
                        </div>
                      </div>

                      {worker.verification_status === "verified" && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                          <BadgeCheck size={14} />
                          Verified
                        </span>
                      )}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {worker.description}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Star
                          className="fill-amber-400 text-amber-400"
                          size={16}
                        />
                        {worker.average_rating > 0
                          ? worker.average_rating.toFixed(1)
                          : "New worker"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={15} />
                        {worker.city}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock3 size={15} />
                        {worker.estimated_duration_minutes} min
                      </span>
                    </div>

                    {match.reasons.length > 0 && <p className="mt-3 text-xs leading-5 text-teal-800">Why this match: {match.reasons.join(" · ")}</p>}

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <div>
                        <span className="text-xl font-extrabold">
                          ₹{worker.price.toLocaleString("en-IN")}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">
                          Worker-set starting price
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedWorker(worker)}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                      >
                        Request service
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              </>
            )}
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-teal-700">
                Built around people
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Trust the process. Respect the work.
              </h2>
              <p className="mt-4 leading-7 text-slate-500">
                WorkForum is designed to give customers choice and workers
                greater control over pricing, availability, and opportunity.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <ShieldCheck className="text-teal-700" size={25} />
                <h3 className="mt-3 font-bold">TrustLayer</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Planned verification workflows, booking-linked reviews, and
                  complaint handling.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                <Sparkles className="text-teal-700" size={25} />
                <h3 className="mt-3 font-bold">SmartMatch</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  SmartMatch scores live listings using availability, verification, ratings, completed jobs, relative price, and search relevance. Scores are transparent prototype heuristics, not a trained AI model.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={`bg-slate-950 px-5 py-8 text-center text-sm text-slate-400 ${currentUser?.role === "worker" ? "hidden" : ""}`}>
        <p className="font-semibold text-white">
          Work<span className="text-teal-300">Forum</span>
        </p>
        <p className="mt-2">
          Connecting local talent with meaningful opportunity.
        </p>
        <p className="mt-4 text-xs">
          Hackathon prototype · Service categories and worker listings are
          retrieved from the backend.
        </p>
      </footer>

      {authOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !authBusy) setAuthOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
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
                onClick={() => setAuthOpen(false)}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedWorker(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
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
                onClick={() => setSelectedWorker(null)}
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
