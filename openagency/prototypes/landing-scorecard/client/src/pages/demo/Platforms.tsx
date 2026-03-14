/*
 * Platforms — Connected ad platforms and data ingestion
 * 6 platform cards with status + file upload zone
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, AlertCircle, Upload, FileText, RefreshCw } from "lucide-react";
import DemoLayout from "@/components/demo/DemoLayout";

const platforms = [
  {
    name: "Meta Ads",
    status: "connected",
    lastSync: "2 min ago",
    accounts: 3,
    spend: "$1,240,000",
    color: "#3b82f6",
    icon: "M",
  },
  {
    name: "Google Ads",
    status: "connected",
    lastSync: "5 min ago",
    accounts: 2,
    spend: "$980,000",
    color: "#00e5a0",
    icon: "G",
  },
  {
    name: "TikTok Ads",
    status: "connected",
    lastSync: "8 min ago",
    accounts: 1,
    spend: "$420,000",
    color: "#ff3366",
    icon: "T",
  },
  {
    name: "Amazon Ads",
    status: "connected",
    lastSync: "12 min ago",
    accounts: 2,
    spend: "$680,000",
    color: "#ff6b35",
    icon: "A",
  },
  {
    name: "DV360",
    status: "connected",
    lastSync: "15 min ago",
    accounts: 1,
    spend: "$1,100,000",
    color: "#a78bfa",
    icon: "D",
  },
  {
    name: "LinkedIn Ads",
    status: "pending",
    lastSync: "—",
    accounts: 0,
    spend: "$0",
    color: "#52525b",
    icon: "L",
  },
];

const recentFiles = [
  { name: "q4_spend_report.csv", size: "2.4 MB", date: "2 hours ago", rows: "12,847" },
  { name: "meta_campaigns_jan.json", size: "1.1 MB", date: "1 day ago", rows: "3,421" },
  { name: "google_performance.csv", size: "4.7 MB", date: "3 days ago", rows: "28,103" },
];

export default function PlatformsPage() {
  const [dragOver, setDragOver] = useState(false);

  const connectedCount = platforms.filter((p) => p.status === "connected").length;
  const totalSpend = platforms.reduce((sum, p) => {
    const val = parseInt(p.spend.replace(/[$,]/g, "")) || 0;
    return sum + val;
  }, 0);

  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Header metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-[10px] text-zinc-600 mb-1 font-medium uppercase tracking-wider">Connected Platforms</p>
            <p className="text-2xl font-mono font-bold text-white">{connectedCount}/6</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-[10px] text-zinc-600 mb-1 font-medium uppercase tracking-wider">Total Ad Spend Tracked</p>
            <p className="text-2xl font-mono font-bold text-white">${(totalSpend / 1000000).toFixed(1)}M</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-[10px] text-zinc-600 mb-1 font-medium uppercase tracking-wider">Total Accounts</p>
            <p className="text-2xl font-mono font-bold text-white">{platforms.reduce((s, p) => s + p.accounts, 0)}</p>
          </motion.div>
        </div>

        {/* Platform Cards */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-4">Ad Platforms</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platforms.map((platform, i) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-all"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: `${platform.color}15`, color: platform.color }}
                    >
                      {platform.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{platform.name}</p>
                      <p className="text-[10px] text-zinc-600">Last sync: {platform.lastSync}</p>
                    </div>
                  </div>
                  {platform.status === "connected" ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#00e5a0]/10">
                      <Check size={10} className="text-[#00e5a0]" />
                      <span className="text-[10px] font-medium text-[#00e5a0]">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-zinc-800">
                      <AlertCircle size={10} className="text-zinc-500" />
                      <span className="text-[10px] font-medium text-zinc-500">Pending</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Accounts</p>
                    <p className="text-sm font-mono font-semibold text-zinc-300">{platform.accounts}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Monthly Spend</p>
                    <p className="text-sm font-mono font-semibold text-zinc-300">{platform.spend}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* File Upload + Recent Files */}
        <div className="grid grid-cols-2 gap-4">
          {/* Upload Zone */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${
              dragOver ? "border-[#00e5a0]/40 bg-[#00e5a0]/5" : "border-white/[0.08] bg-white/[0.01]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
          >
            <Upload size={32} className="text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-400 mb-1">Drop files here or click to upload</p>
            <p className="text-[10px] text-zinc-600">Supports CSV, JSON, Excel — up to 50MB</p>
            <p className="text-[10px] text-zinc-700 mt-3">Plinth auto-detects platform format and maps columns</p>
          </motion.div>

          {/* Recent Files */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="rounded-xl border border-white/[0.06] overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Recent Uploads</span>
              <RefreshCw size={12} className="text-zinc-600" />
            </div>
            <div className="divide-y divide-white/[0.03]">
              {recentFiles.map((file) => (
                <div key={file.name} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <FileText size={14} className="text-zinc-600" />
                    <div>
                      <p className="text-xs font-medium text-white">{file.name}</p>
                      <p className="text-[10px] text-zinc-600">{file.size} · {file.rows} rows</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600">{file.date}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </DemoLayout>
  );
}
