"use client";

import { useState, useEffect } from "react";
import { UserCircle, Key, Save, MessageCircle, CreditCard } from "lucide-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAuth } from "@/contexts/auth-context";
import { updatePassword, getAuth as getFirebaseAuth } from "firebase/auth";
import { useStoreSettings } from "@/contexts/store-settings-context";
import { isValidRazorpayKeyId, isValidUpiId, normalizePaymentUrl } from "@/lib/payments";
import { PushNotificationSettings } from "@/components/push-notification-settings";

export default function AdminProfilePage() {
  const { user } = useAuth();
  const { settings, saveSettings, ready } = useStoreSettings();
  
  const [username, setUsername] = useState("Admin User");
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber);
  const [whatsappMsg, setWhatsappMsg] = useState(settings.whatsappMessage);
  useEffect(() => {
    document.title = "Settings & Profile | Universal Cycles Admin";
  }, []);

  useEffect(() => {
    if (ready) {
      queueMicrotask(() => {
        setWhatsappNumber(settings.whatsappNumber);
        setWhatsappMsg(settings.whatsappMessage);
      });
    }
  }, [ready, settings.whatsappNumber, settings.whatsappMessage]);
  
  const [razorpayKeyId, setRazorpayKeyId] = useState(settings.razorpayKeyId || "");
  const [razorpayUpiId, setRazorpayUpiId] = useState(settings.razorpayUpiId);
  const [razorpayUrl, setRazorpayUrl] = useState(settings.razorpayPaymentUrl);
  const [razorpayError, setRazorpayError] = useState("");
  useEffect(() => {
    if (ready) {
      queueMicrotask(() => {
        setRazorpayKeyId(settings.razorpayKeyId || "");
        setRazorpayUpiId(settings.razorpayUpiId);
        setRazorpayUrl(settings.razorpayPaymentUrl);
      });
    }
  }, [ready, settings.razorpayKeyId, settings.razorpayUpiId, settings.razorpayPaymentUrl]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("Profile settings saved successfully.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleSaveWhatsapp = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({
      ...settings,
      whatsappNumber,
      whatsappMessage: whatsappMsg
    });
    setSuccessMsg("WhatsApp settings saved successfully.");
    setTimeout(() => setSuccessMsg(""), 3000);
  };



  const handleSaveRazorpay = (e: React.FormEvent) => {
    e.preventDefault();
    setRazorpayError("");
    const keyId = razorpayKeyId.trim();
    const upi = razorpayUpiId.trim();
    const urlInput = razorpayUrl.trim();
    if (keyId && !isValidRazorpayKeyId(keyId)) {
      setRazorpayError("Enter a valid Razorpay Key ID starting with rzp_test_ or rzp_live_.");
      return;
    }
    if (upi && !isValidUpiId(upi)) {
      setRazorpayError("Enter a valid UPI ID, for example yourshop@okicici or 9876543210@ybl.");
      return;
    }
    let normalizedUrl = "";
    if (urlInput) {
      const checked = normalizePaymentUrl(urlInput);
      if (!checked) {
        setRazorpayError("Payment link must be a Razorpay link (razorpay.me, rzp.io or pages.razorpay.com).");
        return;
      }
      normalizedUrl = checked;
    }
    saveSettings({ ...settings, razorpayKeyId: keyId, razorpayUpiId: upi, razorpayPaymentUrl: normalizedUrl });
    setRazorpayUrl(normalizedUrl);
    setSuccessMsg(
      keyId || upi || normalizedUrl
        ? "Razorpay payment settings saved. Online payment is now live at checkout."
        : "Razorpay details cleared. Checkout is Cash on Delivery only."
    );
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    setSuccessMsg("");
    
    if (password !== confirmPassword) {
      setPwdError("Passwords do not match.");
      return;
    }
    
    if (password.length < 6) {
      setPwdError("Password must be at least 6 characters.");
      return;
    }
    
    try {
      const currentUser = getFirebaseAuth().currentUser;
      if (currentUser) {
        await updatePassword(currentUser, password);
        setSuccessMsg("Password updated successfully.");
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      setPwdError((err as Error).message || "Could not update password. Please re-authenticate and try again.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-[1600px] w-full mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Store Settings & Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your admin account details and integrations</p>
        </div>

        {successMsg && (
          <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
            {successMsg}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {/* General Profile Info */}
          <div className="bg-card border border-border/50 shadow-md rounded-3xl p-6 sm:p-8 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <UserCircle size={24} className="text-primary" />
              <h2 className="text-lg font-semibold">General Information</h2>
            </div>
            
            <form onSubmit={handleSaveProfile} className="flex-1 flex flex-col space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium mb-1">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  disabled
                  value={user?.email || "admin@gmail.com"}
                  className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/80 text-muted-foreground text-sm font-medium truncate cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
              </div>
              
              <div className="flex-1">
                <label htmlFor="admin-username" className="block text-sm font-medium mb-1">Username</label>
                <input
                  id="admin-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 mt-6"
              >
                <Save size={18} /> Save Settings
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-card border border-border/50 shadow-md rounded-3xl p-6 sm:p-8 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <Key size={24} className="text-primary" />
              <h2 className="text-lg font-semibold">Security & Password</h2>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="flex-1 flex flex-col space-y-4">
              {pwdError && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                  {pwdError}
                </div>
              )}
              
              <div>
                <label htmlFor="admin-new-password" className="block text-sm font-medium mb-1">New Password</label>
                <input
                  id="admin-new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-medium"
                />
              </div>
              
              <div className="flex-1">
                <label htmlFor="admin-confirm-password" className="block text-sm font-medium mb-1">Confirm New Password</label>
                <input
                  id="admin-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 mt-6"
              >
                <Key size={18} /> Update Password
              </button>
            </form>
          </div>
          
          {/* WhatsApp Integration (Full Width) */}
          <div className="xl:col-span-2 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-500/20">
              <MessageCircle size={24} className="text-emerald-700 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">WhatsApp Integration</h2>
            </div>
            
            <form onSubmit={handleSaveWhatsapp} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="admin-wa-number" className="block text-sm font-medium mb-1 text-emerald-800 dark:text-emerald-300">WhatsApp Number</label>
                  <input
                    id="admin-wa-number"
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full px-4 py-3 rounded-xl border border-emerald-500/30 bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Make sure to include your country code (e.g. 91 for India).</p>
                </div>
                
                <div>
                  <label htmlFor="admin-wa-msg" className="block text-sm font-medium mb-1 text-emerald-800 dark:text-emerald-300">Custom Pre-filled Message</label>
                  <textarea
                    id="admin-wa-msg"
                    value={whatsappMsg}
                    onChange={(e) => setWhatsappMsg(e.target.value)}
                    rows={3}
                    placeholder="Hello! I would like to inquire about..."
                    className="w-full px-4 py-3 rounded-xl border border-emerald-500/30 bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">This exact message will pop up when users click the chat bubble.</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-[#128C7E] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#075E54] transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Update WhatsApp Sync
                </button>
              </div>
            </form>
          </div>

          {/* Razorpay Payments */}
          <div className="bg-card border border-border/50 shadow-md rounded-3xl p-6 sm:p-8 xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <CreditCard size={24} className="text-primary" />
                <h2 className="text-lg font-semibold">Razorpay Payments</h2>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
                {razorpayKeyId.trim()
                  ? "Razorpay Gateway Key Configured"
                  : razorpayUrl.trim() || razorpayUpiId.trim()
                  ? "Payment Link / UPI Active"
                  : "COD Only (Enter Razorpay ID to Enable Online Pay)"}
              </span>
            </div>
            <form onSubmit={handleSaveRazorpay} className="space-y-6">
              {razorpayError && <div role="alert" className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">{razorpayError}</div>}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div>
                  <label htmlFor="razorpay-key-id" className="block text-sm font-medium mb-1">Razorpay Key ID (API Gateway)</label>
                  <input id="razorpay-key-id" type="text" value={razorpayKeyId} onChange={(e) => setRazorpayKeyId(e.target.value)} placeholder="rzp_live_XXXXXXXXXXXXXX" className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-mono" />
                  <p className="text-xs text-muted-foreground mt-1">Paste your public Key ID (rzp_test_... or rzp_live_...) once approved by Razorpay to open the inline checkout popup.</p>
                </div>
                <div>
                  <label htmlFor="razorpay-url" className="block text-sm font-medium mb-1">Razorpay Payment Link</label>
                  <input id="razorpay-url" type="text" value={razorpayUrl} onChange={(e) => setRazorpayUrl(e.target.value)} placeholder="https://razorpay.me/@yourshop" className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm" />
                  <p className="text-xs text-muted-foreground mt-1">Your razorpay.me, rzp.io or Payment Page link. Customers are sent here to pay.</p>
                </div>
                <div>
                  <label htmlFor="razorpay-upi" className="block text-sm font-medium mb-1">Razorpay UPI ID</label>
                  <input id="razorpay-upi" type="text" value={razorpayUpiId} onChange={(e) => setRazorpayUpiId(e.target.value)} placeholder="yourshop@okicici" className="w-full px-4 py-3 rounded-xl border border-border/50 bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm" />
                  <p className="text-xs text-muted-foreground mt-1">Customers on mobile get a one-tap UPI app payment with the exact order amount.</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground rounded-xl bg-muted/50 p-3">Add your Razorpay Key ID, Payment Link, or UPI ID (or any combination). Leave all empty to keep Cash on Delivery only. Only public payment identifiers are stored here; for automatic server-side signature verification, set <code className="font-mono">RAZORPAY_KEY_SECRET</code> in your Vercel environment variables.</p>
              <div className="flex justify-end">
                <button type="submit" className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"><Save size={18} /> Save Changes</button>
              </div>
            </form>
          </div>

          {/* Push Notification Preferences */}
          <div className="xl:col-span-2">
            <PushNotificationSettings userId={user?.uid} />
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
