const API_BASE_URL = "http://127.0.0.1:8000";

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface WorkerListing {
  listing_id: string;
  worker_id: string;
  service_id: string;
  worker_name: string;
  service_name: string;
  category: string;
  description: string;
  price: number;
  estimated_duration_minutes: number;
  city: string;
  is_available: boolean;
  verification_status: string;
  average_rating: number;
  completed_jobs: number;
}

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: "customer" | "worker";
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  user: AuthUser;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  role: "customer" | "worker";
}

export interface BookingCreate {
  worker_service_id: string;
  description: string;
  scheduled_for?: string | null;
}

export interface Booking {
  id: string;
  customer_id: string;
  worker_id: string;
  worker_service_id: string;
  description: string;
  scheduled_for: string | null;
  agreed_price: number | string;
  status: string;
  created_at: string;
  customer_name?: string;
  service_name?: string;
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = false): Promise<T> {
  const token = localStorage.getItem("workforum_token");
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (authenticated && token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = await response.json();
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? data);
    } catch {
      // Keep the status message if the server response is not JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getServices(search = ""): Promise<Service[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<Service[]>(`/api/services/${query}`);
}

export function discoverWorkerServices(search = ""): Promise<WorkerListing[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<WorkerListing[]>(`/api/workers/services/discover${query}`);
}

export function createBooking(payload: BookingCreate): Promise<Booking> {
  if (!localStorage.getItem("workforum_token")) throw new Error("Please sign in first.");
  return request<Booking>("/api/bookings/", { method: "POST", body: JSON.stringify(payload) }, true);
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const data = await request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
  localStorage.setItem("workforum_token", data.access_token);
  localStorage.setItem("workforum_user", JSON.stringify(data.user));
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const body = new URLSearchParams({ username: email, password });
  const data = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  localStorage.setItem("workforum_token", data.access_token);
  localStorage.setItem("workforum_user", JSON.stringify(data.user));
  return data;
}

export function logoutUser(): void {
  localStorage.removeItem("workforum_token");
  localStorage.removeItem("workforum_user");
}

export function getWorkerBookings(): Promise<Booking[]> {
  return request<Booking[]>("/api/bookings/worker", {}, true);
}

export function updateBookingStatus(bookingId: string, status: "accepted" | "rejected" | "completed"): Promise<Booking> {
  return request<Booking>(`/api/bookings/${encodeURIComponent(bookingId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }, true);
}

export interface WorkerProfilePayload {
  bio: string;
  city: string;
}

export function createWorkerProfile(payload: WorkerProfilePayload): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/api/workers/profile", {
    method: "POST", body: JSON.stringify(payload),
  }, true);
}

export function getMyWorkerProfile(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/api/workers/profile/me", {}, true);
}

export interface WorkerServiceCreate {
  service_id: string;
  base_price: number;
  estimated_duration_minutes: number;
}

export function createWorkerService(payload: WorkerServiceCreate): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/api/workers/services", {
    method: "POST", body: JSON.stringify(payload),
  }, true);
}

export function getMyWorkerServices(): Promise<WorkerListing[]> {
  return request<WorkerListing[]>("/api/workers/services/me", {}, true);
}

export function getCustomerBookings(): Promise<Booking[]> {
  return request<Booking[]>("/api/bookings/me", {}, true);
}